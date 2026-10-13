import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const ready = path.resolve(root, '../../deploy/plesk');
const checked = spawnSync(process.execPath, [path.join(root, 'scripts/prepare-plesk.js'), '--check'], { stdio: 'inherit' });
if (checked.status !== 0) throw new Error('Actualisez deploy/plesk avant de créer l’archive.');
const outputs = path.resolve(root, '../../generated-artifacts');
const destination = path.join(outputs, 'bizconnectpay-plesk');
await mkdir(outputs, { recursive: true });
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const entry of [
  'app.js', 'server.js', 'src-server', 'public', 'views', 'schema.sql', '.env.example', '.nvmrc',
  'README.md', 'reference', 'scripts', 'package.json', 'package-lock.json',
  '.npmrc', '.gitignore',
]) {
  await cp(path.join(ready, entry), path.join(destination, entry), { recursive: true });
}
await cp(path.resolve(root, '../../PLESK.md'), path.join(destination, 'PLESK.md'));
const archive = path.join(outputs, 'bizconnectpay-plesk.zip');
await rm(archive, { force: true });
const zipped = spawnSync('zip', ['-q', '-r', archive, 'bizconnectpay-plesk'], { cwd: outputs, stdio: 'inherit' });
if (zipped.status !== 0) throw new Error('Impossible de créer l’archive ZIP.');
process.stdout.write('Archive autonome : generated-artifacts/bizconnectpay-plesk.zip\n');
