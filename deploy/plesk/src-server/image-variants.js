import sharp from 'sharp';
import { httpError } from './security.js';

export const imageWidths = [480, 800, 1280, 1920];
const supported = new Set(['image/jpeg', 'image/png', 'image/webp']);
const cache = new Map();
const pending = new Map();
const waiting = [];
let bytes = 0;
let active = 0;
const MAX_BYTES = 48 * 1024 * 1024;

// Bound decoded-image memory and CPU work even if many visitors arrive together.
async function acquire() {
  if (active < 2) { active++; return; }
  if (waiting.length >= 12) throw httpError(503, 'Optimisation occupée. Réessayez dans quelques instants.');
  await new Promise(resolve => waiting.push(resolve));
}
function release() {
  if (waiting.length) waiting.shift()();
  else active--;
}

export function variantWidth(value, mime) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !imageWidths.map(String).includes(value)) {
    throw httpError(400, 'Largeur d’image non autorisée.');
  }
  // GIF animations and video bytes must never be flattened or transcoded here.
  return supported.has(mime) ? Number(value) : null;
}

export async function imageVariant(media, width, readOriginal) {
  const key = `${media.id}:${width}:webp-v1`;
  if (cache.has(key)) {
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    await acquire();
    try {
      const original = await readOriginal();
      let result;
      try {
        const image = sharp(original, { limitInputPixels: 40000000, sequentialRead: true });
        const metadata = await image.metadata();
        if (metadata.pages > 1) {
          result = { data: original, mime: media.mime };
        } else {
          const output = await image.rotate().resize({ width, withoutEnlargement: true })
            .webp({ quality: 82, alphaQuality: 90, effort: 3 })
            .timeout({ seconds: 10 }).toBuffer();
          result = output.length < original.length
            ? { data: output, mime: 'image/webp' }
            : { data: original, mime: media.mime };
        }
      } catch (error) {
        // Keep an already-published image usable if its decoder rejects it.
        console.warn('Image optimisation unavailable; original served.', { id: media.id, code: error.code || 'DECODE_FAILED' });
        result = { data: original, mime: media.mime };
      }
      while (cache.size && (bytes + result.data.length > MAX_BYTES || cache.size >= 80)) {
        const oldest = cache.keys().next().value;
        bytes -= cache.get(oldest).data.length;
        cache.delete(oldest);
      }
      if (result.data.length <= MAX_BYTES) {
        cache.set(key, result);
        bytes += result.data.length;
      }
      return result;
    } finally { release(); }
  })();
  pending.set(key, job);
  try { return await job; }
  finally { pending.delete(key); }
}
