CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  name VARCHAR(255) NOT NULL,
  picture_url VARCHAR(2048) NULL,
  local_email VARCHAR(320) NULL UNIQUE,
  password_hash VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_expiration (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS clinical_records (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  therapist_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  age TINYINT UNSIGNED NOT NULL,
  address VARCHAR(500) NOT NULL DEFAULT '',
  medical_history TEXT NOT NULL,
  medications TEXT NOT NULL,
  chronic_conditions TEXT NOT NULL,
  routines TEXT NOT NULL,
  visible_difficulties TEXT NOT NULL,
  family_environment TEXT NOT NULL,
  housing_observation TEXT NOT NULL,
  goals TEXT NOT NULL,
  skills_to_reinforce TEXT NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_records_therapist_name (therapist_id, name),
  CONSTRAINT fk_records_therapist FOREIGN KEY (therapist_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS clinical_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_date DATE NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT '',
  session_number INT UNSIGNED NULL,
  start_time TIME NULL,
  status ENUM('scheduled', 'completed') NOT NULL DEFAULT 'completed',
  amount INT UNSIGNED NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  activities TEXT NOT NULL,
  objectives TEXT NOT NULL,
  observations TEXT NOT NULL,
  next_steps TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clinical_sessions_record_date (record_id, session_date, created_at),
  CONSTRAINT fk_clinical_sessions_record FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS clinical_reports (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(200) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  source_snapshot JSON NOT NULL,
  generated_content JSON NOT NULL,
  content JSON NOT NULL,
  model VARCHAR(128) NOT NULL,
  consented_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('draft', 'reviewed') NOT NULL DEFAULT 'draft',
  reviewed_at TIMESTAMP NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reports_record_created (record_id, created_at),
  CONSTRAINT fk_reports_record FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clinical_plans (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  record_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  materials TEXT NOT NULL,
  objectives JSON NOT NULL,
  execution_plan TEXT NOT NULL,
  observations TEXT NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plans_record_session (record_id, session_id),
  CONSTRAINT fk_plans_record FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_plans_session FOREIGN KEY (session_id) REFERENCES clinical_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
