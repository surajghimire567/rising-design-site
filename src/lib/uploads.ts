const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_TYPE = 'application/pdf';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const HARD_MAX_BYTES = 20 * 1024 * 1024;

export function maxUploadBytes(value?: string) {
  const configured = Number(value);
  if (!Number.isSafeInteger(configured) || configured < 1) return DEFAULT_MAX_BYTES;
  return Math.min(configured, HARD_MAX_BYTES);
}

export async function validFile(file: File, allowed: 'image' | 'pdf' | 'image-or-pdf', maxBytes: number) {
  if (!file.size || file.size > maxBytes) return false;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const isJpeg = starts(0xff, 0xd8, 0xff);
  const isPng = starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const isWebp = starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  const isPdf = starts(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (allowed === 'image') return IMAGE_TYPES.has(file.type) && (isJpeg || isPng || isWebp);
  if (allowed === 'pdf') return file.type === PDF_TYPE && isPdf;
  return (IMAGE_TYPES.has(file.type) && (isJpeg || isPng || isWebp)) || (file.type === PDF_TYPE && isPdf);
}

export function cleanFilename(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-100) || 'upload';
}

export async function storeFile(bucket: R2Bucket, file: File, folder: string) {
  const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${cleanFilename(file.name)}`;
  await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}
