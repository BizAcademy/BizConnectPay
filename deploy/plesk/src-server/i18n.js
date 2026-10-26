import { readFileSync } from 'node:fs';
import { resolvePublicPage } from './seo.js';

const english = {
  ...JSON.parse(readFileSync(new URL('../public/locales/en.json', import.meta.url), 'utf8')),
  ...JSON.parse(readFileSync(new URL('../public/locales/en-runtime.json', import.meta.url), 'utf8')),
  ...JSON.parse(readFileSync(new URL('../public/locales/en-countries.json', import.meta.url), 'utf8')),
};
export function translator(language = 'fr') {
  return function t(source, params = {}) {
    let text = language === 'en' ? (english[source] || source) : source;
    if (language === 'en' && !english[source]) {
      const invalidField = /^Le champ « (.+) » est invalide \((\d+) à (\d+) caractères\)\.$/.exec(source);
      if (invalidField) {
        return `The “${english[invalidField[1]] || invalidField[1]}” field is invalid (${invalidField[2]}–${invalidField[3]} characters).`;
      }
    }
    return String(text).replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(params, key) ? String(params[key]) : token);
  };
}
export function localeMiddleware({ basePath = '', production = false } = {}) {
  return (req, res, next) => {
    const cookie = /(?:^|;\s*)bcp\.lang=(fr|en)(?:;|$)/.exec(req.get('Cookie') || '');
    const requested = ['fr', 'en'].includes(req.query.lang) ? req.query.lang : null;
    const admin = req.path === `${basePath}/admin` || req.path.startsWith(`${basePath}/admin/`);
    // Each public URL has a stable language for crawlers and visitors.
    const publicPage = resolvePublicPage(req.path, basePath);
    const lang = admin ? 'fr' : requested || publicPage?.language || cookie?.[1] || 'fr';
    if (requested && !admin) {
      res.cookie('bcp.lang', lang, {
        path: basePath || '/', maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: 'lax', secure: production, httpOnly: false,
      });
    }
    req.lang = lang;
    req.t = translator(lang);
    res.locals.lang = lang;
    res.locals.t = req.t;
    res.locals.uiTranslations = lang === 'en' ? english : {};
    res.set('Content-Language', lang);
    next();
  };
}
