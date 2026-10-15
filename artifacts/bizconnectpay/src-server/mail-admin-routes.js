import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool, saveSettings } from './database.js';
import { validEmail, httpError } from './security.js';
import { mailConfiguration, sendTestMail } from './contact-mail.js';

export function createMailAdminRouter({
  getPool = () => pool, save = saveSettings, testMail = sendTestMail, configuration = mailConfiguration,
} = {}) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    const [notifications] = await getPool().execute(
      `SELECT n.message_id, n.recipient, n.attempts, n.failed, n.sent_at, m.full_name, m.created_at
       FROM contact_notifications n JOIN contact_messages m ON m.id = n.message_id
       ORDER BY n.message_id DESC LIMIT 50`,
    );
    res.render('admin/notifications', {
      activePage: 'notifications', smtpReady: configuration().ready, notifications,
    });
  });
  router.post('/', async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const enabled = req.body.enabled === '1';
    if ((email || enabled) && !validEmail(email)) throw httpError(400, 'Renseignez une adresse e-mail destinataire valide.');
    const values = { contact_notify_email: email, contact_notify_enabled: enabled ? '1' : '0' };
    if (enabled && !res.locals.settings.contact_notify_since) {
      values.contact_notify_since = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    await save(values);
    req.session.flash = { type: 'success', message: 'Notifications enregistrées. Les demandes restent également conservées dans Messages contact.' };
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(303, `${res.locals.basePath}/admin/notifications`);
  });
  router.post('/test', rateLimit({ windowMs: 60000, limit: 2, legacyHeaders: false }), async (req, res) => {
    const recipient = res.locals.settings.contact_notify_email;
    if (!validEmail(recipient)) throw httpError(400, 'Enregistrez d’abord une adresse destinataire.');
    try { await testMail(recipient); }
    catch { throw httpError(400, 'Le test SMTP a échoué. Vérifiez les variables SMTP_* dans Plesk, le certificat, le port et les autorisations de la messagerie.'); }
    req.session.flash = { type: 'success', message: 'E-mail de test accepté par le serveur SMTP. Vérifiez votre boîte de réception et les courriers indésirables.' };
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(303, `${res.locals.basePath}/admin/notifications`);
  });
  router.post('/retry', async (req, res) => {
    await getPool().execute(
      'UPDATE contact_notifications SET attempts = 0, failed = 0, next_attempt = UTC_TIMESTAMP() WHERE sent_at IS NULL AND failed = 1',
    );
    res.redirect(303, `${res.locals.basePath}/admin/notifications`);
  });
  return router;
}
