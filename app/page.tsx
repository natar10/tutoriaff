'use client';

import { useState } from 'react';
import { lusitana } from '@/app/ui/fonts';
import { generateCompleteRouteLink } from '@/app/lib/google-maps';
import { RawDelivery } from './api/ocr/route';

// Interfaces para el modelo de datos
interface Delivery extends RawDelivery {
  direccionCompleta?: string;
  lat?: number;
  lng?: number;
}

interface DeliveryRoute {
  fecha: string;
  conductor: string;
  entregas: Delivery[];
}

interface OptimizedDelivery extends Delivery {
  orderIndex: number;
  distanceFromPrevious?: number;
  estimatedArrival?: string;
}

interface OptimizedRoute {
  optimizedDeliveries: OptimizedDelivery[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  estimatedCost: number;
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [deliveryData, setDeliveryData] = useState<DeliveryRoute | null>(null);
  const [error, setError] = useState<string>('');
  const [processingMethod, setProcessingMethod] = useState<string>('');
  const [pdfInfo, setPdfInfo] = useState<any>(null);

  // Estados para la optimización de rutas
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [routeError, setRouteError] = useState<string>('');
  const [isDeliveryListCollapsed, setIsDeliveryListCollapsed] = useState(false);

  // Función para corregir caracteres especiales corruptos
  const fixCorruptedCharacters = (text: string): string => {
    const corrections: Array<[string, string]> = [
      ['\u00C3\u00B1', '\u00F1'], // Ã± -> ñ
      ['\u00C3\u00B3', '\u00F3'], // Ã³ -> ó
      ['\u00C3\u00A1', '\u00E1'], // Ã¡ -> á
      ['\u00C3\u00A9', '\u00E9'], // Ã© -> é
      ['\u00C3\u00BA', '\u00FA'], // Ãº -> ú
      ['\u00C3\u00AD', '\u00ED'], // Ã­ -> í
      ['\u00C3\u0081', '\u00C1'], // ÃÁ -> Á
      ['\u00C3\u0089', '\u00C9'], // Ã‰ -> É
      ['\u00C3\u008D', '\u00CD'], // ÃÍ -> Í
      ['\u00C3\u0093', '\u00D3'], // Ã" -> Ó
      ['\u00C3\u009A', '\u00DA'], // Ãš -> Ú
      ['\u00C3\u0091', '\u00D1'], // Ã' -> Ñ
    ];

    let correctedText = text;
    corrections.forEach(([corrupted, correct]) => {
      correctedText = correctedText.split(corrupted).join(correct);
    });

    return correctedText;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (selectedFile && validTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      setError('');
      setExtractedText('');
      setDeliveryData(null);
      setProcessingMethod('');
      setPdfInfo(null);
    } else {
      setError('Por favor seleccione un archivo válido (JPEG, PNG o PDF)');
      setFile(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    setError('');
    setExtractedText('');
    setDeliveryData(null);
    setOptimizedRoute(null); // Limpiar ruta anterior
    setRouteError('');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Corregir caracteres especiales en el texto extraído
      const correctedText = fixCorruptedCharacters(result.text);
      setExtractedText(correctedText);
      setProcessingMethod(result.method || '');
      setPdfInfo(result.info || null);

      // Intentar parsear los datos estructurados si vienen en el response
      if (result.deliveryData) {
        setDeliveryData(result.deliveryData);
      }

      // Log para debugging
      if (result.method) {
        console.log('Método de procesamiento:', result.method);
        if (result.note) {
          console.log('Nota:', result.note);
        }
        if (result.info) {
          console.log('Info del PDF:', result.info);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al procesar el PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para generar la ruta optimizada
  const handleGenerateRoute = async () => {
    if (!deliveryData || !deliveryData.entregas || deliveryData.entregas.length === 0) {
      setRouteError('No hay entregas para optimizar');
      return;
    }

    setIsGeneratingRoute(true);
    setRouteError('');
    setOptimizedRoute(null);

    try {
      // Paso 1: Crear array de direcciones para geocodificación
      // Formato: "Calle Número, Sector, CP"
      const addresses = deliveryData.entregas.map((entrega) => {
        const parts = [
          `${entrega.calle}`.trim(),
          entrega.ciudad,
          entrega.cp,
        ].filter(Boolean);
        return parts.join(', ');
      });

      console.log('[Generar Ruta] Geocodificando', addresses.length, 'direcciones...');

      // Paso 2: Llamar a /api/geocode
      const geocodeResponse = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses }),
      });

      if (!geocodeResponse.ok) {
        throw new Error('Error al geocodificar las direcciones');
      }

      const geocodeData = await geocodeResponse.json();
      console.log('[Generar Ruta] Geocodificación completa:', geocodeData);

      // Verificar que todas las direcciones se geocodificaron
      if (geocodeData.summary.failed > 0) {
        setRouteError(
          `No se pudieron geocodificar ${geocodeData.summary.failed} de ${geocodeData.summary.total} direcciones`
        );
      }

      // Paso 3: Combinar entregas con coordenadas
      const deliveriesWithCoords = deliveryData.entregas.map((entrega, index) => {
        const geocoded = geocodeData.results[index];
        return {
          ...entrega,
          lat: geocoded.lat,
          lng: geocoded.lng,
          direccionCompleta: geocoded.formattedAddress,
        };
      });

      // Filtrar solo las que tienen coordenadas
      const validDeliveries = deliveriesWithCoords.filter((d) => d.lat && d.lng);

      if (validDeliveries.length === 0) {
        throw new Error('No se pudo geocodificar ninguna dirección');
      }

      console.log('[Generar Ruta] Optimizando', validDeliveries.length, 'entregas...');

      // Paso 4: Obtener ubicación del almacén desde variables de entorno
      const warehouseLocation = {
        lat: parseFloat(process.env.NEXT_PUBLIC_WAREHOUSE_LAT || '41.599159'),
        lng: parseFloat(process.env.NEXT_PUBLIC_WAREHOUSE_LNG || '-4.673977'),
      };

      // Paso 5: Llamar a /api/optimize
      const optimizeResponse = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveries: validDeliveries,
          warehouseLocation,
        }),
      });

      if (!optimizeResponse.ok) {
        const errorData = await optimizeResponse.json();
        throw new Error(errorData.error || 'Error al optimizar la ruta');
      }

      const optimizedData = await optimizeResponse.json();
      console.log('[Generar Ruta] Optimización completa:', optimizedData);

      // Paso 6: Guardar la ruta optimizada
      setOptimizedRoute(optimizedData);
    } catch (err) {
      console.error('[Generar Ruta] Error:', err);
      setRouteError(err instanceof Error ? err.message : 'Error al generar la ruta');
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  return (
    <main className="mx-auto pt-4 px-1 overflow-x-hidden">
      <h1 className={`${lusitana.className} mb-2 text-3xl font-bold text-center`}>
        Sistema de Digitalización de Rutas de Entrega
      </h1>
      <p className="text-center text-gray-600 mb-8">
        Procesamiento OCR de manifiestos de entrega con corrección automática de caracteres
      </p>

      <div className="rounded-lg bg-gray-50 p-2 shadow-sm mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="file-upload"
              className="mb-2 block text-sm font-medium"
            >
              Seleccione el manifiesto de ruta (JPEG, PNG o PDF)
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="block w-full rounded-md border border-gray-200 py-2 px-3 text-sm outline-2 placeholder:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Formatos soportados: JPEG, PNG, PDF
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || isProcessing}
            className="flex w-full items-center justify-center rounded-md bg-blue-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isProcessing ? 'Procesando manifiesto...' : 'Digitalizar Hoja de Ruta'}
          </button>
        </form>
      </div>

      {extractedText && (
        <div className="rounded-lg bg-gray-50 p-2 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`${lusitana.className} text-xl`}>
              Resultados de la Digitalización
            </h2>
            {processingMethod && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  processingMethod === 'direct_extraction'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {processingMethod === 'direct_extraction'
                  ? 'Extracción Directa'
                  : 'Procesamiento OCR'}
              </span>
            )}
          </div>

          {pdfInfo && (
            <div className="mb-4 rounded-md bg-white p-3">
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Información del Documento
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Archivo:</span> {pdfInfo.title}
                </div>
                <div>
                  <span className="font-medium">Tipo:</span> {pdfInfo.author}
                </div>
                {pdfInfo.pages && (
                  <div>
                    <span className="font-medium">Páginas:</span> {pdfInfo.pages}
                  </div>
                )}
              </div>
            </div>
          )}

          {deliveryData && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
              <h3 className={`${lusitana.className} mb-3 text-lg text-blue-900`}>
                Información de la Ruta
              </h3>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded bg-white p-3 shadow-sm">
                  <span className="text-sm text-gray-600">Fecha:</span>
                  <p className="text-lg font-semibold">{deliveryData.fecha}</p>
                </div>
                <div className="rounded bg-white p-3 shadow-sm">
                  <span className="text-sm text-gray-600">Conductor/Sección:</span>
                  <p className="text-lg font-semibold">{deliveryData.conductor}</p>
                </div>
              </div>
              <div className="rounded bg-white p-3 shadow-sm">
                <span className="text-sm text-gray-600">Total de entregas:</span>
                <p className="text-2xl font-semibold text-blue-600">
                  {deliveryData.entregas.length}
                </p>
              </div>
            </div>
          )}

          {deliveryData && deliveryData.entregas && deliveryData.entregas.length > 0 ? (
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-3">
                <h3 className={`${lusitana.className} text-lg text-gray-800`}>
                  Lista de Entregas ({deliveryData.entregas.length})
                </h3>
              </div>
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={() => setIsDeliveryListCollapsed(!isDeliveryListCollapsed)}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-300"
                >
                  {isDeliveryListCollapsed ? 'Expandir' : 'Minimizar'}
                </button>
                <button
                  onClick={() => {
                    const text = deliveryData.entregas
                      .map((e, i) => {
                        const parts = [
                          `${i + 1}. ${e.calle}`,
                          e.ciudad,
                          e.cp,
                          e.personaContacto ? `Cliente: ${e.personaContacto}` : '',
                          e.telefono ? `Tel: ${e.telefono}` : '',
                          e.ubicacionNave ? `Coord: ${e.ubicacionNave}` : '',
                          e.blts ? `Bultos: ${e.blts}` : '',
                        ].filter(Boolean);
                        return parts.join(' | ');
                      })
                      .join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                  className="rounded-md bg-green-200 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300"
                >
                  Copiar Rutas en Texto
                </button>
              </div>
              <div className="mb-4 flex items-center gap-3">
                <p>
                  Una vez que muestre la Lista de Entregas, 
                  para generar la ruta optimizada haz click 
                  en el botón "GENERAR RUTA" al final de esta sección.
                  Puedes minimizar esta lista para mejor visualizacion.
                </p>
              </div>
              <div className={`grid grid-cols-1 gap-4 ${isDeliveryListCollapsed ? 'hidden' : ''}`}>
                {deliveryData.entregas.map((entrega, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Dirección principal */}
                    <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <h4 className="text-lg font-bold text-gray-900">
                        {entrega.calle}
                      </h4>
                      <h4 className="text-lg font-bold text-gray-900">
                        | zipcode: {entrega.cp}
                      </h4>
                      <h4 className="text-lg font-bold text-gray-900">
                        | <span className="font-medium">Cliente:</span> {entrega.personaContacto}
                      </h4>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {entrega.ciudad}
                      </p>
                    </div>

                    {/* Ubicación */}
                    {entrega.ubicacionNave && (
                      <p className="mb-3 text-md text-gray-700">
                        <b>Coordenada: </b> {entrega.ubicacionNave} | <b>Bultos: </b>{entrega.blts}
                      </p>
                    )}

                    {/* Teléfono y WhatsApp */}
                    {entrega.telefono && (
                      <div className="mb-3 flex gap-2">
                        <a
                          href={`tel:${entrega.telefono.replace(/\s/g, '')}`}
                          className="flex gap-2"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          <b>{entrega.telefono}</b>
                        </a>
                      </div>
                    )}

                    {/* Código */}
                    <div className="border-t border-gray-200 pt-2">
                      <p className="text-md text-gray-400">
                        Código ID:{' '}
                        <span className="font-mono font-medium text-gray-600">
                          {entrega.id}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-md bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Texto Extraído (con corrección de caracteres)
                </h3>
                <button
                  onClick={() => {
                    const elem = document.getElementById('extracted-text');
                    if (elem) {
                      elem.classList.toggle('max-h-96');
                      elem.classList.toggle('max-h-full');
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Expandir/Contraer
                </button>
              </div>
              <pre
                id="extracted-text"
                className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-gray-800 transition-all"
              >
                {extractedText}
              </pre>
            </div>
          )}

          {deliveryData && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleGenerateRoute}
                disabled={isGeneratingRoute}
                className="rounded-lg bg-green-600 px-4 py-2 text-lg font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isGeneratingRoute ? 'Generando ruta...' : 'GENERAR RUTA'}
              </button>
            </div>
          )}

          {/* Error de generación de ruta */}
          {routeError && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error al generar la ruta</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{routeError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ruta optimizada */}
          {optimizedRoute && (
            <div className="mt-6 rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-bold text-gray-800">Ruta Optimizada</h2>


              {/* Botón de Ruta Completa en Google Maps */}
              {(() => {
                const warehouseLat = parseFloat(process.env.NEXT_PUBLIC_WAREHOUSE_LAT || '41.6523');
                const warehouseLng = parseFloat(process.env.NEXT_PUBLIC_WAREHOUSE_LNG || '-4.7245');

                const waypoints = optimizedRoute.optimizedDeliveries
                  .filter((d) => d.lat !== undefined && d.lng !== undefined)
                  .map((d) => ({ lat: d.lat!, lng: d.lng! }));

                const routeLinks = generateCompleteRouteLink(waypoints, warehouseLat, warehouseLng);
                const isMultipleRoutes = Array.isArray(routeLinks);

                return (
                  <div className="mb-6">
                    {isMultipleRoutes ? (
                      <div>
                        <p className="mb-3 text-sm text-gray-600">
                          Tienes {optimizedRoute.optimizedDeliveries.length} entregas. Google Maps
                          permite máximo 9 paradas por ruta, por lo que se han dividido en{' '}
                          {routeLinks.length} rutas:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {routeLinks.map((link, index) => (
                            <a
                              key={index}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                              </svg>
                              Ruta {index + 1} en Google Maps
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <a
                        href={routeLinks}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        Abrir Ruta Completa en Google Maps
                      </a>
                    )}
                  </div>
                );
              })()}

              {/* Lista de entregas en orden */}
              <div className="space-y-3">
                <h3 className="mb-3 text-lg font-semibold text-gray-700">
                  Orden de Entregas ({optimizedRoute.optimizedDeliveries.length})
                </h3>
                {optimizedRoute.optimizedDeliveries.map((entrega) => (
                  <div
                    key={entrega.id}
                    className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                  >
                    {/* Información de la entrega */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      
                      <div className="grid grid-cols-12 gap-4">
                        {/* Número de orden */}
                        <div className="col-span-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                          {entrega.orderIndex}
                        </div>
                        <div className="col-span-10 break-words">
                          <h4 className="break-words font-semibold text-gray-800">
                            {entrega.personaContacto}
                          </h4>
                          <p className="break-words text-sm text-gray-600">
                            {entrega.calle}
                          </p>
                          <p className="break-words text-sm text-gray-600">
                            {entrega.ciudad}
                          </p>
                          <p className="break-words text-sm text-gray-500">
                            {entrega.cp}
                          </p>
                          <h4 className="font-semibold text-gray-800">
                            ID: {entrega.id}
                          </h4>
                          <h4 className="font-semibold text-gray-800">
                            Coord: {entrega.ubicacionNave} | Bultos: {entrega.blts}
                          </h4>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Botón de Google Maps individual */}
                        {entrega.lat !== undefined && entrega.lng !== undefined && (
                          <a
                            href={`https://www.google.com/maps?q=${entrega.lat},${entrega.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            Maps
                          </a>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Botones de contacto */}
                        {entrega.telefono && (
                          <div className="flex gap-4">
                            <a
                              href={`tel:${entrega.telefono.replace(/\s/g, '')}`}
                              className="flex w-full justify-center rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              Llamar
                            </a>
                            <a
                              href={`https://wa.me/${entrega.telefono.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex w-full justify-center rounded-md bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                            >
                              WhatsApp
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        {entrega.estimatedArrival && (
                          <span>
                            Llegada estimada:{' '}
                            {new Date(entrega.estimatedArrival).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
