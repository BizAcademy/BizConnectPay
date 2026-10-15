import { readFileSync } from 'node:fs';
import { httpError } from './security.js';

export const countries = Object.freeze(JSON.parse(
  readFileSync(new URL('../public/data/countries.json', import.meta.url), 'utf8'),
).countries.map(country => Object.freeze(country)));
const byIso = new Map(countries.map(country => [country.iso, country]));
export const countrySettingKey = 'contact_countries';
export function countryByIso(iso) { return byIso.get(iso); }

export function validateCountrySelection(raw) {
  const values = raw === undefined ? [] : typeof raw === 'string' ? [raw] : raw;
  if (!Array.isArray(values) || values.length > countries.length ||
      values.some(value => typeof value !== 'string' || !byIso.has(value))) {
    throw httpError(400, 'La sélection des pays est invalide.');
  }
  const selected = new Set(values);
  return countries.filter(country => selected.has(country.iso)).map(country => country.iso);
}
export function enabledCountryCodes(settings = {}) {
  if (!Object.hasOwn(settings, countrySettingKey)) return countries.map(country => country.iso);
  try {
    const raw = JSON.parse(settings[countrySettingKey]);
    if (!Array.isArray(raw)) throw new Error('Invalid country configuration');
    return validateCountrySelection(raw);
  } catch {
    throw httpError(503, 'La configuration des pays du formulaire est invalide. Vérifiez les pays dans l’administration.');
  }
}
export function contactCountries(settings = {}, lang = 'fr') {
  const selected = new Set(enabledCountryCodes(settings));
  return countries.filter(country => selected.has(country.iso))
    .sort((a, b) => a[lang === 'en' ? 'en' : 'fr'].localeCompare(b[lang === 'en' ? 'en' : 'fr'], lang));
}
export async function readEnabledCountryCodes(database) {
  const [rows] = await database.execute('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [countrySettingKey]);
  return enabledCountryCodes(rows.length ? { [countrySettingKey]: rows[0].setting_value } : {});
}
