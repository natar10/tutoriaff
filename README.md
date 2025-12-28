# Sistema de Optimización de Rutas de Entrega

Dashboard Next.js con sistema de OCR para digitalizar manifiestos de rutas de entrega y optimización de rutas usando Google Maps APIs.

## 🚀 Características

- **OCR de Manifiestos**: Digitalización automática de hojas de ruta físicas usando Mistral AI
- **Geocodificación**: Conversión de direcciones a coordenadas usando Google Geocoding API
- **Optimización de Rutas**: Cálculo de rutas óptimas usando Google Route Optimization API
- **Dashboard Interactivo**: Visualización y gestión de rutas de entrega

## 📋 Requisitos Previos

- Node.js 18+ y npm
- Cuenta de [Mistral AI](https://console.mistral.ai/) (para OCR)
- Cuenta de [Google Cloud Platform](https://console.cloud.google.com/) (para Maps APIs)
- Base de datos PostgreSQL (Supabase recomendado)

## 🔧 Configuración Inicial

### 1. Clonar e Instalar Dependencias

```bash
git clone <tu-repositorio>
cd nextjs-dashboard
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores reales:

```env
# Base de Datos PostgreSQL
POSTGRES_URL=tu_postgres_url
POSTGRES_PRISMA_URL=tu_postgres_prisma_url
POSTGRES_URL_NON_POOLING=tu_postgres_url_non_pooling

# Mistral AI (OCR)
MISTRAL_API_KEY=tu_mistral_api_key

# Google Maps APIs
GOOGLE_MAPS_API_KEY=tu_google_maps_api_key

# Ubicación del Almacén (coordenadas)
NEXT_PUBLIC_WAREHOUSE_LAT=41.6523
NEXT_PUBLIC_WAREHOUSE_LNG=-4.7245
```

### 3. Obtener API Keys

#### Mistral AI API Key

1. Visita [console.mistral.ai](https://console.mistral.ai/)
2. Crea una cuenta o inicia sesión
3. Ve a "API Keys" en el menú
4. Crea una nueva API key
5. Copia la key y añádela a `MISTRAL_API_KEY` en `.env.local`

#### Google Maps API Key

1. Visita [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - **Geocoding API**
   - **Route Optimization API**
   - **Maps JavaScript API** (opcional, para visualización)

4. Ve a "Credenciales" → "Crear credenciales" → "Clave de API"
5. Copia la API key

**⚠️ IMPORTANTE - Restricciones de Seguridad:**

Para proteger tu API key, configura restricciones:

1. En Google Cloud Console, edita tu API key
2. En "Restricciones de aplicación":
   - Para desarrollo: Selecciona "Direcciones IP"
   - Añade tu IP local y la IP de tu servidor de producción
3. En "Restricciones de API":
   - Selecciona "Restringir clave"
   - Marca solo: Geocoding API y Route Optimization API

6. Añade la key a `GOOGLE_MAPS_API_KEY` en `.env.local`

### 4. Configurar Ubicación del Almacén

Las coordenadas del almacén se usan como punto de inicio/fin de las rutas:

```env
# Ejemplo: Valladolid, España
NEXT_PUBLIC_WAREHOUSE_LAT=41.6523
NEXT_PUBLIC_WAREHOUSE_LNG=-4.7245
```

Para encontrar tus coordenadas:
1. Abre [Google Maps](https://maps.google.com/)
2. Haz clic derecho en tu ubicación
3. Copia las coordenadas (lat, lng)

### 5. Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📚 Uso de las APIs

### API de Geocodificación

Convierte direcciones en coordenadas geográficas.

**Endpoint:** `POST /api/geocode`

**Request:**
```json
{
  "addresses": [
    "Calle Mayor 1, Madrid",
    "Plaza de España 5, Barcelona"
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "address": "Calle Mayor 1, Madrid",
      "formattedAddress": "Calle Mayor, 1, 28013 Madrid, España",
      "lat": 40.4168,
      "lng": -3.7038,
      "placeId": "ChIJ..."
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

**Ejemplo con cURL:**
```bash
curl -X POST http://localhost:3000/api/geocode \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["Calle Mayor 1, Madrid"]
  }'
```

### API de Optimización de Rutas

Calcula la ruta óptima para múltiples entregas.

**Endpoint:** `POST /api/optimize`

**Request:**
```json
{
  "deliveries": [
    {
      "codigo": "PKG001",
      "cliente": "Juan Pérez",
      "direccionCompleta": "Calle Mayor 1, Madrid",
      "lat": 40.4168,
      "lng": -3.7038
    }
  ],
  "warehouseLocation": {
    "lat": 41.6523,
    "lng": -4.7245
  }
}
```

**Response:**
```json
{
  "optimizedDeliveries": [
    {
      "codigo": "PKG001",
      "orderIndex": 1,
      "estimatedArrival": "2024-01-15T10:30:00Z",
      "lat": 40.4168,
      "lng": -3.7038
    }
  ],
  "totalDistanceMeters": 45000,
  "totalDurationSeconds": 3600,
  "estimatedCost": 50.5
}
```

## 🗂️ Estructura del Proyecto

```
├── app/
│   ├── api/
│   │   ├── geocode/      # API de geocodificación
│   │   ├── optimize/     # API de optimización
│   │   └── ocr/          # API de OCR (Mistral)
│   ├── lib/
│   │   └── google-maps.ts # Configuración de Google Maps
│   ├── rutas/            # Página de rutas
│   └── dashboard/        # Dashboard principal
├── types/
│   └── delivery.ts       # Tipos TypeScript
└── .env.local            # Variables de entorno (no committear)
```

## 🔐 Seguridad

- ✅ **API Keys en servidor**: Todas las keys están en variables de entorno del servidor
- ✅ **Sin exposición al cliente**: Las API keys NUNCA se envían al navegador
- ✅ **Validación de datos**: Todas las entradas se validan antes de procesar
- ✅ **Manejo de errores**: Errores capturados y mensajes descriptivos
- ⚠️ **Restricciones de Google Cloud**: Configura restricciones de IP y API en Google Cloud Console

## 🐛 Solución de Problemas

### Error: "GOOGLE_MAPS_API_KEY no está configurada"

- Verifica que `.env.local` existe y contiene `GOOGLE_MAPS_API_KEY`
- Reinicia el servidor de desarrollo después de añadir variables de entorno

### Error: "REQUEST_DENIED" en geocodificación

- Verifica que la Geocoding API está habilitada en Google Cloud Console
- Verifica que tu API key tiene permisos para usar Geocoding API
- Revisa las restricciones de tu API key

### Error: "ZERO_RESULTS" en geocodificación

- La dirección no se encontró. Verifica que sea válida
- Prueba añadiendo más detalles (ciudad, código postal, etc.)

### Entregas sin coordenadas en optimización

- Primero geocodifica las direcciones usando `/api/geocode`
- Asegúrate de que todas las entregas tengan `lat` y `lng` antes de optimizar

## 📖 Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding)
- [Google Route Optimization API](https://developers.google.com/maps/documentation/route-optimization)
- [Mistral AI Docs](https://docs.mistral.ai/)

## 📝 Licencia

Este proyecto está basado en el [Next.js App Router Course](https://nextjs.org/learn).
