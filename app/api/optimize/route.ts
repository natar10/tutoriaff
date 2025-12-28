import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleMapsApiKey,
  getGoogleCloudProjectId,
  getRouteOptimizationUrl,
  ROUTE_OPTIMIZATION_CONFIG,
  calculateRouteCost,
} from '@/app/lib/google-maps';
import { OptimizeRequest, OptimizedRoute, OptimizedDelivery } from '@/types/delivery';

/**
 * API Route para optimizar rutas de entrega usando Google Route Optimization API
 *
 * POST /api/optimize
 * Body: { deliveries: Delivery[], warehouseLocation: {lat, lng}, startTime?: string }
 * Response: OptimizedRoute
 *
 * IMPORTANTE: Esta ruta solo debe llamarse desde el servidor
 * Nunca exponer la API key de Google Maps al cliente
 */
export async function POST(request: NextRequest) {
  try {
    // Validar que la API key y el ID del proyecto estén configurados
    const apiKey = getGoogleMapsApiKey();
    const projectId = getGoogleCloudProjectId();

    // Parsear el body de la solicitud
    const body = (await request.json()) as OptimizeRequest;

    // Validar que se proporcionaron entregas
    if (!body.deliveries || !Array.isArray(body.deliveries)) {
      return NextResponse.json(
        { error: 'Se requiere un array de entregas' },
        { status: 400 }
      );
    }

    if (body.deliveries.length === 0) {
      return NextResponse.json(
        { error: 'El array de entregas está vacío' },
        { status: 400 }
      );
    }

    // Validar que las entregas tengan coordenadas
    const deliveriesWithoutCoords = body.deliveries.filter(
      (d) => !d.lat || !d.lng
    );

    if (deliveriesWithoutCoords.length > 0) {
      return NextResponse.json(
        {
          error: 'Todas las entregas deben tener coordenadas (lat, lng)',
          details: `${deliveriesWithoutCoords.length} entregas sin coordenadas`,
        },
        { status: 400 }
      );
    }

    // Validar ubicación del almacén
    if (!body.warehouseLocation || !body.warehouseLocation.lat || !body.warehouseLocation.lng) {
      return NextResponse.json(
        { error: 'Se requiere la ubicación del almacén (warehouseLocation)' },
        { status: 400 }
      );
    }

    console.log(
      `[Route Optimization] Optimizando ruta para ${body.deliveries.length} entregas...`
    );

    // Preparar el tiempo de inicio (ahora o el especificado)
    const startTime = body.startTime || new Date().toISOString();
    const endTime = new Date(
      new Date(startTime).getTime() +
        ROUTE_OPTIMIZATION_CONFIG.timeWindowHours * 60 * 60 * 1000
    ).toISOString();

    // Construir el payload para Route Optimization API
    // Documentación: https://developers.google.com/maps/documentation/route-optimization
    const optimizationPayload = {
      model: {
        shipments: body.deliveries.map((delivery, index) => ({
          deliveries: [
            {
              arrivalWaypoint: {
                location: {
                  latLng: {
                    latitude: delivery.lat,
                    longitude: delivery.lng,
                  },
                },
              },
              duration: `${ROUTE_OPTIMIZATION_CONFIG.durationPerDelivery}s`,
              timeWindows: [
                {
                  startTime,
                  endTime,
                },
              ],
            },
          ],
          label: delivery.codigo || `Entrega-${index + 1}`,
        })),
        vehicles: [
          {
            startWaypoint: {
              location: {
                latLng: {
                  latitude: body.warehouseLocation.lat,
                  longitude: body.warehouseLocation.lng,
                },
              },
            },
            endWaypoint: {
              location: {
                latLng: {
                  latitude: body.warehouseLocation.lat,
                  longitude: body.warehouseLocation.lng,
                },
              },
            },
            costPerHour: ROUTE_OPTIMIZATION_CONFIG.costPerHour,
            costPerKilometer: ROUTE_OPTIMIZATION_CONFIG.costPerKilometer,
          },
        ],
        globalStartTime: startTime,
        globalEndTime: endTime,
      },
    };

    console.log('[Route Optimization] Llamando a Google Route Optimization API...');

    // Llamar a la API de Route Optimization
    // URL incluye el ID del proyecto: /v1/projects/{PROJECT_ID}:optimizeTours
    const response = await fetch(
      `${getRouteOptimizationUrl(projectId)}?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': 'routes,metrics',
        },
        body: JSON.stringify(optimizationPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(
        '[Route Optimization] Error de Google API:',
        response.status,
        errorData
      );

      return NextResponse.json(
        {
          error: 'Error al optimizar la ruta con Google API',
          details: errorData || `HTTP ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[Route Optimization] Respuesta recibida de Google');

    // Extraer la ruta optimizada
    if (!data.routes || data.routes.length === 0) {
      console.warn('[Route Optimization] No se encontraron rutas optimizadas');
      return NextResponse.json(
        {
          error: 'No se pudo optimizar la ruta',
          details: 'Google no devolvió ninguna ruta',
        },
        { status: 500 }
      );
    }

    const route = data.routes[0];
    const metrics = data.metrics?.[0];

    // Mapear las visitas a entregas ordenadas
    const visits = route.visits || [];
    const optimizedDeliveries: OptimizedDelivery[] = visits
      .filter((visit: any) => visit.shipmentIndex !== undefined)
      .map((visit: any, index: number) => {
        const originalDelivery = body.deliveries[visit.shipmentIndex];
        return {
          ...originalDelivery,
          orderIndex: index + 1,
          estimatedArrival: visit.startTime,
        };
      });

    // Calcular totales
    const totalDistanceMeters = metrics?.totalDistance || 0;
    const totalDurationSeconds = metrics?.totalDuration
      ? parseInt(metrics.totalDuration.replace('s', ''))
      : 0;
    const estimatedCost = calculateRouteCost(totalDistanceMeters, totalDurationSeconds);

    console.log(
      `[Route Optimization] ✓ Ruta optimizada: ${optimizedDeliveries.length} paradas, ` +
        `${(totalDistanceMeters / 1000).toFixed(1)} km, ` +
        `${(totalDurationSeconds / 60).toFixed(0)} min, ` +
        `€${estimatedCost.toFixed(2)}`
    );

    const result: OptimizedRoute = {
      optimizedDeliveries,
      totalDistanceMeters,
      totalDurationSeconds,
      estimatedCost,
      route: {
        polyline: route.routePolyline?.encodedPolyline,
        legs: route.transitions?.map((transition: any) => ({
          startLocation: {
            lat: transition.startLocation?.latLng?.latitude || 0,
            lng: transition.startLocation?.latLng?.longitude || 0,
          },
          endLocation: {
            lat: transition.endLocation?.latLng?.latitude || 0,
            lng: transition.endLocation?.latLng?.longitude || 0,
          },
          distanceMeters: transition.travelDistanceMeters || 0,
          durationSeconds: transition.travelDuration
            ? parseInt(transition.travelDuration.replace('s', ''))
            : 0,
        })),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Route Optimization] Error general:', error);

    return NextResponse.json(
      {
        error: 'Error al optimizar la ruta',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
