import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const rootDir = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

function positiveNumber(key, fallback, maximum) {
  const number = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(number) || number <= 0 || number > maximum) {
    throw new Error(`${key} doit être un nombre positif, au maximum ${maximum}.`);
  }
  return number;
}

const rawBase = process.env.BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/?)*$/.test(rawBase)) throw new Error('BASE_PATH invalide.');
export const config = {
  port: positiveNumber('PORT', 3000, 65535),
  production: process.env.NODE_ENV === 'production',
  preview: process.env.SITE_PREVIEW === '1' && process.env.NODE_ENV !== 'production',
  basePath: rawBase.replace(/\/$/, ''),
  imageMaxMb: positiveNumber('IMAGE_MAX_MB', 5, 1024),
  videoMaxMb: positiveNumber('VIDEO_MAX_MB', 50, 1024),
  sessionHours: positiveNumber('SESSION_HOURS', 8, 168),
  trustProxy: process.env.TRUST_PROXY === '0' ? false : 1,
  db: {
    host: process.env.DB_HOST,
    port: positiveNumber('DB_PORT', 3306, 65535),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
    connectTimeout: 10000,
  },
};

export const missingDbKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
  .filter(key => !process.env[key]);
export const missingAdminKeys = ['SESSION_SECRET', 'ADMIN_PASSWORD']
  .filter(key => !process.env[key]);
export function assertAdminConfig() {
  if (missingAdminKeys.length) throw new Error(`Variables requises : ${missingAdminKeys.join(', ')}.`);
  if (process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
  const bytes = Buffer.byteLength(process.env.ADMIN_PASSWORD, 'utf8');
  if (bytes < 12 || bytes > 72) throw new Error('ADMIN_PASSWORD doit contenir entre 12 et 72 octets UTF-8.');
}
