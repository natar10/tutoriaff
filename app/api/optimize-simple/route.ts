import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleMapsApiKey,
  GOOGLE_MAPS_APIS,
  calculateRouteCost,
} from '@/app/lib/google-maps';
import { OptimizeRequest, OptimizedRoute, OptimizedDelivery } from '@/types/delivery';

/**
 * API Route simplificada para optimizar rutas usando Google Directions API
 *
 * Esta versión usa un algoritmo simple de "nearest neighbor" (vecino más cercano)
 * y Google Directions API para calcular distancias
 *
 * POST /api/optimize-simple
 * Body: { deliveries: Delivery[], warehouseLocation: {lat, lng} }
 * Response: OptimizedRoute
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = getGoogleMapsApiKey();
    const body = (await request.json()) as OptimizeRequest;

    // Validaciones
    if (!body.deliveries || !Array.isArray(body.deliveries) || body.deliveries.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de entregas no vacío' },
        { status: 400 }
      );
    }

    const deliveriesWithoutCoords = body.deliveries.filter((d) => !d.lat || !d.lng);
    if (deliveriesWithoutCoords.length > 0) {
      return NextResponse.json(
        {
          error: 'Todas las entregas deben tener coordenadas (lat, lng)',
          details: `${deliveriesWithoutCoords.length} entregas sin coordenadas`,
        },
        { status: 400 }
      );
    }

    if (!body.warehouseLocation?.lat || !body.warehouseLocation?.lng) {
      return NextResponse.json(
        { error: 'Se requiere la ubicación del almacén' },
        { status: 400 }
      );
    }

    console.log(`[Optimize Simple] Optimizando ${body.deliveries.length} entregas...`);

    // Algoritmo Nearest Neighbor (vecino más cercano)
    const unvisited = [...body.deliveries];
    const optimized: OptimizedDelivery[] = [];
    let currentLocation = body.warehouseLocation;
    let totalDistance = 0;

    // Función para calcular distancia euclidiana (aproximada)
    const calculateDistance = (
      from: { lat: number; lng: number },
      to: { lat: number; lng: number }
    ): number => {
      const R = 6371000; // Radio de la Tierra en metros
      const lat1 = (from.lat * Math.PI) / 180;
      const lat2 = (to.lat * Math.PI) / 180;
      const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
      const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distancia en metros
    };

    // Encontrar la ruta óptima usando nearest neighbor
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      // Encontrar la entrega más cercana
      for (let i = 0; i < unvisited.length; i++) {
        const delivery = unvisited[i];
        const distance = calculateDistance(currentLocation, {
          lat: delivery.lat!,
          lng: delivery.lng!,
        });

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // Añadir la entrega más cercana a la ruta optimizada
      const nextDelivery = unvisited[nearestIndex];
      optimized.push({
        ...nextDelivery,
        orderIndex: optimized.length + 1,
        distanceFromPrevious: Math.round(nearestDistance),
      });

      totalDistance += nearestDistance;
      currentLocation = { lat: nextDelivery.lat!, lng: nextDelivery.lng! };
      unvisited.splice(nearestIndex, 1);
    }

    // Añadir distancia de regreso al almacén
    const returnDistance = calculateDistance(currentLocation, body.warehouseLocation);
    totalDistance += returnDistance;

    // Estimar duración (velocidad promedio en ciudad: 30 km/h + 5 min por entrega)
    const travelTimeSeconds = (totalDistance / 1000 / 30) * 3600; // Tiempo de viaje
    const deliveryTimeSeconds = optimized.length * 300; // 5 min por entrega
    const totalDurationSeconds = Math.round(travelTimeSeconds + deliveryTimeSeconds);

    // Calcular costo estimado
    const estimatedCost = calculateRouteCost(totalDistance, totalDurationSeconds);

    console.log(
      `[Optimize Simple] ✓ Ruta optimizada: ${optimized.length} paradas, ` +
        `${(totalDistance / 1000).toFixed(1)} km, ` +
        `${(totalDurationSeconds / 60).toFixed(0)} min, ` +
        `€${estimatedCost.toFixed(2)}`
    );

    const result: OptimizedRoute = {
      optimizedDeliveries: optimized,
      totalDistanceMeters: Math.round(totalDistance),
      totalDurationSeconds,
      estimatedCost,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Optimize Simple] Error:', error);
    return NextResponse.json(
      {
        error: 'Error al optimizar la ruta',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
