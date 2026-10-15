import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import ejs from 'ejs';
import { validateContact, createContactRouter } from '../src-server/contact-routes.js';

function fixture() {
  return {
    fullName: 'Utilisateur de test', company: 'Entreprise de test', countryCode: '+237', countryIso: 'CM',
    phone: '600 000 000', email: 'TEST@example.com', sector: 'E-commerce',
    services: ['IN', 'Link'], subject: 'Demande de test', message: 'Message de vérification du formulaire.',
    consent: true, website: '', submissionId: randomUUID(),
  };
}
test('Contact validation, bounded fields, consent and service allowlist', () => {
  const valid = validateContact(fixture());
  assert.equal(valid.email, 'test@example.com');
  assert.equal(valid.phone, '600000000');
  assert.deepEqual(valid.services, ['IN', 'Link']);
  assert.equal(validateContact({ ...fixture(), company: '' }).company, '');
  for (const bad of [
    { fullName: '' }, { fullName: 'x'.repeat(121) }, { email: 'bad' }, { company: 'x'.repeat(161) },
    { countryCode: '237' }, { countryIso: 'XX' }, { countryIso: 'FR' }, { phone: 'abc123456' }, { phone: '1' }, { sector: 'Invalid' },
    { services: [] }, { services: ['Unknown'] }, { services: 'IN' }, { subject: '' },
    { message: 'court' }, { message: 'x'.repeat(5001) }, { consent: false },
    { consent: 'true' }, { website: 'spam' }, { submissionId: 'not-a-uuid' },
  ]) {
    assert.throws(() => validateContact({ ...fixture(), ...bad }), { status: 400 });
  }
});

async function withServer(getPool, callback) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use('/contact-request', createContactRouter(getPool));
  app.use((error, req, res, next) => res.status(error.status || 503).json({ error: error.status ? error.message : 'Serveur indisponible' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/contact-request`;
  const send = (body, options = {}) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
  try { await callback(send); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('Contact inserts validated SQL parameters and safely reuses the retry key', async () => {
  const keys = new Set();
  let parameters;
  const database = { async execute(sql, values) {
    if (sql.startsWith('SELECT setting_value')) return [[]];
    assert.match(sql, /INSERT INTO contact_messages/);
    assert.match(sql, /ON DUPLICATE KEY UPDATE/);
    parameters = values;
    const exists = keys.has(values[0]);
    keys.add(values[0]);
    return [{ affectedRows: exists ? 2 : 1 }];
  } };
  await withServer(() => database, async send => {
    const input = fixture();
    const first = await send(input);
    assert.equal(first.status, 201);
    assert.match((await first.json()).message, /enregistrée/);
    assert.equal(parameters[0], input.submissionId);
    assert.equal(parameters[4], '600000000');
    assert.equal(parameters[5], 'test@example.com');
    assert.deepEqual(JSON.parse(parameters[7]), ['IN', 'Link']);
    assert.equal(parameters[10], 'CM');
    assert.equal((await send(input)).status, 200);
    assert.equal(keys.size, 1);
  });
});
test('Missing MySQL or failed insert never reports success', async () => {
  for (const database of [null, { async execute() { throw new Error('Unreachable'); } }]) {
    await withServer(() => database, async send => {
      const response = await send(fixture());
      assert.equal(response.status, 503);
      const data = await response.json();
      assert.equal(typeof data.error, 'string');
      assert.ok(!data.message);
    });
  }
});
test('Contact enforces origin, content type and spam rate limit', async () => {
  await withServer(() => null, async send => {
    assert.equal((await send(fixture(), { headers: { Origin: 'https://unrelated.invalid' } })).status, 403);
    assert.equal((await send(fixture(), { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    for (let i = 0; i < 3; i++) assert.equal((await send({ ...fixture(), email: 'bad' })).status, 400);
    const blocked = await send(fixture());
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /Trop de demandes/);
  });
});
test('Admin inbox renders stored messages escaped, with reply links and pagination', async () => {
  const html = await ejs.renderFile(new URL('../views/admin/messages.ejs', import.meta.url).pathname, {
    basePath: '/biz', activePage: 'messages', csrfToken: 'test', databaseAvailable: true,
    page: 1, totalPages: 2, total: 21, messages: [{
      id: 1, full_name: '<script>test</script>', subject: '<img src=x>',
      company: 'Test', country_code: '+237', phone: '600000000', email: 'test@example.com',
      sector: 'E-commerce', services: '["IN","Link"]', message: '<script>alert(1)</script>\nDeuxième ligne',
      created_at: new Date(), consent_at: new Date(),
    }],
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /mailto:test@example.com/);
  assert.match(html, /\/biz\/admin\/messages\?page=2/);
  assert.match(html, /BizConnectPay IN, BizConnectPay Link/);
});
