// Point d’entrée CommonJS compatible avec le chargeur require() de Plesk/Passenger.
// Les modules internes restent ESM, importés dynamiquement (Node.js 18+).
import('./src-server/start.js').catch(error => {
  process.stderr.write(`Démarrage impossible (${error.code || 'MODULE_LOAD_ERROR'}).\n`);
  process.exit(1);
});
