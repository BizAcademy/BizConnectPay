import nodemailer from 'nodemailer';
import { validEmail } from './security.js';
import { countryByIso } from './countries.js';

// Credentials remain server-side, in Plesk environment variables, never in settings/forms.
export function mailConfiguration(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  const ready = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD &&
    validEmail(env.SMTP_FROM) && Number.isInteger(port) && port > 0 && port <= 65535);
  return {
    ready, from: env.SMTP_FROM,
    options: {
      host: env.SMTP_HOST, port, secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      disableFileAccess: true, disableUrlAccess: true,
    },
  };
}
export function notificationMessage(row, recipient, from) {
  return {
    from, to: recipient, replyTo: row.email,
    // Do not allow user input in the subject/header.
    subject: 'Nouvelle demande de contact — BizConnectPay',
    messageId: `<contact-${row.submission_key}@bizconnectpay.local>`,
    text: [
      'Nouvelle demande de contact BizConnectPay', '',
      `Nom : ${row.full_name}`, `Entreprise : ${row.company || '—'}`,
      `Pays : ${countryByIso(row.country_iso)?.fr || row.country_iso || 'Non renseigné (ancienne demande)'}`,
      `Téléphone : ${row.country_code} ${row.phone}`, `E-mail : ${row.email}`,
      `Secteur : ${row.sector}`, `Solutions : ${row.services}`,
      `Objet : ${row.subject}`, '', row.message, '',
      `Consentement au traitement : ${row.consent_at}`, `Reçue le : ${row.created_at}`,
    ].join('\n'),
  };
}
export async function sendTestMail(recipient) {
  const smtp = mailConfiguration();
  if (!smtp.ready) throw new Error('SMTP_NOT_CONFIGURED');
  const transport = nodemailer.createTransport(smtp.options);
  try {
    const result = await transport.sendMail({
      from: smtp.from, to: recipient, subject: 'Test de notification — BizConnectPay',
      text: 'La configuration SMTP BizConnectPay fonctionne. Les nouvelles demandes de contact seront envoyées à cette adresse lorsque les notifications sont activées.',
    });
    if (!result.accepted?.length) throw new Error('SMTP_REJECTED');
  } finally { transport.close(); }
}

// Durable queue derived from saved messages: an SMTP outage cannot lose a contact.
// Conditional claims also protect multiple Passenger processes. SMTP is at-least-once:
// a crash immediately after delivery can still cause one duplicate.
export async function deliverContactNotifications(database, send, smtp = mailConfiguration()) {
  const [rows] = await database.execute(
    'SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?, ?)',
    ['contact_notify_email', 'contact_notify_enabled', 'contact_notify_since'],
  );
  const settings = Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]));
  if (settings.contact_notify_enabled !== '1' || !validEmail(settings.contact_notify_email) ||
      !settings.contact_notify_since || !smtp.ready) return;
  await database.execute(
    `INSERT IGNORE INTO contact_notifications (message_id, recipient)
     SELECT m.id, ? FROM contact_messages m
     LEFT JOIN contact_notifications n ON n.message_id = m.id
     WHERE m.created_at >= ? AND n.message_id IS NULL`,
    [settings.contact_notify_email, settings.contact_notify_since],
  );
  const [pending] = await database.execute(
    `SELECT n.message_id, n.recipient, m.* FROM contact_notifications n
     JOIN contact_messages m ON m.id = n.message_id
     WHERE n.sent_at IS NULL AND n.attempts < 5 AND n.next_attempt <= UTC_TIMESTAMP()
     ORDER BY n.message_id LIMIT 10`,
  );
  for (const row of pending) {
    const [claim] = await database.execute(
      `UPDATE contact_notifications SET attempts = attempts + 1,
       next_attempt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
       WHERE message_id = ? AND sent_at IS NULL AND attempts < 5 AND next_attempt <= UTC_TIMESTAMP()`,
      [row.message_id],
    );
    if (!claim.affectedRows) continue;
    try {
      const result = await send(notificationMessage(row, row.recipient, smtp.from));
      if (!result.accepted?.length) throw new Error('SMTP_REJECTED');
      await database.execute(
        'UPDATE contact_notifications SET sent_at = UTC_TIMESTAMP(), failed = 0 WHERE message_id = ?',
        [row.message_id],
      );
    } catch {
      // Never store SMTP responses: some providers echo credentials or message contents.
      await database.execute('UPDATE contact_notifications SET failed = 1 WHERE message_id = ?', [row.message_id]);
    }
  }
}
export function startContactMailer(database, logger) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    let transport;
    try {
      const smtp = mailConfiguration();
      if (!smtp.ready) return;
      transport = nodemailer.createTransport(smtp.options);
      await deliverContactNotifications(database, message => transport.sendMail(message), smtp);
    } catch {
      logger.warn('Notifications contact : traitement indisponible ; nouvelle tentative automatique.');
    } finally { transport?.close(); busy = false; }
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
