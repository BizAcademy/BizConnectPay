// Keep the workspace registry unchanged. Only external delivery metadata is
// normalized; package versions and integrity checksums are never changed.
export function portableLock(input) {
  const lock = structuredClone(input);
  if (lock.lockfileVersion !== 3 || !lock.packages?.['']) {
    throw new Error('Un verrouillage npm autonome de version 3 est requis.');
  }
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!entry.resolved) continue;
    const url = new URL(entry.resolved);
    if (url.username || url.password || url.search || url.hash) {
      throw new Error(`Adresse de paquet non portable : ${name}.`);
    }
    if (url.hostname === 'package-firewall.replit.internal' && url.pathname.startsWith('/npm/')) {
      entry.resolved = `https://registry.npmjs.org/${url.pathname.slice('/npm/'.length)}`;
    } else if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') {
      throw new Error(`Registre externe non approuvé dans la livraison : ${name}.`);
    }
    if (!entry.integrity) throw new Error(`Empreinte npm manquante : ${name}.`);
  }
  return lock;
}
