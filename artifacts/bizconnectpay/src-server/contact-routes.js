import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from './database.js';
import { httpError, validEmail } from './security.js';

export const contactSectors = [
  'E-commerce', 'Services et conseil', 'Fintech et finance', 'Télécommunications',
  'Commerce et distribution', 'Transport et logistique', 'Tourisme et voyages',
  'Technologie', 'Association et ONG', 'Autre',
];
const allowedServices = new Set(['IN', 'OUT', 'Link', 'Virtual']);

export function validateContact(body) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Formulaire invalide.');
  function text(key, maximum, minimum = 1) {
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (value.length < minimum || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw httpError(400, `Le champ « ${{
        fullName: 'Nom complet', company: 'Entreprise', countryCode: 'Indicatif',
        phone: 'Téléphone', email: 'E-mail', sector: 'Secteur', subject: 'Objet', message: 'Message',
      }[key] || key} » est invalide (${minimum} à ${maximum} caractères).`);
    }
    return value;
  }
  if (body.website) throw httpError(400, 'Le formulaire n’a pas pu être validé.');
  const fullName = text('fullName', 120);
  const company = text('company', 160, 0);
  const countryCode = text('countryCode', 5);
  if (!/^\+\d{1,4}$/.test(countryCode)) throw httpError(400, 'Choisissez un indicatif téléphonique valide.');
  const rawPhone = text('phone', 32);
  const phone = rawPhone.replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(rawPhone) || phone.length < 6 || phone.length > 15 ||
      countryCode.length - 1 + phone.length > 15) {
    throw httpError(400, 'Veuillez saisir un numéro de téléphone valide sans répéter l’indicatif.');
  }
  const email = text('email', 254).toLowerCase();
  if (!validEmail(email)) throw httpError(400, 'Veuillez saisir une adresse e-mail valide.');
  const sector = text('sector', 72);
  if (!contactSectors.includes(sector)) throw httpError(400, 'Choisissez un secteur d’activité dans la liste.');
  if (!Array.isArray(body.services) || !body.services.length || body.services.length > 4 ||
      body.services.some(service => !allowedServices.has(service))) {
    throw httpError(400, 'Sélectionnez au moins un service BizConnectPay.');
  }
  const services = [...new Set(body.services)];
  const subject = text('subject', 180);
  const message = text('message', 5000, 10);
  if (body.consent !== true) throw httpError(400, 'Votre accord est nécessaire pour traiter votre demande.');
  const submissionId = body.submissionId;
  if (typeof submissionId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(submissionId)) {
    throw httpError(400, 'Identifiant de demande invalide. Rechargez la page.');
  }
  return { fullName, company, countryCode, phone, email, sector, services, subject, message, submissionId };
}

export function createContactRouter(getPool = () => pool) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Trop de demandes. Réessayez dans 15 minutes.' },
  }), async (req, res) => {
    if (!req.is('application/json')) throw httpError(415, 'Envoyez le formulaire au format JSON.');
    const origin = req.get('Origin');
    if (origin) {
      let allowed = false;
      try { allowed = new URL(origin).host === req.get('host'); } catch { /* invalid origin */ }
      if (!allowed) throw httpError(403, 'Origine de la demande non autorisée.');
    }
    const data = validateContact(req.body);
    const database = getPool();
    if (!database) return res.status(503).json({
      error: 'Le formulaire est temporairement indisponible. Votre message n’a pas été enregistré. Réessayez plus tard ou utilisez les coordonnées affichées.',
    });
    const [result] = await database.execute(
      `INSERT INTO contact_messages
        (submission_key, full_name, company, country_code, phone, email, sector, services, subject, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [data.submissionId, data.fullName, data.company, data.countryCode, data.phone, data.email,
        data.sector, JSON.stringify(data.services), data.subject, data.message],
    );
    res.status(result.affectedRows === 1 ? 201 : 200).json({
      message: 'Votre demande a bien été enregistrée. Notre équipe pourra vous recontacter.',
    });
  });
  return router;
}
