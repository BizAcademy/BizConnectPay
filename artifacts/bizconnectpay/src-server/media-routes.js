import express from 'express';
import { pool } from './database.js';
import { httpError } from './security.js';
import { imageVariant, variantWidth } from './image-variants.js';

export function parseRange(header, size) {
  if (!/^bytes=\d*-\d*$/.test(header)) return null;
  const [first, last] = header.slice(6).split('-');
  if (first === '' && last === '') return null;
  let start;
  let end;
  if (!first) {
    const suffix = Number(last);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(first);
    end = last ? Number(last) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    end = Math.min(end, size - 1);
  }
  if (start >= size || start > end || size <= 0) return null;
  return { start, end };
}

export function createMediaRouter(getPool = () => pool) {
const router = express.Router();
router.get('/:id', async (req, res) => {
  const pool = getPool();
  if (!pool) throw httpError(503, 'Les médias nécessitent une connexion MySQL.');
  if (!/^[1-9]\d{0,19}$/.test(req.params.id)) throw httpError(404, 'Média introuvable.');
  const [rows] = await pool.execute('SELECT id, mime, size, created_at FROM media WHERE id = ?', [req.params.id]);
  if (!rows.length) throw httpError(404, 'Média introuvable.');
  const media = rows[0];
  let size = Number(media.size);
  const width = variantWidth(req.query.w, media.mime);
  const etag = width ? `"bcp-media-${media.id}-w${width}-webp-v1"` : `"bcp-media-${media.id}"`;
  const modified = new Date(media.created_at).toUTCString();
  res.set({
    'Content-Type': media.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'Last-Modified': modified,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
  });
  // Conditional requests precede Range, per HTTP semantics.
  const inm = req.get('If-None-Match');
  if (inm && inm.split(',').map(value => value.trim().replace(/^W\//, '')).some(value => value === etag || value === '*')) {
    return res.status(304).end();
  }
  const ims = req.get('If-Modified-Since');
  if (!inm && ims && Date.parse(ims) >= Date.parse(modified)) return res.status(304).end();
  let variant;
  if (width) {
    variant = await imageVariant(media, width, async () => {
      const [originals] = await pool.execute('SELECT data FROM media WHERE id = ?', [req.params.id]);
      if (!originals.length) throw httpError(404, 'Média supprimé.');
      return originals[0].data;
    });
    size = variant.data.length;
    res.type(variant.mime);
  }
  let range = req.get('Range');
  const ifRange = req.get('If-Range');
  if (range && ifRange && ifRange !== etag && ifRange !== modified) range = undefined;
  let start = 0;
  let end = size - 1;
  if (range) {
    const parsed = parseRange(range, size);
    if (!parsed) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    ({ start, end } = parsed);
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  const length = end - start + 1;
  res.set('Content-Length', String(length));
  if (req.method === 'HEAD') return res.end();
  if (variant) return res.end(variant.data.subarray(start, end + 1));
  // Read only requested bytes from MySQL, not the entire video into memory.
  const [dataRows] = await pool.execute('SELECT SUBSTRING(data, ?, ?) AS bytes FROM media WHERE id = ?', [start + 1, length, req.params.id]);
  if (!dataRows.length) {
    res.removeHeader('Content-Length');
    res.removeHeader('Content-Range');
    res.removeHeader('Cache-Control');
    throw httpError(404, 'Média supprimé.');
  }
  return res.end(dataRows[0].bytes);
});
return router;
}
export const mediaRouter = createMediaRouter();
