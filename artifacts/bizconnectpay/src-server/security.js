import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';

export function ensureCsrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}
export function verifyCsrf(req, res, next) {
  const supplied = req.body?._csrf || req.query._csrf || req.get('X-CSRF-Token');
  const expected = req.session?.csrfToken;
  if (typeof supplied !== 'string' || typeof expected !== 'string' ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    const error = new Error('Votre session a expiré ou le jeton de sécurité est invalide. Rechargez la page.');
    error.status = 403;
    return next(error);
  }
  next();
}
export function passwordDigest(password) {
  // bcrypt only accepts 72 bytes. SHA-256 removes truncation and is always bounded.
  return createHash('sha256').update(password, 'utf8').digest('hex');
}
export function requireAdmin(req, res, next) {
  if (req.session?.admin === true) return next();
  return res.redirect(`${res.locals.basePath}/admin/login`);
}
export function cleanPricing(html) {
  return sanitizeHtml(html, {
    allowedTags: ['h1','h2','h3','h4','p','br','strong','b','em','i','u','s','ul','ol','li',
      'table','thead','tbody','tfoot','tr','th','td','caption','a','span','div','hr'],
    allowedAttributes: {
      a: ['href', 'title'],
      '*': ['class'],
      th: ['scope', 'colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  });
}
export function validEmail(email) {
  return typeof email === 'string' && email.length <= 254 &&
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email);
}
export function validWebUrl(value) {
  if (!value) return true;
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch { return false; }
}
export function friendlyError(error) {
  if (['ER_NET_PACKET_TOO_LARGE', 'ER_WARN_ALLOWED_PACKET_OVERFLOWED'].includes(error.code) ||
      /max_allowed_packet|packet.*too large/i.test(error.message || '')) {
    return 'Le fichier dépasse max_allowed_packet de MySQL. Augmentez ce paramètre (au moins 64 Mo pour des vidéos de 50 Mo), puis reconnectez l’application, ou choisissez un fichier plus petit.';
  }
  if (error.code === 'LIMIT_FILE_SIZE') return 'Le fichier dépasse la limite de téléversement autorisée.';
  if (error.code?.startsWith('LIMIT_')) return 'Téléversement invalide : envoyez un seul fichier dans le champ média.';
  if (['ER_LOCK_DEADLOCK', 'ER_DUP_ENTRY'].includes(error.code)) return 'Une modification simultanée a eu lieu. Rechargez la page puis réessayez.';
  if (error.status && error.status < 500) return error.message;
  return 'Une erreur serveur est survenue. Réessayez ou vérifiez la connexion MySQL.';
}
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
