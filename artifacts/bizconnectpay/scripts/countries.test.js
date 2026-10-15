import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import express from 'express';
import ejs from 'ejs';
import { countries, contactCountries, countrySettingKey, enabledCountryCodes, validateCountrySelection } from '../src-server/countries.js';
import { createCountryAdminRouter } from '../src-server/country-admin-routes.js';
import { createContactRouter, validateContact } from '../src-server/contact-routes.js';
import { requireAdmin, verifyCsrf } from '../src-server/security.js';
import { translator } from '../src-server/i18n.js';

test('Complete catalog and local flags: shared prefixes stay distinct; no fictional codes', () => {
  assert.equal(countries.length, 250);
  assert.equal(new Set(countries.map(c => c.iso)).size, 250);
  for (const country of countries) {
    assert.ok(country.fr && country.en);
    assert.ok(existsSync(new URL(`../public/assets/flags/${country.iso.toLowerCase()}.png`, import.meta.url)));
  }
  assert.equal(countries.find(c => c.iso === 'US').dial, '+1');
  assert.equal(countries.find(c => c.iso === 'CA').dial, '+1');
  assert.equal(countries.find(c => c.iso === 'AQ').dial, '');
  assert.equal(enabledCountryCodes({}).length, 250);
  assert.deepEqual(contactCountries({ [countrySettingKey]: '[]' }), []);
  assert.deepEqual(validateCountrySelection(['US', 'US', 'CA']), ['CA','US']);
  assert.throws(() => validateCountrySelection(['XX']), { status: 400 });
  assert.throws(() => enabledCountryCodes({ [countrySettingKey]: 'invalid' }), { status: 503 });
  assert.throws(() => enabledCountryCodes({ [countrySettingKey]: 'null' }), { status: 503 });
});

async function serve(app, action) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('Admin saves 250 checkboxes, a single country and explicit empty list; auth and CSRF guard changes', async () => {
  const store = {};
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', new URL('../views', import.meta.url).pathname);
  app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 300 }));
  app.use((req,res,next) => {
    req.session = { admin: req.get('X-Test-Admin') === 'yes', csrfToken: 'test-csrf', save: done => done() };
    Object.assign(res.locals, { settings: store, basePath: '', csrfToken: 'test-csrf', databaseAvailable: true });
    next();
  });
  app.use('/admin/countries', requireAdmin, (req,res,next) => req.method === 'POST' ? verifyCsrf(req,res,next) : next(),
    createCountryAdminRouter(async values => Object.assign(store, values)));
  app.use((error,req,res,next) => res.status(error.status || 500).json({ error: error.message }));
  await serve(app, async base => {
    const post = (codes, token = 'test-csrf') => {
      const data = new URLSearchParams({ _csrf: token });
      codes.forEach(code => data.append('countryCodes',code));
      return fetch(base+'/admin/countries', { method: 'POST', headers: { 'X-Test-Admin':'yes' }, body: data, redirect:'manual' });
    };
    assert.equal((await fetch(base+'/admin/countries', {redirect:'manual'})).status, 302);
    assert.equal((await post(['FR'],'bad')).status, 403);
    assert.equal((await post(countries.map(c => c.iso))).status, 303);
    assert.equal(JSON.parse(store[countrySettingKey]).length, 250);
    assert.equal((await post(['FR'])).status, 303);
    assert.deepEqual(enabledCountryCodes(store), ['FR']);
    const rendered = await (await fetch(base+'/admin/countries', { headers: {'X-Test-Admin':'yes'} })).text();
    assert.match(rendered, /name="countryCodes"/);
    assert.match(rendered, /\/assets\/flags\/fr\.png/);
    assert.equal((await post([])).status, 303);
    assert.deepEqual(enabledCountryCodes(store), []);
    assert.equal((await post(['XX'])).status, 400);
    assert.deepEqual(enabledCountryCodes(store), []);
  });
  const source = readFileSync(new URL('../src-server/admin-routes.js',import.meta.url),'utf8');
  assert.ok(source.indexOf('router.use(requireAdmin)') < source.indexOf("router.use('/countries'"));
  assert.ok(source.indexOf('verifyCsrf(req, res, next)') < source.indexOf("router.use('/countries'"));
});
test('Server rejects disabled countries even if they share a calling code with an enabled country', async () => {
  let inserts = 0;
  const database = { async execute(sql) {
    if (sql.startsWith('SELECT setting_value')) return [[{ setting_value:'["US"]' }]];
    inserts++;
    return [{ affectedRows:1 }];
  }};
  const body = {
    fullName:'Country test',company:'',countryCode:'+1',countryIso:'US',phone:'2025550100',
    email:'test@example.com',sector:'E-commerce',services:['IN'],subject:'Country check',
    message:'Testing the enabled country restriction.',consent:true,website:'',
    submissionId:'ba395b58-f354-4a7a-aaea-334c501a269c',
  };
  const app = express();
  app.use(express.json());
  app.use('/contact-request',createContactRouter(()=>database));
  app.use((error,req,res,next)=>res.status(error.status || 500).json({error:error.message}));
  await serve(app,async base=>{
    const send = countryIso=>fetch(base+'/contact-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,countryIso})});
    assert.equal((await send('CA')).status,400);
    assert.equal(inserts,0);
    assert.equal((await send('US')).status,201);
    assert.equal(inserts,1);
  });
  assert.throws(()=>validateContact({...body,countryCode:'+33'}),{status:400});
});
test('Public form uses only configured countries; language flags and empty-country state render correctly', async () => {
  const index = new URL('../views/index.ejs',import.meta.url).pathname;
  for (const lang of ['fr','en']) {
    const html = await ejs.renderFile(index,{
      lang,t:translator(lang),contactCountries:contactCountries({[countrySettingKey]:'["FR","CM"]'},lang),
    });
    assert.ok(html.includes(`/assets/flag-${lang}.svg`));
    assert.ok(html.includes('data-iso="FR"'));
    assert.ok(html.includes('data-iso="CM"'));
    assert.ok(!html.includes('data-iso="US"'));
    assert.match(html,/name="countryIso"/);
  }
  const empty = await ejs.renderFile(index,{contactCountries:[]});
  assert.match(empty,/data-countries-empty="true"/);
});
