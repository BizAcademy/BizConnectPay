import { createApp, logger } from './app.js';
import { config } from './config.js';
import { pool } from './database.js';
import { startContactMailer } from './contact-mail.js';

try {
  const app = await createApp();
  const stopMailer = pool ? startContactMailer(pool, logger) : () => {};
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info({ port: config.port, preview: config.preview }, 'BizConnectPay est démarré.');
  });
  server.on('error', error => {
    logger.error({ code: error.code }, 'Impossible de démarrer le serveur HTTP.');
    process.exit(1);
  });
  async function shutdown() {
    stopMailer();
    server.close(async () => {
      await app.locals.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  // Aucun objet de connexion ou mot de passe n’est écrit dans les journaux.
  logger.fatal({ code: error.code || 'STARTUP_CONFIGURATION' },
    error.code ? 'Connexion MySQL impossible. Vérifiez les variables DB_* et la disponibilité du serveur.' : error.message);
  process.exit(1);
}
