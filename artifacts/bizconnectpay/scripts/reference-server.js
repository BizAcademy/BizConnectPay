import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Temporary reference renderer: the original document is not rewritten on disk.
const source = readFileSync(fileURLToPath(new URL('../../../.local/conversation-workspace/files/attached_assets/bizconnectpay_1791899704159.html', import.meta.url)), 'utf8');
http.createServer((req, res) => {
  const theme = new URL(req.url, 'http://localhost').searchParams.get('theme');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(['light', 'dark'].includes(theme)
    ? source.replace('<html lang="fr">', `<html lang="fr" data-theme="${theme}">`)
    : source);
}).listen(Number(process.env.PORT), '0.0.0.0');
