import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
// Child processes receive only disposable database credentials. No real secrets
// are inspected, logged, or used by these startup regression checks.
const environment = {
  ...process.env,
  DB_HOST: '127.0.0.1', DB_PORT: '1',
  DB_USER: 'regression', DB_PASSWORD: 'regression', DB_NAME: 'regression',
  SESSION_SECRET: 'regression-session-secret-with-over-32-characters',
  ADMIN_PASSWORD: 'regression-admin-password',
  SITE_PREVIEW: '1', BASE_PATH: '/', LOG_LEVEL: 'silent',
};

function run(source, additions = {}) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd, env: { ...environment, ...additions }, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
}

test('Preview serves the original public site when MySQL refuses the connection', () => {
  run(`
    import assert from 'node:assert/strict';
    import { createApp } from './src-server/app.js';
    import { pool } from './src-server/database.js';
    const app = await createApp();
    assert.equal(pool, null);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      const page = await fetch(base + '/');
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Encaissez sans/);
      const health = await (await fetch(base + '/healthz')).json();
      assert.deepEqual(health, {status:'preview',databaseAvailable:false,adminAvailable:false});
      const admin = await fetch(base + '/admin/login');
      assert.equal(admin.status, 503);
      assert.match(await admin.text(), /ECONNREFUSED/);
      for (const [email, status] of [['validation@example.org',503], ['invalid',400]]) {
        const response = await fetch(base + '/api/subscribe', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({email}),
        });
        assert.equal(response.status, status);
        const body = await response.json();
        assert.equal(typeof body.error, 'string');
        assert.equal(body.message, undefined);
      }
      assert.equal((await fetch(base + '/media/1')).status, 503);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await app.locals.close();
    }
  `, { NODE_ENV: 'development' });
});

test('Production still rejects MySQL failures even if SITE_PREVIEW is enabled', () => {
  run(`
    import assert from 'node:assert/strict';
    import { createApp } from './src-server/app.js';
    import { config } from './src-server/config.js';
    import { pool } from './src-server/database.js';
    assert.equal(config.preview, false);
    await assert.rejects(createApp(), {code:'ECONNREFUSED'});
    assert.equal(pool, null);
  `, { NODE_ENV: 'production' });
});

test('Normal development without explicit preview still rejects MySQL failures', () => {
  run(`
    import assert from 'node:assert/strict';
    import { createApp } from './src-server/app.js';
    await assert.rejects(createApp(), {code:'ECONNREFUSED'});
  `, { NODE_ENV: 'development', SITE_PREVIEW: '0' });
});
