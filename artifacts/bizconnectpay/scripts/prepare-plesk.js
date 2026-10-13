import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { portableLock } from './portable-lock.js';

const source = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(source, '../../deploy/plesk');
const checkOnly = process.argv.includes('--check');
const files = new Map();

async function collect(relative) {
  const fullPath = path.join(source, relative);
  const entries = await readdir(fullPath, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOTDIR') return null;
    throw error;
  });
  if (entries) {
    for (const entry of entries) await collect(path.join(relative, entry.name));
  } else {
    files.set(relative, await readFile(fullPath));
  }
}
for (const relative of [
  'server.js', 'src-server', 'views', 'public', 'schema.sql',
  '.env.example', '.nvmrc', 'README.md', 'reference',
  'scripts/check.js', 'scripts/package.json',
]) await collect(relative);

const original = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const dependencies = {};
for (const name of Object.keys(original.dependencies)) {
  dependencies[name] = JSON.parse(
    await readFile(path.join(source, 'node_modules', name, 'package.json'), 'utf8'),
  ).version;
}
files.set('package.json', Buffer.from(JSON.stringify({
  name: 'bizconnectpay', version: original.version, private: true,
  type: 'commonjs', engines: { node: '>=18' },
  scripts: { start: 'node server.js', check: 'node scripts/check.js' },
  dependencies,
}, null, 2) + '\n'));
files.set('.npmrc', Buffer.from('registry=https://registry.npmjs.org/\npackage-lock=true\naudit=false\nfund=false\n'));
files.set('.gitignore', Buffer.from('node_modules/\n.env\n.env.*\n!.env.example\ntmp/\nnpm-debug.log*\n'));
const lockText = await readFile(path.join(destination, 'package-lock.json'), 'utf8').catch(error => {
  if (error.code === 'ENOENT' && !checkOnly) return null;
  throw error;
});
if (lockText) {
  const lock = portableLock(JSON.parse(lockText));
  files.set('package-lock.json', Buffer.from(JSON.stringify(lock, null, 2) + '\n'));
}

if (checkOnly) {
  for (const [relative, expected] of files) {
    const actual = await readFile(path.join(destination, relative)).catch(() => null);
    if (!actual || !actual.equals(expected)) {
      throw new Error(`Livraison Plesk à actualiser : ${relative}. Lancez prepare:plesk avant de pousser sur GitHub.`);
    }
  }
  const lock = JSON.parse(await readFile(path.join(destination, 'package-lock.json'), 'utf8'));
  if (JSON.stringify(lock.packages[''].dependencies) !== JSON.stringify(dependencies)) {
    throw new Error('Actualisez le package-lock.json autonome après un changement de dépendances.');
  }
  process.stdout.write('Livraison Git/Plesk synchronisée, manifeste autonome et verrouillage présents.\n');
} else {
  // Only managed runtime directories are refreshed. Never remove local secrets,
  // node_modules when regenerating the delivery folder. The existing lock keeps
  // the same versions/checksums; only registry URLs are made portable.
  for (const directory of ['src-server', 'views', 'public', 'reference', 'scripts']) {
    await rm(path.join(destination, directory), { recursive: true, force: true });
  }
  for (const [relative, content] of files) {
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  process.stdout.write('Version prête à démarrer préparée dans deploy/plesk (à inclure dans Git).\n');
}
