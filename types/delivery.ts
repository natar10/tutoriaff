/**
 * Tipos TypeScript para el sistema de rutas de entrega
 */

/**
 * Información de una entrega extraída del manifiesto
 */
export interface Delivery {
  codigo: string;
  articulo: string;
  calle: string;
  numero: string;
  sector: string;
  cp: string;
  ubicacion: string;
  cliente: string;
  telefono: string;
  direccionCompleta?: string;
  lat?: number;
  lng?: number;
}

/**
 * Datos completos de una ruta de entrega
 */
export interface DeliveryRoute {
  fecha: string;
  conductor: string;
  entregas: Delivery[];
}

/**
 * Dirección geocodificada con coordenadas
 */
export interface GeocodedAddress {
  address: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string;
  error?: string;
}

/**
 * Ubicación geográfica (coordenadas)
 */
export interface Location {
  lat: number;
  lng: number;
}

/**
 * Entrega con información de orden optimizado
 */
export interface OptimizedDelivery extends Delivery {
  orderIndex: number;
  estimatedArrival?: string;
  distanceFromPrevious?: number;
}

/**
 * Resultado de optimización de ruta
 */
export interface OptimizedRoute {
  optimizedDeliveries: OptimizedDelivery[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  estimatedCost: number;
  route?: {
    polyline?: string;
    legs?: RouteLeg[];
  };
}

/**
 * Segmento de una ruta entre dos puntos
 */
export interface RouteLeg {
  startLocation: Location;
  endLocation: Location;
  distanceMeters: number;
  durationSeconds: number;
  steps?: RouteStep[];
}

/**
 * Paso individual en una ruta
 */
export interface RouteStep {
  distanceMeters: number;
  durationSeconds: number;
  startLocation: Location;
  endLocation: Location;
  instruction?: string;
}

/**
 * Parámetros para solicitud de geocodificación
 */
export interface GeocodeRequest {
  addresses: string[];
}

/**
 * Parámetros para solicitud de optimización
 */
export interface OptimizeRequest {
  deliveries: Delivery[];
  warehouseLocation: Location;
  startTime?: string;
}
