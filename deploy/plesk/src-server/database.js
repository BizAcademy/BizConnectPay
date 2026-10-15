import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { config, missingDbKeys, rootDir } from './config.js';
import path from 'node:path';

export let pool = null;
export async function initializeDatabase() {
  if (missingDbKeys.length) {
    if (config.preview) return false;
    throw new Error(`MySQL non configuré : ${missingDbKeys.join(', ')}. Voir .env.example.`);
  }
  const candidate = mysql.createPool(config.db);
  try {
    const connection = await candidate.getConnection();
    try {
      const schema = await readFile(path.join(rootDir, 'schema.sql'), 'utf8');
      const statements = schema.replace(/--[^\n]*/g, '').split(';').map(x => x.trim()).filter(Boolean);
      for (const statement of statements) await connection.execute(statement);
      // Non-destructive upgrade for databases created before country selection.
      const [columns] = await connection.execute("SHOW COLUMNS FROM contact_messages LIKE 'country_iso'");
      if (!columns.length) {
        try { await connection.execute("ALTER TABLE contact_messages ADD COLUMN country_iso CHAR(2) NOT NULL DEFAULT ''"); }
        catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; }
      }
      pool = candidate;
      return true;
    } finally {
      connection.release();
    }
  } catch (error) {
    // A failed initialization must not leave a live pool or enable database routes.
    await candidate.end().catch(() => {});
    throw error;
  }
}

export async function loadPublicData() {
  if (!pool) return { settings: {}, media: {}, pricingHtml: '' };
  const [settingRows] = await pool.execute('SELECT setting_key, setting_value FROM settings');
  const [mediaRows] = await pool.execute('SELECT id, slot_key, kind, mime, filename, size, alt, created_at FROM media');
  const settings = Object.fromEntries(settingRows.map(row => [row.setting_key, row.setting_value]));
  return {
    settings,
    media: Object.fromEntries(mediaRows.map(row => [row.slot_key, {
      ...row, alt_en: settings[`${row.slot_key}_alt_en`] || 'BizConnectPay illustration',
    }])),
    pricingHtml: settings.pricing_html || '',
    pricingHtmlEn: settings.pricing_html_en || '',
  };
}

export async function replaceMedia(slot, file, kind, mime, alt) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // A replacement always gets a NEW ID. Cached /media/:id bytes are immutable.
    await connection.execute('DELETE FROM media WHERE slot_key = ?', [slot]);
    await connection.execute(
      'INSERT INTO media (slot_key, kind, mime, filename, size, data, alt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [slot, kind, mime, file.originalname, file.size, file.buffer, alt],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveSettings(values) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [key, value] of Object.entries(values)) {
      await connection.execute(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, value],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
