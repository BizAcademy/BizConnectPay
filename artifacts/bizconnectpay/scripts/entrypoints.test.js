import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));

for (const [label, args] of [
  ['explicit server.js startup', ['server.js']],
  ['conventional app.js startup', ['app.js']],
  ['CommonJS require used by Passenger', ['-e', "require('./app.js')"]],
]) {
  test(label, { timeout: 20000 }, async () => {
    const reservation = net.createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const child = spawn(process.execPath, args, {
      cwd,
      env: {
        ...process.env, PORT: String(port), NODE_ENV: 'development',
        SITE_PREVIEW: '1', BASE_PATH: '/', TRUST_PROXY: '0',
        DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'regression',
        DB_PASSWORD: 'regression', DB_NAME: 'regression',
        SESSION_SECRET: 'regression-session-with-at-least-thirty-two-characters',
        ADMIN_PASSWORD: 'regression-password',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = new Promise(resolve => child.once('exit', resolve));
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    try {
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          clearInterval(poll);
          reject(new Error('Startup timed out'));
        }, 15000);
        const poll = setInterval(() => {
          if (output.includes('BizConnectPay est démarré.')) {
            clearTimeout(deadline);
            clearInterval(poll);
            resolve();
          } else if (child.exitCode !== null || child.signalCode !== null) {
            clearTimeout(deadline);
            clearInterval(poll);
            reject(new Error('The entry point exited before starting HTTP'));
          }
        }, 30);
      });
      const base = `http://127.0.0.1:${port}`;
      const response = await fetch(`${base}/`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Encaissez sans/);
      const health = await (await fetch(`${base}/healthz`)).json();
      assert.equal(health.status, 'preview');
      assert.equal(health.databaseAvailable, false);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await exited;
    }
  });
}
