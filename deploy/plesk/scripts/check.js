import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [
  'app.js', 'server.js',
  ...readdirSync(path.join(root, 'src-server')).filter(file => file.endsWith('.js')).map(file => `src-server/${file}`),
  'public/js/main.js', 'public/js/admin.js',
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
function checkViews(directory) {
  for (const name of readdirSync(directory)) {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) checkViews(file);
    else if (name.endsWith('.ejs')) ejs.compile(readFileSync(file, 'utf8'), { filename: file });
  }
}
checkViews(path.join(root, 'views'));
process.stdout.write('JavaScript et modèles EJS : syntaxe valide.\n');
