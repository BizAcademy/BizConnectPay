import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import path from 'node:path';
import { config, rootDir, missingDbKeys, missingAdminKeys, assertAdminConfig } from './config.js';
import { pool, initializeDatabase, loadPublicData } from './database.js';
import { MySQLSessionStore } from './mysql-session-store.js';
import { mediaRouter } from './media-routes.js';
import { createContactRouter } from './contact-routes.js';
import { createAdminRouter } from './admin-routes.js';
import { slots } from './constants.js';
import { cleanPricing, validEmail, friendlyError, passwordDigest, httpError } from './security.js';

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
export async function createApp() {
  let databaseAvailable = false;
  let configMessage = '';
  try {
    databaseAvailable = await initializeDatabase();
  } catch (error) {
    const connectionErrors = new Set([
      'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
      'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET',
      'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR',
      'ER_DBACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR',
      'ER_CON_COUNT_ERROR', 'HANDSHAKE_SSL_ERROR',
    ]);
    // Only explicit development previews may run without a reachable database.
    // Programming/schema errors and all production failures remain fatal.
    if (!config.preview || !connectionErrors.has(error.code)) throw error;
    configMessage = `Connexion MySQL indisponible (${error.code}). Vérifiez l’adresse du serveur, le port et les autorisations d’accès distant. L’aperçu public fonctionne sans base ; administration, médias et newsletter sont indisponibles.`;
    logger.warn({ code: error.code }, configMessage);
  }
  let adminReady = databaseAvailable && missingAdminKeys.length === 0;
  if (adminReady) {
    try { assertAdminConfig(); } catch (error) {
      if (!config.preview) throw error;
      adminReady = false;
      configMessage = error.message;
    }
  } else if (!config.preview) {
    assertAdminConfig();
  }
  if (!adminReady && !configMessage) {
    const missing = [...missingDbKeys, ...missingAdminKeys];
    configMessage = `Configuration requise : ${missing.join(', ')}. L’aperçu public est disponible ; les fonctionnalités dépendantes de MySQL ne sont pas actives.`;
  }
  if (!databaseAvailable && missingDbKeys.length) logger.warn('Aperçu public uniquement : MySQL non configuré. Administration, médias et newsletter indisponibles.');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(rootDir, 'views'));
  const router = express.Router();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Original HTML includes inline style attributes; preserving them is intentional.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: config.production ? ["'none'"] : ["'self'", 'https://*.replit.dev', 'https://*.replit.com', 'https://replit.com'],
        upgradeInsecureRequests: config.production ? [] : null,
      },
    },
    // The development preview lives in a frame; production forbids framing.
    frameguard: config.production ? { action: 'deny' } : false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    strictTransportSecurity: config.production ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(compression({ filter: (req, res) => req.path.includes('/media/') ? false : compression.filter(req, res) }));
  app.use(express.urlencoded({ extended: false, limit: '128kb', parameterLimit: 40 }));
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    Object.assign(res.locals, {
      basePath: config.basePath, csrfToken: '', flash: null, error: null,
      activePage: '', slots, settings: {}, media: {}, pricingHtml: '',
      imageMaxMb: config.imageMaxMb, videoMaxMb: config.videoMaxMb,
      databaseAvailable, configMessage,
    });
    next();
  });

  router.use(express.static(path.join(rootDir, 'public'), {
    dotfiles: 'deny', index: false, maxAge: config.production ? '7d' : 0,
  }));
  router.get('/healthz', (req, res) => res.json({
    status: databaseAvailable ? 'ok' : 'preview',
    databaseAvailable, adminAvailable: adminReady,
  }));
  router.use('/media', mediaRouter);
  router.use('/contact-request', createContactRouter());

  const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10,
    standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Trop de demandes. Réessayez dans 15 minutes.' },
  });
  router.post('/api/subscribe', subscribeLimiter, async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!validEmail(email)) return res.status(400).json({ error: 'Veuillez saisir une adresse e-mail valide.' });
    if (!pool) return res.status(503).json({ error: 'La newsletter n’est pas encore disponible : la connexion MySQL doit être configurée et accessible.' });
    await pool.execute('INSERT INTO subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE email = VALUES(email)', [email]);
    res.status(200).json({ message: 'Merci ! Votre inscription à la newsletter est enregistrée.' });
  });

  let store;
  if (adminReady) {
    const maxAge = config.sessionHours * 60 * 60 * 1000;
    store = new MySQLSessionStore(pool, maxAge);
    store.on('cleanupError', () => logger.warn('Nettoyage des sessions MySQL indisponible.'));
    router.use('/admin', session({
      name: 'bcp.admin',
      secret: process.env.SESSION_SECRET,
      store, resave: false, saveUninitialized: false, rolling: true,
      cookie: { httpOnly: true, secure: config.production, sameSite: 'strict', maxAge, path: `${config.basePath}/admin` },
    }));
    const passwordHash = await bcrypt.hash(passwordDigest(process.env.ADMIN_PASSWORD), 12);
    router.use('/admin', createAdminRouter(passwordHash));
  } else {
    router.use('/admin', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.status(503).render('admin/setup');
    });
  }
  router.get('/', async (req, res) => {
    const data = await loadPublicData();
    // Only comparison previews can explicitly force a theme; normal traffic follows the original OS rules.
    const theme = config.preview && ['light', 'dark'].includes(req.query.theme) ? req.query.theme : '';
    res.set('Cache-Control', 'no-store');
    res.render('index', { ...data, pricingHtml: cleanPricing(data.pricingHtml), theme });
  });
  app.use(config.basePath || '/', router);
  app.use((req, res, next) => next(httpError(404, 'Cette page n’existe pas.')));
  app.use((error, req, res, next) => {
    logger.error({ code: error.code, status: error.status || 500, route: req.path }, 'Échec de la requête');
    if (res.headersSent) return next(error);
    if (req.path.includes('/media/')) {
      res.set('Cache-Control', 'no-store');
      res.removeHeader('ETag');
      res.removeHeader('Last-Modified');
      res.removeHeader('Content-Length');
      res.removeHeader('Content-Range');
      if (error.status === 503) res.set('Retry-After', '5');
    }
    if (req.path.endsWith('/api/subscribe') || req.path.endsWith('/contact-request')) {
      res.set('Cache-Control', 'no-store');
      return res.status(error.status || 503).json({ error: friendlyError(error) });
    }
    if (req.session?.admin && req.method === 'POST' && error.status !== 403) {
      req.session.flash = { type: 'error', message: friendlyError(error) };
      const suffix = req.path.endsWith('/settings') ? '/settings' : req.path.endsWith('/pricing') ? '/pricing' : '';
      return req.session.save(saveError => {
        if (saveError) return res.status(503).render('error', { status: 503, message: 'La connexion MySQL est indisponible.', backUrl: `${config.basePath}/admin` });
        res.redirect(303, `${config.basePath}/admin${suffix}`);
      });
    }
    const status = error.status || (error.type === 'entity.too.large' ? 413 : 500);
    res.status(status).render('error', { status, message: friendlyError({ ...error, status, message: error.message }), backUrl: `${config.basePath}/` });
  });
  app.locals.close = async () => {
    store?.close();
    if (pool) await pool.end();
  };
  return app;
}
