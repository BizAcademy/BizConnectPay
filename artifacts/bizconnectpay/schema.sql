-- MySQL 5.7+/8 ou MariaDB 10.3+. La base elle-même est créée dans Plesk.
-- Exécuté automatiquement au démarrage, sans DROP ni effacement des données.
CREATE TABLE IF NOT EXISTS media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slot_key VARCHAR(64) NOT NULL UNIQUE,
  kind ENUM('image','video') NOT NULL,
  mime VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  size BIGINT UNSIGNED NOT NULL,
  data LONGBLOB NOT NULL,
  alt VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscribers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions persistantes pour express-session, jamais le MemoryStore en production.
CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  session_data MEDIUMTEXT NOT NULL,
  INDEX idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
