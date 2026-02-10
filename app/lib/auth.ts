import { NextRequest, NextResponse } from 'next/server';

/**
 * Valida el código de acceso enviado en el header x-access-code.
 * Retorna null si es válido, o un NextResponse 401 si no lo es.
 */
export function validateAccessCode(request: NextRequest): NextResponse | null {
  const code = request.headers.get('x-access-code');
  const expected = process.env.APP_ACCESS_CODE;

  if (!expected) {
    // Si no hay código configurado, permitir todo (desarrollo sin protección)
    return null;
  }

  if (code !== expected) {
    return NextResponse.json(
      { error: 'Código de acceso inválido' },
      { status: 401 }
    );
  }

  return null;
}
