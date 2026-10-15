import express from 'express';
import { saveSettings } from './database.js';
import { countries, countrySettingKey, enabledCountryCodes, validateCountrySelection } from './countries.js';

// Mounted only inside the authenticated, CSRF-protected administration router.
export function createCountryAdminRouter(save = saveSettings) {
  const router = express.Router();
  router.get('/', (req, res) => res.render('admin/countries', {
    activePage: 'countries', countries: [...countries].sort((a, b) => a.fr.localeCompare(b.fr, 'fr')),
    enabledCountryCodes: enabledCountryCodes(res.locals.settings || {}),
  }));
  router.post('/', async (req, res) => {
    const selection = validateCountrySelection(req.body.countryCodes);
    await save({ [countrySettingKey]: JSON.stringify(selection) });
    req.session.flash = { type: 'success', message: 'Pays enregistrés. Seuls les pays cochés apparaissent dans le formulaire Contact.' };
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(303, `${res.locals.basePath || ''}/admin/countries`);
  });
  return router;
}
