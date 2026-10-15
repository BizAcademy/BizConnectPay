import { readFileSync } from 'node:fs';
import { translator } from './i18n.js';
import { httpError } from './security.js';

// The rendered template is the source of truth: every visible text is editable.
const template = readFileSync(new URL('../views/pages/tarifs.ejs', import.meta.url), 'utf8');
export const pricingTextFields = [...new Set(
  [...template.matchAll(/\bt\((["'])(.*?)\1\)/g)].map(match => match[2]),
)];
export function pricingCopyTranslator(settings, language) {
  const fallback = translator(language);
  let copy = {};
  try { copy = JSON.parse(settings[`pricing_copy_${language}`] || '{}'); } catch { /* legacy defaults */ }
  return source => typeof copy?.[source] === 'string' && copy[source].trim() ? copy[source] : fallback(source);
}
export function validatePricingCopy(body) {
  const values = {};
  for (const language of ['fr', 'en']) {
    const copy = {};
    pricingTextFields.forEach((source, index) => {
      const value = body[`copy_${language}_${index}`];
      if (typeof value !== 'string' || value.length > 2000) {
        throw httpError(400, 'Chaque texte des tarifs est limité à 2 000 caractères.');
      }
      if (value.trim()) copy[source] = value.trim();
    });
    const json = JSON.stringify(copy);
    if (Buffer.byteLength(json) > 60000) throw httpError(400, 'Les textes des tarifs sont limités à 60 Ko par langue.');
    values[`pricing_copy_${language}`] = json;
  }
  return values;
}
