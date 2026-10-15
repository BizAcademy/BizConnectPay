import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import ejs from 'ejs';
import { imageVariant, variantWidth } from '../src-server/image-variants.js';
import { createMediaRouter } from '../src-server/media-routes.js';

test('Responsive image sizes, single-flight cache and unchanged originals', async () => {
  const original = await sharp({ create: { width: 2400, height: 1600, channels: 4, background: '#0066ff' } }).png().toBuffer();
  const before = Buffer.from(original);
  let reads = 0;
  const read = async () => { reads++; return original; };
  const media = { id: 'unit-1', mime: 'image/png' };
  const [first, second] = await Promise.all([imageVariant(media, 480, read), imageVariant(media, 480, read)]);
  assert.equal(reads, 1);
  assert.strictEqual(first, second);
  assert.ok(first.data.length < original.length);
  assert.equal(first.mime, 'image/webp');
  const metadata = await sharp(first.data).metadata();
  assert.equal(metadata.width, 480);
  assert.equal(metadata.height, 320);
  assert.deepEqual(original, before);
  await imageVariant(media, 480, read);
  assert.equal(reads, 1);
  console.log(`Fixture: ${original.length} → ${first.data.length} bytes (${Math.round(100 - first.data.length / original.length * 100)}% smaller).`);
});

test('Only bounded widths; GIF animations and videos are unchanged', () => {
  assert.equal(variantWidth('800', 'image/jpeg'), 800);
  assert.equal(variantWidth(undefined, 'image/png'), null);
  assert.equal(variantWidth('480', 'image/gif'), null);
  assert.equal(variantWidth('480', 'video/mp4'), null);
  for (const invalid of ['99999', '0800', ['800'], {}, '0']) {
    assert.throws(() => variantWidth(invalid, 'image/png'), { status: 400 });
  }
});

test('Image HTTP variants: content type, immutable cache, 304, HEAD, Range and originals', async () => {
  const original = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#00d4ff' } }).png().toBuffer();
  let blobs = 0;
  const fakePool = { async execute(sql, values) {
    if (sql.startsWith('SELECT id,')) return [[{ id: '9501', mime: 'image/png', size: original.length, created_at: new Date('2026-01-01') }]];
    blobs++;
    if (sql.startsWith('SELECT data')) return [[{ data: original }]];
    return [[{ bytes: original.subarray(values[0] - 1, values[0] - 1 + values[1]) }]];
  } };
  const app = express();
  app.use('/media', createMediaRouter(() => fakePool));
  app.use((error, req, res, next) => res.status(error.status || 500).end());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/media/9501`;
  try {
    let response = await fetch(url + '?w=480');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.match(response.headers.get('cache-control'), /immutable/);
    const etag = response.headers.get('etag');
    const data = Buffer.from(await response.arrayBuffer());
    assert.equal((await sharp(data).metadata()).width, 480);
    response = await fetch(url + '?w=480', { headers: { 'If-None-Match': etag } });
    assert.equal(response.status, 304);
    assert.equal(blobs, 1);
    response = await fetch(url + '?w=480', { method: 'HEAD' });
    assert.equal(Number(response.headers.get('content-length')), data.length);
    assert.equal(blobs, 1);
    response = await fetch(url + '?w=480', { headers: { Range: 'bytes=0-9' } });
    assert.equal(response.status, 206);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), data.subarray(0, 10));
    response = await fetch(url);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), original);
    assert.notEqual(response.headers.get('etag'), etag);
    response = await fetch(url + '?w=50000');
    assert.equal(response.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Hero gets priority, other images lazy-load and responsive URLs preserve base path', async () => {
  const filename = new URL('../views/partials/media.ejs', import.meta.url).pathname;
  const fixture = { m: { id: 42, mime: 'image/jpeg', kind: 'image', alt: 'Test' }, basePath: '/biz', cls: 'hero-media', style: '' };
  const hero = await ejs.renderFile(filename, fixture);
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /fetchpriority="high"/);
  assert.match(hero, /srcset="\/biz\/media\/42\?w=480/);
  const product = await ejs.renderFile(filename, { ...fixture, cls: '' });
  assert.match(product, /loading="lazy"/);
  const gif = await ejs.renderFile(filename, { ...fixture, m: { ...fixture.m, mime: 'image/gif' } });
  assert.ok(!gif.includes('srcset'));
});
