import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import ejs from 'ejs';
import { localeMiddleware, translator } from '../src-server/i18n.js';
import { createContactRouter } from '../src-server/contact-routes.js';
import { slots, settingKeys } from '../src-server/constants.js';

const english = {
  ...JSON.parse(readFileSync(new URL('../public/locales/en.json', import.meta.url))),
  ...JSON.parse(readFileSync(new URL('../public/locales/en-runtime.json', import.meta.url))),
};
const require = createRequire(import.meta.url);
const { parseDocument } = createRequire(require.resolve('sanitize-html'))('htmlparser2');
function visibleText(html) {
  const parts = [];
  function walk(node) {
    if (node.type === 'script' || node.type === 'style') return;
    if (node.type === 'text') parts.push(node.data);
    for (const key of ['placeholder', 'title', 'aria-label', 'alt']) {
      if (node.attribs?.[key]) parts.push(node.attribs[key]);
    }
    for (const child of node.children || []) walk(child);
  }
  walk(parseDocument(html));
  return parts.map(value => value.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const fixture = {
  basePath: '/site', settings: { login_url: 'https://example.com/login', signup_url: 'https://example.com/register' },
  slots, media: {}, pricingHtml: '', theme: '',
};
test('All public pages render in both languages with translated labels and stable backend values', async () => {
  const renders = {};
  for (const lang of ['fr', 'en']) {
    renders[lang] = await ejs.renderFile(new URL('../views/index.ejs', import.meta.url).pathname, {
      ...fixture, lang, t: translator(lang), uiTranslations: lang === 'en' ? english : {},
    });
    assert.match(renders[lang], new RegExp(`<html lang="${lang}"`));
    for (const page of ['accueil','services','tarifs','contact','apropos','cgu','confidentialite','cookies','mentions']) {
      assert.ok(renders[lang].includes(`id="${page}"`), `${page}/${lang}`);
    }
    assert.ok(renders[lang].includes('href="https://example.com/login"'));
    assert.ok(renders[lang].includes('href="https://example.com/register"'));
    assert.ok(renders[lang].includes('value="Services et conseil"'), 'Backend sector enum must remain stable');
    assert.ok(renders[lang].indexOf('id="bcp-i18n"') < renders[lang].indexOf('/js/i18n.js'));
  }
  const frText = visibleText(renders.fr);
  const enText = visibleText(renders.en);
  assert.ok(!enText.some(value => /\[(RAISON SOCIALE|PAYS|VILLE|ADRESSE|FORME JURIDIQUE|TÉLÉPHONE)\]/.test(value)));
  assert.ok(visibleText(renders.fr).includes('Paiements sans frontières'));
  assert.ok(enText.includes(translator('en')('Contactez le service client')));
  const untranslated = frText.filter(source =>
    source.length > 20 && /[a-zàâçéèêëîïôùûüÿœ]/i.test(source) &&
    !source.includes('BizConnectPay ©') &&
    english[source] && english[source] !== source && enText.includes(source)
  );
  assert.deepEqual([...new Set(untranslated)], [], 'Known French strings must not remain in English HTML');
});
test('Header current-page state updates immediately on click and on hash navigation', () => {
  const links = ['accueil','tarifs','contact','services'].map(id => ({
    attrs: { href: '#'+id },
    getAttribute(key) { return this.attrs[key]; },
    setAttribute(key,value) { this.attrs[key]=value; },
    removeAttribute(key) { delete this.attrs[key]; },
  }));
  const handlers = {}, events = {};
  const header = {
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-nav-link]' ? links : []; },
    addEventListener(type, callback) { handlers[type] = callback; },
  };
  const context = {
    window: {}, location: { hash: '' },
    document: {
      querySelector() { return header; }, getElementById(id) { return id === 'sh-menu' ? null : {}; },
      addEventListener() {},
    },
    matchMedia() { return { matches: false, addEventListener() {} }; },
    addEventListener(type, callback) { events[type] = callback; },
  };
  vm.runInNewContext(readFileSync(new URL('../public/js/header-menu.js', import.meta.url), 'utf8'), context);
  handlers.click({ target: { closest: () => links[1] } });
  assert.equal(links[1].attrs['aria-current'], 'page');
  assert.equal(links[0].attrs['aria-current'], undefined);
  context.location.hash = '#contact';
  events.hashchange({});
  assert.equal(links[2].attrs['aria-current'], 'page');
  assert.equal(links[1].attrs['aria-current'], undefined);
});
test('Locale selection is cookie-persistent, validated, safe for admin and used by real JSON errors', async () => {
  const app = express();
  app.use(localeMiddleware());
  app.use(express.json());
  app.get('/', (req, res) => res.json({ lang: req.lang, label: req.t('Nom complet') }));
  app.get('/admin/login', (req, res) => res.json({ lang: req.lang }));
  app.use('/contact-request', createContactRouter(() => null));
  app.use((error, req, res, next) => res.status(error.status || 503).json({ error: req.t(error.message) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(base)).json()).lang, 'fr');
    const en = await fetch(base + '/?lang=en');
    assert.match(en.headers.get('set-cookie'), /bcp\.lang=en/);
    assert.equal((await en.json()).label, 'Full name');
    const saved = await fetch(base, { headers: { Cookie: 'bcp.lang=en' } });
    assert.equal(saved.headers.get('content-language'), 'en');
    assert.equal((await saved.json()).lang, 'en');
    assert.equal((await (await fetch(base+'/?lang=invalid')).json()).lang, 'fr');
    assert.equal((await (await fetch(base+'/admin/login?lang=en', { headers: { Cookie: 'bcp.lang=en' } })).json()).lang, 'fr');
    const invalid = await fetch(base+'/contact-request', {
      method: 'POST', headers: { Cookie: 'bcp.lang=en', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: '' }),
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /Full name.*field is invalid/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('Owner-configured English pricing and image descriptions have separate inputs; login URL is saved/validated', async () => {
  assert.ok(settingKeys.includes('login_url'));
  assert.ok(settingKeys.includes('hero_visual_alt_en'));
  const html = await ejs.renderFile(new URL('../views/admin/pricing.ejs', import.meta.url).pathname, {
    ...fixture, csrfToken: 'test', activePage: 'pricing', databaseAvailable: true,
    pricingHtml: '<p>Tarifs français</p>', pricingHtmlEn: '<p>English fees</p>',
  });
  assert.match(html, /name="html_en"/);
  assert.match(html, /&lt;p&gt;English fees&lt;\/p&gt;/);
  assert.match(html, /&lt;p&gt;Tarifs français&lt;\/p&gt;/);
});
