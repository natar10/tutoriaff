'use client';

import { useState } from 'react';
import { lusitana } from '@/app/ui/fonts';

// Interfaces para el modelo de datos
interface Delivery {
  codigo: string;
  articulo: string;
  calle: string;
  numero: string;
  sector: string;
  ubicacion: string;
  cliente: string;
  telefono: string;
  direccionCompleta?: string;
}

interface DeliveryRoute {
  fecha: string;
  conductor: string;
  entregas: Delivery[];
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [deliveryData, setDeliveryData] = useState<DeliveryRoute | null>(null);
  const [error, setError] = useState<string>('');
  const [processingMethod, setProcessingMethod] = useState<string>('');
  const [pdfInfo, setPdfInfo] = useState<any>(null);

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

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className={`${lusitana.className} mb-2 text-3xl font-bold text-center`}>
        Sistema de Digitalización de Rutas de Entrega
      </h1>
      <p className="text-center text-gray-600 mb-8">
        Procesamiento OCR de manifiestos de entrega con corrección automática de caracteres
      </p>

      <div className="rounded-lg bg-gray-50 p-6 shadow-sm mb-6">
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
        <div className="rounded-lg bg-gray-50 p-6 shadow-sm">
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
            <div className="mb-4">
              <h3 className={`${lusitana.className} mb-4 text-lg text-gray-800`}>
                Lista de Entregas ({deliveryData.entregas.length})
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {deliveryData.entregas.map((entrega, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Dirección principal */}
                    <div className="mb-2">
                      <h4 className="text-lg font-bold text-gray-900">
                        {entrega.calle} {entrega.numero}
                      </h4>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {entrega.sector}
                      </p>
                    </div>

                    {/* Ubicación */}
                    {entrega.ubicacion && (
                      <p className="mb-3 text-sm text-gray-700">
                        📍 {entrega.ubicacion}
                      </p>
                    )}

                    {/* Cliente */}
                    {entrega.cliente && (
                      <p className="mb-2 text-sm text-gray-600">
                        <span className="font-medium">Cliente:</span> {entrega.cliente}
                      </p>
                    )}

                    {/* Artículo */}
                    {entrega.articulo && (
                      <p className="mb-3 line-clamp-2 text-xs text-gray-500">
                        {entrega.articulo}
                      </p>
                    )}

                    {/* Teléfono y WhatsApp */}
                    {entrega.telefono && (
                      <div className="mb-3 flex gap-2">
                        <a
                          href={`tel:${entrega.telefono.replace(/\s/g, '')}`}
                          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          Llamar
                        </a>
                        <a
                          href={`https://wa.me/${entrega.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp
                        </a>
                      </div>
                    )}

                    {/* Código */}
                    <div className="border-t border-gray-200 pt-2">
                      <p className="text-xs text-gray-400">
                        Código:{' '}
                        <span className="font-mono font-medium text-gray-600">
                          {entrega.codigo}
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
            <div className="mt-4">
              <button
                onClick={() => {
                  const json = JSON.stringify(deliveryData, null, 2);
                  const blob = new Blob([json], {
                    type: 'application/json;charset=utf-8',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ruta-${deliveryData.fecha}-${deliveryData.conductor}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Exportar JSON
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
