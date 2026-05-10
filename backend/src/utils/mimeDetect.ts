import { fileTypeFromBuffer } from 'file-type'

export type AcceptedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'

const ALLOWED_MIMES: AcceptedMime[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]

export async function detectMime(buffer: Buffer): Promise<AcceptedMime> {
  const result = await fileTypeFromBuffer(buffer)
  if (!result || !ALLOWED_MIMES.includes(result.mime as AcceptedMime)) {
    throw new Error(`Tipo de arquivo não suportado: ${result?.mime ?? 'desconhecido'}. Use PDF, JPG, PNG ou WEBP.`)
  }
  return result.mime as AcceptedMime
}
