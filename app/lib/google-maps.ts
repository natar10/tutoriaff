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
  return address && address.trim().length > 0;
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
