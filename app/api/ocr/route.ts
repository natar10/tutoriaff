import { NextRequest, NextResponse } from 'next/server';

// Interfaces para el modelo de datos
interface Delivery {
  codigo: string;
  articulo: string;
  calle: string;
  numero: string;
  sector: string;
  cp: string;
  ubicacion: string;
  cliente: string;
  telefono: string;
}

interface DeliveryRoute {
  fecha: string;
  conductor: string;
  entregas: Delivery[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Verificar que la API key esté configurada
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'MISTRAL_API_KEY no está configurada en las variables de entorno' },
        { status: 500 }
      );
    }

    // Determinar extensión del archivo
    let fileExtension = 'pdf';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      fileExtension = 'jpg';
    } else if (file.type === 'image/png') {
      fileExtension = 'png';
    }

    // Paso 1: Subir el archivo a Mistral
    const uploadFormData = new FormData();
    uploadFormData.append('file', file, `uploaded_file.${fileExtension}`);
    uploadFormData.append('purpose', 'ocr');

    const uploadResponse = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => null);
      console.error('Error al subir archivo a Mistral:', errorData);
      return NextResponse.json(
        {
          error: 'Error al subir archivo a Mistral API',
          details: errorData,
        },
        { status: uploadResponse.status }
      );
    }

    const uploadedFile = await uploadResponse.json();
    const fileId = uploadedFile.id;

    // Paso 2: Obtener la URL firmada del archivo
    const signedUrlResponse = await fetch(
      `https://api.mistral.ai/v1/files/${fileId}/url`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!signedUrlResponse.ok) {
      const errorData = await signedUrlResponse.json().catch(() => null);
      console.error('Error al obtener URL firmada:', errorData);
      return NextResponse.json(
        {
          error: 'Error al obtener URL firmada de Mistral',
          details: errorData,
        },
        { status: signedUrlResponse.status }
      );
    }

    const signedUrlData = await signedUrlResponse.json();
    const documentUrl = signedUrlData.url;

    // Paso 3: Procesar OCR
    const ocrResponse = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        document: {
          type: 'document_url',
          document_url: documentUrl,
        },
        model: 'mistral-ocr-latest',
        include_image_base64: true,
      }),
    });

    if (!ocrResponse.ok) {
      const errorData = await ocrResponse.json().catch(() => null);
      console.error('Error en OCR de Mistral:', errorData);
      return NextResponse.json(
        {
          error: 'Error al procesar OCR con Mistral API',
          details: errorData,
        },
        { status: ocrResponse.status }
      );
    }

    const ocrResult = await ocrResponse.json();

    // Combinar el markdown de todas las páginas
    const allMarkdown = ocrResult.pages?.map((page: any) => page.markdown).join('\n') || '';

    // Paso 4: Obtener respuesta en formato texto para mostrar
    const chatResponseText = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: "A continuación tienes un manifiesto de ruta de entrega de paquetes escaneado. " +
              "Extrae la siguiente información de forma estructurada:\n\n" +
              "1. ENCABEZADO (busca en la parte superior del documento):\n" +
              "   - Fecha de la ruta (puede estar en formato DD/MM/YYYY o similar)\n" +
              "   - Nombre del conductor o sección (ejemplo: 'ARTURO', puede estar en mayúsculas)\n\n" +
              "2. TABLA DE ENTREGAS (extrae TODAS las filas de la tabla con estas columnas):\n" +
              "   - Código: código del paquete/pedido\n" +
              "   - Artículo: descripción del producto\n" +
              "   - Calle: nombre de la calle\n" +
              "   - Número: número de la dirección\n" +
              "   - Sector: sector o zona\n" +
              "   - CP: código postal\n" +
              "   - Ubicación: ubicación adicional\n" +
              "   - Cliente: nombre del cliente\n" +
              "   - Teléfono: número de teléfono\n\n" +
              "IMPORTANTE: Si encuentras caracteres corruptos tipo 'Ã±', 'Ã³', 'Ã¡', etc., " +
              "corrígelos a sus equivalentes correctos: ñ, ó, á, etc.\n\n" +
              "FORMATO DE SALIDA:\n" +
              "Presenta la información de forma clara y legible, primero el encabezado " +
              "y luego una tabla con todas las entregas. Mantén el formato tabular para facilitar " +
              "la conversión a CSV o Excel posteriormente."
          },
          {
            role: 'user',
            content: allMarkdown
          }
        ],
      }),
    });

    if (!chatResponseText.ok) {
      const errorData = await chatResponseText.json().catch(() => null);
      console.error('Error en chat completion (texto):', errorData);
    }

    const textData = await chatResponseText.json();
    const extractedText = textData.choices?.map((choice: any) => choice.message.content).join('\n') || '';

    // Paso 5: Obtener respuesta en formato JSON estructurado
    const chatResponseJSON = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: "A continuación tienes un manifiesto de ruta de entrega de paquetes escaneado. " +
              "Extrae TODA la información y retorna un objeto JSON con esta estructura EXACTA:\n\n" +
              "{\n" +
              '  "fecha": "fecha de la ruta extraída del documento",\n' +
              '  "conductor": "nombre del conductor o sección extraído del documento",\n' +
              '  "entregas": [\n' +
              "    {\n" +
              '      "codigo": "código del paquete",\n' +
              '      "articulo": "descripción del producto",\n' +
              '      "calle": "nombre de la calle",\n' +
              '      "numero": "número de dirección",\n' +
              '      "sector": "sector o zona",\n' +
              '      "cp": "código postal (columna CP)",\n' +
              '      "ubicacion": "ubicación adicional o referencia",\n' +
              '      "cliente": "nombre del cliente",\n' +
              '      "telefono": "número de teléfono"\n' +
              "    }\n" +
              "  ]\n" +
              "}\n\n" +
              "IMPORTANTE:\n" +
              "- Extrae TODAS las filas de entregas que encuentres en el documento\n" +
              "- Busca la columna 'CP' para el código postal\n" +
              "- Si encuentras caracteres corruptos tipo 'Ã±', 'Ã³', 'Ã¡', corrígelos a ñ, ó, á\n" +
              "- Si algún campo está vacío, usa una cadena vacía \"\"\n" +
              "- Retorna SOLO el objeto JSON, sin texto adicional ni markdown"
          },
          {
            role: 'user',
            content: allMarkdown
          }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    let deliveryData: DeliveryRoute | null = null;

    if (chatResponseJSON.ok) {
      const jsonData = await chatResponseJSON.json();
      try {
        const messageContent = jsonData.choices?.[0]?.message?.content;
        const jsonContent = typeof messageContent === 'string' ? messageContent : '{}';
        deliveryData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
      }
    } else {
      const errorData = await chatResponseJSON.json().catch(() => null);
      console.error('Error en chat completion (JSON):', errorData);
    }

    // Limpiar el archivo subido (opcional)
    try {
      await fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
    } catch (deleteError) {
      console.error('Error al eliminar archivo:', deleteError);
    }

    return NextResponse.json({
      text: extractedText,
      deliveryData,
      method: 'direct_extraction',
      pages: ocrResult.pages?.length || 0,
      info: {
        title: uploadedFile.filename || 'Unknown',
        author: uploadedFile.purpose || 'OCR',
        pages: ocrResult.pages?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error en el endpoint OCR:', error);
    return NextResponse.json(
      {
        error: 'Error al procesar el archivo',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
