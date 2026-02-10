import { NextRequest, NextResponse } from 'next/server';
import { validateAccessCode } from '@/app/lib/auth';
import {
  getGoogleMapsApiKey,
  GOOGLE_MAPS_APIS,
  GEOCODING_CONFIG,
  formatAddressForSpain,
  isValidAddress,
} from '@/app/lib/google-maps';
import { GeocodeRequest, GeocodedAddress } from '@/types/delivery';

/**
 * API Route para geocodificar direcciones usando Google Geocoding API
 *
 * POST /api/geocode
 * Body: { addresses: string[] }
 * Response: GeocodedAddress[]
 *
 * IMPORTANTE: Esta ruta solo debe llamarse desde el servidor
 * Nunca exponer la API key de Google Maps al cliente
 */
export async function POST(request: NextRequest) {
  const authError = validateAccessCode(request);
  if (authError) return authError;

  try {
    // Validar que la API key esté configurada
    const apiKey = getGoogleMapsApiKey();

    // Parsear el body de la solicitud
    const body = (await request.json()) as GeocodeRequest;

    // Validar que se proporcionaron direcciones
    if (!body.addresses || !Array.isArray(body.addresses)) {
      return NextResponse.json(
        { error: 'Se requiere un array de direcciones' },
        { status: 400 }
      );
    }

    if (body.addresses.length === 0) {
      return NextResponse.json(
        { error: 'El array de direcciones está vacío' },
        { status: 400 }
      );
    }

    console.log(`[Geocoding] Procesando ${body.addresses.length} direcciones...`);

    // Geocodificar cada dirección
    const geocodedAddresses: GeocodedAddress[] = await Promise.all(
      body.addresses.map(async (address, index) => {
        // Validar dirección
        if (!isValidAddress(address)) {
          console.warn(`[Geocoding] Dirección ${index + 1} inválida: "${address}"`);
          return {
            address,
            formattedAddress: '',
            lat: 0,
            lng: 0,
            error: 'Dirección vacía o inválida',
          };
        }

        // Formatear dirección añadiendo ", España"
        const formattedAddress = formatAddressForSpain(address);

        try {
          // Construir URL para Geocoding API
          const url = new URL(GOOGLE_MAPS_APIS.GEOCODING);
          url.searchParams.append('address', formattedAddress);
          url.searchParams.append('key', apiKey);
          url.searchParams.append('language', GEOCODING_CONFIG.language);
          url.searchParams.append('region', GEOCODING_CONFIG.region);

          console.log(`[Geocoding] Geocodificando: "${formattedAddress}"`);

          // Llamar a la API de Google
          const response = await fetch(url.toString());

          if (!response.ok) {
            console.error(
              `[Geocoding] Error HTTP ${response.status} para: "${formattedAddress}"`
            );
            return {
              address,
              formattedAddress,
              lat: 0,
              lng: 0,
              error: `Error HTTP ${response.status}`,
            };
          }

          const data = await response.json();

          // Verificar el estado de la respuesta
          if (data.status !== 'OK') {
            console.warn(
              `[Geocoding] Estado ${data.status} para: "${formattedAddress}"`
            );

            // Mensajes de error más descriptivos
            let errorMessage = data.status;
            if (data.status === 'ZERO_RESULTS') {
              errorMessage = 'No se encontró la dirección';
            } else if (data.status === 'INVALID_REQUEST') {
              errorMessage = 'Dirección inválida';
            } else if (data.status === 'OVER_QUERY_LIMIT') {
              errorMessage = 'Límite de consultas excedido';
            } else if (data.status === 'REQUEST_DENIED') {
              errorMessage = 'Solicitud denegada - verifica la API key';
            }

            return {
              address,
              formattedAddress,
              lat: 0,
              lng: 0,
              error: errorMessage,
            };
          }

          // Extraer el primer resultado
          const result = data.results[0];
          const location = result.geometry.location;

          console.log(
            `[Geocoding] ✓ Geocodificado: "${formattedAddress}" → (${location.lat}, ${location.lng})`
          );

          return {
            address,
            formattedAddress: result.formatted_address,
            lat: location.lat,
            lng: location.lng,
            placeId: result.place_id,
          };
        } catch (error) {
          console.error(`[Geocoding] Error procesando "${formattedAddress}":`, error);
          return {
            address,
            formattedAddress,
            lat: 0,
            lng: 0,
            error:
              error instanceof Error
                ? error.message
                : 'Error desconocido al geocodificar',
          };
        }
      })
    );

    // Contar resultados exitosos y con error
    const successful = geocodedAddresses.filter((addr) => !addr.error).length;
    const failed = geocodedAddresses.length - successful;

    console.log(
      `[Geocoding] Completado: ${successful} exitosos, ${failed} fallidos de ${geocodedAddresses.length} total`
    );

    return NextResponse.json({
      results: geocodedAddresses,
      summary: {
        total: geocodedAddresses.length,
        successful,
        failed,
      },
    });
  } catch (error) {
    console.error('[Geocoding] Error general:', error);

    return NextResponse.json(
      {
        error: 'Error al procesar las direcciones',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
