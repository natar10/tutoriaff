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

#### Google Maps API Key y Service Account

**Paso 1: Crear proyecto y habilitar APIs**

1. Visita [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **ID del proyecto** (lo necesitarás después)
4. Habilita las siguientes APIs:
   - **Geocoding API**
   - **Route Optimization API**
   - **Maps JavaScript API** (opcional, para visualización)

**Paso 2: Crear API Key para Geocoding**

1. Ve a "Credenciales" → "Crear credenciales" → "Clave de API"
2. Copia la API key
3. **Configura restricciones de seguridad:**
   - En "Restricciones de aplicación": Selecciona "Direcciones IP"
   - Añade tu IP local y la IP de tu servidor de producción
   - En "Restricciones de API": Marca solo "Geocoding API"
4. Añade la key a `GOOGLE_MAPS_API_KEY` en `.env.local`

**Paso 3: Crear Service Account para Route Optimization**

⚠️ **IMPORTANTE**: Route Optimization API requiere autenticación OAuth2 con Service Account (no acepta API keys)

1. Ve a "IAM & Admin" → "Service Accounts"
2. Haz clic en "Create Service Account"
3. Dale un nombre descriptivo (ej: "route-optimization-service")
4. Asigna el rol: **"Cloud Optimization AI Editor"** o **"Editor"**
5. Haz clic en "Done"
6. En la lista de service accounts, haz clic en el que acabas de crear
7. Ve a la pestaña "Keys"
8. Haz clic en "Add Key" → "Create new key"
9. Selecciona formato **JSON** y haz clic en "Create"
10. Se descargará un archivo JSON - **¡GUÁRDALO DE FORMA SEGURA!**

**Paso 4: Configurar las variables de entorno**

Añade a tu archivo `.env.local`:

```env
# ID del proyecto (del paso 1)
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto-id

# API Key (del paso 2)
GOOGLE_MAPS_API_KEY=tu_api_key

# Service Account Credentials (del paso 3)
# Abre el archivo JSON descargado, copia TODO su contenido y pégalo aquí en UNA SOLA LÍNEA
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
```

**⚠️ SEGURIDAD CRÍTICA:**
- **NUNCA** subas el archivo JSON del service account a Git
- **NUNCA** compartas las credenciales públicamente
- Añade `*.json` a tu `.gitignore` si guardas el archivo localmente
- En producción, usa variables de entorno secretas (Vercel Secrets, etc.)

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

### Error: "API keys are not supported by this API" en Route Optimization

- Route Optimization API **requiere OAuth2** con service account
- Verifica que `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` esté configurada correctamente
- El JSON debe estar en una sola línea, sin saltos de línea adicionales
- Verifica que el service account tenga el rol "Cloud Optimization AI Editor"

### Error: "Error al obtener access token" o "invalid_grant"

- Verifica que el JSON del service account esté completo y sin modificar
- Asegúrate de que las claves `\n` dentro de `private_key` se mantengan como texto literal
- Si copias desde Windows, algunos editores pueden corromper los saltos de línea
- El formato correcto de `private_key` debe ser: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`

## 📖 Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding)
- [Google Route Optimization API](https://developers.google.com/maps/documentation/route-optimization)
- [Mistral AI Docs](https://docs.mistral.ai/)

## 📝 Licencia

Este proyecto está basado en el [Next.js App Router Course](https://nextjs.org/learn).
