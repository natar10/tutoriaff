/**
 * Configuración y utilidades para Google Maps APIs
 *
 * IMPORTANTE: Este archivo solo debe usarse en el servidor (API Routes)
 * Nunca exponer la API key al cliente
 */

/**
 * Obtiene la API key de Google Maps desde las variables de entorno
 * @throws Error si la API key no está configurada
 */
export function getGoogleMapsApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY no está configurada en las variables de entorno. ' +
      'Por favor, añade esta variable a tu archivo .env.local'
    );
  }

  return apiKey;
}

/**
 * Obtiene el ID del proyecto de Google Cloud desde las variables de entorno
 * @throws Error si el ID del proyecto no está configurado
 */
export function getGoogleCloudProjectId(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID no está configurada en las variables de entorno. ' +
      'Por favor, añade esta variable a tu archivo .env.local con el ID de tu proyecto de Google Cloud'
    );
  }

  return projectId;
}

/**
 * Obtiene las credenciales del service account desde las variables de entorno
 * @throws Error si las credenciales no están configuradas
 */
export function getServiceAccountCredentials(): {
  client_email: string;
  private_key: string;
} {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;

  if (!credentials) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS no está configurada en las variables de entorno. ' +
      'Por favor, añade el JSON completo del service account a esta variable'
    );
  }

  try {
    const parsed = JSON.parse(credentials);

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('El JSON del service account debe contener client_email y private_key');
    }

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  } catch (error) {
    throw new Error(
      'Error al parsear GOOGLE_SERVICE_ACCOUNT_CREDENTIALS: ' +
      (error instanceof Error ? error.message : 'JSON inválido')
    );
  }
}

/**
 * Genera un JWT para autenticación con Google Cloud APIs
 * @param serviceAccount Credenciales del service account
 * @param scope Scope requerido para la API
 * @returns JWT firmado
 */
async function createJWT(
  serviceAccount: { client_email: string; private_key: string },
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hora

  // Header del JWT
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // Payload del JWT
  const payload = {
    iss: serviceAccount.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  };

  // Codificar en base64url
  const base64url = (input: string) =>
    Buffer.from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Firmar con la clave privada usando crypto de Node.js
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64');
  const signatureEncoded = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signatureInput}.${signatureEncoded}`;
}

/**
 * Obtiene un access token de OAuth2 usando las credenciales del service account
 * @returns Access token válido para Google Cloud APIs
 */
export async function getGoogleCloudAccessToken(): Promise<string> {
  const serviceAccount = getServiceAccountCredentials();
  const scope = 'https://www.googleapis.com/auth/cloud-platform';

  // Crear JWT
  const jwt = await createJWT(serviceAccount, scope);

  // Intercambiar JWT por access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      `Error al obtener access token: ${response.status} - ${JSON.stringify(error)}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Obtiene las coordenadas del almacén desde las variables de entorno
 * @returns Coordenadas del almacén o coordenadas por defecto (Valladolid)
 */
export function getWarehouseLocation(): { lat: number; lng: number } {
  const lat = process.env.NEXT_PUBLIC_WAREHOUSE_LAT
    ? parseFloat(process.env.NEXT_PUBLIC_WAREHOUSE_LAT)
    : 41.6523; // Valladolid por defecto

  const lng = process.env.NEXT_PUBLIC_WAREHOUSE_LNG
    ? parseFloat(process.env.NEXT_PUBLIC_WAREHOUSE_LNG)
    : -4.7245; // Valladolid por defecto

  return { lat, lng };
}

/**
 * URLs de las APIs de Google Maps
 */
export const GOOGLE_MAPS_APIS = {
  GEOCODING: 'https://maps.googleapis.com/maps/api/geocode/json',
  DIRECTIONS: 'https://maps.googleapis.com/maps/api/directions/json',
  DISTANCE_MATRIX: 'https://maps.googleapis.com/maps/api/distancematrix/json',
  // Nota: ROUTE_OPTIMIZATION requiere el ID del proyecto en la URL
  // Formato: https://routeoptimization.googleapis.com/v1/projects/{PROJECT_ID}:optimizeTours
  ROUTE_OPTIMIZATION_BASE: 'https://routeoptimization.googleapis.com/v1',
} as const;

/**
 * Construye la URL completa de Route Optimization con el ID del proyecto
 */
export function getRouteOptimizationUrl(projectId: string): string {
  return `${GOOGLE_MAPS_APIS.ROUTE_OPTIMIZATION_BASE}/projects/${projectId}:optimizeTours`;
}

/**
 * Configuración común para geocodificación en España
 */
export const GEOCODING_CONFIG = {
  language: 'es',
  region: 'es',
  country: 'España',
} as const;

/**
 * Configuración de optimización de rutas
 */
export const ROUTE_OPTIMIZATION_CONFIG = {
  /** Duración estimada por entrega en segundos (5 minutos) */
  durationPerDelivery: 300,

  /** Costo por kilómetro recorrido */
  costPerKilometer: 1.0,

  /** Costo por hora de trabajo */
  costPerHour: 0.5,

  /** Duración de ventana de tiempo en horas (jornada laboral) */
  timeWindowHours: 8,
} as const;

/**
 * Valida que una dirección sea válida para geocodificación
 */
export function isValidAddress(address: string): boolean {
  return Boolean(address && address.trim().length > 0);
}

/**
 * Formatea una dirección añadiendo ", España" si no lo tiene
 */
export function formatAddressForSpain(address: string): string {
  const trimmed = address.trim();

  // Si ya contiene "España" o "Spain", no añadir nada
  if (trimmed.toLowerCase().includes('españa') || trimmed.toLowerCase().includes('spain')) {
    return trimmed;
  }

  return `${trimmed}, España`;
}

/**
 * Calcula el costo estimado de una ruta
 * @param distanceMeters Distancia en metros
 * @param durationSeconds Duración en segundos
 * @returns Costo estimado en euros
 */
export function calculateRouteCost(distanceMeters: number, durationSeconds: number): number {
  const distanceKm = distanceMeters / 1000;
  const durationHours = durationSeconds / 3600;

  const distanceCost = distanceKm * ROUTE_OPTIMIZATION_CONFIG.costPerKilometer;
  const timeCost = durationHours * ROUTE_OPTIMIZATION_CONFIG.costPerHour;

  return parseFloat((distanceCost + timeCost).toFixed(2));
}

/**
 * Genera un link de Google Maps para una ubicación individual
 * @param lat Latitud del destino
 * @param lng Longitud del destino
 * @param originLat Latitud de origen (opcional, para incluir ruta desde origen)
 * @param originLng Longitud de origen (opcional, para incluir ruta desde origen)
 * @returns URL de Google Maps
 */
export function generateGoogleMapsLink(
  lat: number,
  lng: number,
  originLat?: number,
  originLng?: number
): string {
  const baseUrl = 'https://www.google.com/maps/dir/';

  if (originLat !== undefined && originLng !== undefined) {
    // Link con origen y destino (para navegación)
    return `${baseUrl}?api=1&origin=${originLat},${originLng}&destination=${lat},${lng}&travelmode=driving`;
  } else {
    // Link solo al destino
    return `${baseUrl}?api=1&destination=${lat},${lng}`;
  }
}

/**
 * Genera un link de Google Maps con múltiples paradas (ruta completa)
 * @param waypoints Array de coordenadas {lat, lng} en el orden de la ruta
 * @param originLat Latitud de origen (almacén)
 * @param originLng Longitud de origen (almacén)
 * @returns URL de Google Maps o array de URLs si hay más de 9 waypoints
 */
export function generateCompleteRouteLink(
  waypoints: Array<{ lat: number; lng: number }>,
  originLat: number,
  originLng: number
): string | string[] {
  const MAX_WAYPOINTS = 9;

  // Si no hay waypoints, devolver solo el origen
  if (waypoints.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${originLat},${originLng}`;
  }

  // Si hay 1 sola parada, ruta simple: origen -> destino -> origen
  if (waypoints.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${originLat},${originLng}&waypoints=${waypoints[0].lat},${waypoints[0].lng}&travelmode=driving`;
  }

  // Si hay <= 9 waypoints, una sola URL
  if (waypoints.length <= MAX_WAYPOINTS) {
    const waypointsStr = waypoints
      .slice(0, -1) // Todas menos la última
      .map((wp) => `${wp.lat},${wp.lng}`)
      .join('|');

    const lastWaypoint = waypoints[waypoints.length - 1];

    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${lastWaypoint.lat},${lastWaypoint.lng}&waypoints=${waypointsStr}&travelmode=driving`;
  }

  // Si hay más de 9 waypoints, dividir en múltiples rutas
  const routes: string[] = [];

  for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS) {
    const chunk = waypoints.slice(i, i + MAX_WAYPOINTS);

    if (chunk.length === 0) continue;

    const isFirstChunk = i === 0;
    const origin = isFirstChunk
      ? `${originLat},${originLng}`
      : `${waypoints[i - 1].lat},${waypoints[i - 1].lng}`;

    const destination = chunk[chunk.length - 1];
    const intermediateWaypoints = chunk.slice(0, -1);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination.lat},${destination.lng}`;

    if (intermediateWaypoints.length > 0) {
      const waypointsStr = intermediateWaypoints
        .map((wp) => `${wp.lat},${wp.lng}`)
        .join('|');
      url += `&waypoints=${waypointsStr}`;
    }

    url += '&travelmode=driving';
    routes.push(url);
  }

  return routes;
}
