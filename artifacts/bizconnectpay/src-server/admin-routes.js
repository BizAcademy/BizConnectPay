import express from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import { once } from 'node:events';
import path from 'node:path';
import { config } from './config.js';
import { pool, loadPublicData, replaceMedia, saveSettings } from './database.js';
import { slots, slotKeys, settingKeys, imageMimes, videoMimes } from './constants.js';
import { ensureCsrf, verifyCsrf, requireAdmin, passwordDigest, validEmail, validWebUrl, cleanPricing, httpError } from './security.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.ceil(Math.max(config.imageMaxMb, config.videoMaxMb) * 1024 * 1024),
    files: 1, fields: 4, fieldSize: 4096, parts: 5,
  },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7',
  legacyHeaders: false, skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).render('admin/login', {
    error: 'Trop de tentatives. Réessayez dans 15 minutes.',
  }),
});

function saveAndRedirect(req, res, url) {
  return new Promise((resolve, reject) => req.session.save(error => {
    if (error) return reject(error);
    res.redirect(303, `${config.basePath}${url}`);
    resolve();
  }));
}
function flash(req, message) { req.session.flash = { type: 'success', message }; }

export function createAdminRouter(passwordHash) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, ensureCsrf);

  router.get('/login', (req, res) => {
    if (req.session.admin) return res.redirect(`${config.basePath}/admin`);
    res.render('admin/login', { error: null });
  });
  router.post('/login', verifyCsrf, loginLimiter, async (req, res) => {
    const password = req.body.password;
    const valid = typeof password === 'string' && password.length <= 256 &&
      await bcrypt.compare(passwordDigest(password), passwordHash);
    if (!valid) return res.status(401).render('admin/login', { error: 'Mot de passe incorrect.' });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.admin = true;
    flash(req, 'Bienvenue dans votre espace administrateur.');
    await saveAndRedirect(req, res, '/admin');
  });
  router.use(requireAdmin);
  router.use((req, res, next) => {
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  });
  router.use(async (req, res, next) => {
    const data = await loadPublicData();
    Object.assign(res.locals, data, { pricingHtml: cleanPricing(data.pricingHtml) });
    const savedFlash = req.session.flash || null;
    if (savedFlash) delete req.session.flash;
    res.locals.flash = savedFlash;
    res.locals.slots = slots;
    next();
  });

  router.post('/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('bcp.admin', {
      path: `${config.basePath}/admin`,
      httpOnly: true, sameSite: 'strict', secure: config.production,
    });
    res.redirect(303, `${config.basePath}/admin/login`);
  });
  router.get('/', (req, res) => res.render('admin/dashboard', { activePage: 'dashboard' }));

  router.post('/media/:slot', (req, res, next) => {
    if (!slotKeys.has(req.params.slot)) return next(httpError(404, 'Emplacement média inconnu.'));
    next();
  }, upload.single('media'), async (req, res) => {
    if (!req.file?.size) throw httpError(400, 'Sélectionnez une image ou une vidéo non vide.');
    let detected;
    try { detected = await fileTypeFromBuffer(req.file.buffer); }
    catch { throw httpError(400, 'Le fichier est incomplet ou son format est invalide.'); }
    if (!detected || (!imageMimes.has(detected.mime) && !videoMimes.has(detected.mime))) {
      throw httpError(400, 'Format réel non autorisé. Images : JPEG, PNG, WebP, GIF. Vidéos : MP4, WebM.');
    }
    const kind = imageMimes.has(detected.mime) ? 'image' : 'video';
    const maximum = kind === 'image' ? config.imageMaxMb : config.videoMaxMb;
    if (req.file.size > maximum * 1024 * 1024) throw httpError(400, `Ce ${kind === 'image' ? 'type d’image' : 'type de vidéo'} est limité à ${maximum} Mo.`);
    const alt = req.body.alt;
    if (typeof alt !== 'string' || alt.length > 500) throw httpError(400, 'Le texte alternatif est limité à 500 caractères.');
    req.file.originalname = path.basename(path.win32.basename(req.file.originalname)).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || `media.${detected.ext}`;
    await replaceMedia(req.params.slot, req.file, kind, detected.mime, alt.trim());
    flash(req, 'Média enregistré. Le nouveau visuel est maintenant disponible sur le site.');
    await saveAndRedirect(req, res, '/admin');
  });
  router.post('/media/:slot/delete', async (req, res) => {
    if (!slotKeys.has(req.params.slot)) throw httpError(404, 'Emplacement média inconnu.');
    await pool.execute('DELETE FROM media WHERE slot_key = ?', [req.params.slot]);
    flash(req, 'Média supprimé. Le panneau original est à nouveau affiché.');
    await saveAndRedirect(req, res, '/admin');
  });

  router.get('/settings', (req, res) => res.render('admin/settings', { activePage: 'settings' }));
  router.post('/settings', async (req, res) => {
    const values = {};
    for (const key of settingKeys) {
      const raw = req.body[key];
      if (typeof raw !== 'string' || raw.length > 4000) throw httpError(400, 'Chaque paramètre doit être un texte de 4 000 caractères maximum.');
      values[key] = raw.trim();
    }
    for (const key of ['signup_url', 'linkedin_url', 'facebook_url', 'x_url', 'api_docs_url']) {
      if (!validWebUrl(values[key])) throw httpError(400, 'Les liens doivent être des URL HTTPS ou des chemins locaux commençant par /.');
    }
    for (const key of ['support_email', 'legal_email']) {
      if (values[key] && !validEmail(values[key])) throw httpError(400, 'Une adresse e-mail est invalide.');
    }
    if (values.whatsapp && !/^\+?[\d ()-]{6,30}$/.test(values.whatsapp)) {
      let url;
      try { url = new URL(values.whatsapp); } catch { /* handled below */ }
      if (!url || url.protocol !== 'https:' || !['wa.me', 'api.whatsapp.com', 'www.whatsapp.com'].includes(url.hostname) || url.username || url.password) {
        throw httpError(400, 'WhatsApp doit être un numéro international ou un lien HTTPS wa.me / whatsapp.com.');
      }
    }
    await saveSettings(values);
    flash(req, 'Paramètres enregistrés. Les liens et les pages légales ont été mis à jour.');
    await saveAndRedirect(req, res, '/admin/settings');
  });
  router.get('/pricing', (req, res) => res.render('admin/pricing', { activePage: 'pricing' }));
  router.post('/pricing', async (req, res) => {
    if (typeof req.body.html !== 'string' || Buffer.byteLength(req.body.html) > 60000) throw httpError(400, 'Le contenu HTML des tarifs est limité à 60 Ko.');
    await saveSettings({ pricing_html: cleanPricing(req.body.html) });
    flash(req, 'Tarifs enregistrés après nettoyage du HTML.');
    await saveAndRedirect(req, res, '/admin/pricing');
  });
  router.get('/subscribers', async (req, res) => {
    const requested = typeof req.query.page === 'string' && /^\d{1,7}$/.test(req.query.page) ? Number(req.query.page) : 1;
    const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM subscribers');
    const total = Number(count.total);
    const totalPages = Math.max(1, Math.ceil(total / 50));
    const page = Math.max(1, Math.min(requested, totalPages));
    const [subscribers] = await pool.execute('SELECT id, email, created_at FROM subscribers ORDER BY id DESC LIMIT ? OFFSET ?', [50, (page - 1) * 50]);
    res.render('admin/subscribers', { activePage: 'subscribers', subscribers, total, page, totalPages });
  });
  router.get('/subscribers.csv', async (req, res) => {
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bizconnectpay-newsletter.csv"',
      'Cache-Control': 'no-store',
    });
    res.write('\uFEFFid,email,date_inscription\r\n');
    let after = '0';
    function cell(value) {
      // Prevent spreadsheet formula injection, even if data was inserted manually.
      const text = String(value ?? '');
      return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
    }
    while (!res.destroyed) {
      const [rows] = await pool.execute('SELECT id, email, created_at FROM subscribers WHERE id > ? ORDER BY id ASC LIMIT 500', [after]);
      if (!rows.length) break;
      const chunk = rows.map(row => [row.id, row.email, new Date(row.created_at).toISOString()].map(cell).join(',')).join('\r\n') + '\r\n';
      if (!res.write(chunk)) await once(res, 'drain');
      after = String(rows[rows.length - 1].id);
    }
    res.end();
  });
  return router;
}
