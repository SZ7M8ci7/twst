/** Validate locally before importing any recognition/OCR code or downloading data. */
export async function validateScreenshot(file: File): Promise<void> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size < 12 || file.size > 30_000_000) throw new Error('Unsupported image');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(file.type === 'image/png' ? png : file.type === 'image/jpeg' ? jpeg : webp)) throw new Error('Image format mismatch');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width * bitmap.height > 24_000_000 || Math.max(bitmap.width, bitmap.height) > 24000) throw new Error('Image dimensions too large');
  } finally { bitmap.close(); }
}
