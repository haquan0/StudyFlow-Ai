-- StudyAI MySQL schema for production-ready backend

CREATE DATABASE IF NOT EXISTS studyai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE studyai;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  current_streak INT UNSIGNED NOT NULL DEFAULT 0,
  total_study_hours DECIMAL(7,2) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_token (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(64) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  exam_date DATE NOT NULL,
  daily_hours DECIMAL(4,1) NOT NULL DEFAULT 2.0,
  difficulty TINYINT UNSIGNED NOT NULL DEFAULT 2,
  color VARCHAR(24) NOT NULL DEFAULT '#7c3aed',
  completed_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(64) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  course_uid VARCHAR(64) NULL,
  course_id INT UNSIGNED NULL,
  name VARCHAR(220) NOT NULL,
  date DATE NOT NULL,
  duration DECIMAL(4,1) NOT NULL DEFAULT 1.0,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  done TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(64) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(220) NOT NULL,
  minutes INT UNSIGNED NOT NULL DEFAULT 0,
  course_uid VARCHAR(64) NULL,
  course_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS achievements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(64) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  achievement_key VARCHAR(120) NOT NULL,
  unlocked_at DATETIME NULL,
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_achievement (user_id, achievement_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  provider VARCHAR(60) NOT NULL,
  is_json TINYINT UNSIGNED NOT NULL DEFAULT 0,
  response_time INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  endpoint VARCHAR(120) NOT NULL,
  requests INT UNSIGNED NOT NULL DEFAULT 1,
  reset_time DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_endpoint (user_id, endpoint),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  data JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_settings_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (name, email, password_hash, current_streak, total_study_hours, created_at)
VALUES ('Demo Kullanıcı', 'demo@studyai.io', '$2y$10$KbKxHXM.s19oYqM5eVJV2OKOpboT1f1sgFA/pqBDf3RUfsT9QW4Xm', 3, 12.5, NOW());

INSERT INTO courses (uid, user_id, name, exam_date, daily_hours, difficulty, color, completed_hours, created_at)
VALUES
  ('course_demo_1', 1, 'Matematik', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 2.5, 3, '#7c3aed', 8.0, NOW()),
  ('course_demo_2', 1, 'Fizik', DATE_ADD(CURDATE(), INTERVAL 18 DAY), 1.8, 2, '#2563eb', 4.5, NOW());

INSERT INTO tasks (uid, user_id, course_uid, course_id, name, date, duration, duration_minutes, done, created_at)
VALUES
  ('task_demo_1', 1, 'course_demo_1', 1, 'Matematik konu tekrarı', CURDATE(), 2.0, 120, 0, NOW()),
  ('task_demo_2', 1, 'course_demo_2', 2, 'Fizik soru çözümü', CURDATE(), 1.5, 90, 1, NOW());

INSERT INTO study_sessions (uid, user_id, type, title, minutes, course_uid, course_id, created_at)
VALUES
  ('session_demo_1', 1, 'pomodoro', 'Pomodoro çalışması', 25, 'course_demo_1', 1, NOW()),
  ('session_demo_2', 1, 'task', 'Fizik ödevi', 45, 'course_demo_2', 2, NOW());

INSERT INTO achievements (uid, user_id, achievement_key, unlocked_at, progress, metadata, created_at)
VALUES
  ('ach_demo_1', 1, 'first_task_done', NOW(), 100, JSON_OBJECT('name', 'Ilk Gorev', 'desc', 'Ilk gorevini tamamla'), NOW()),
  ('ach_demo_2', 1, 'streak_3', NOW(), 100, JSON_OBJECT('name', '3 Gun Seri', 'desc', '3 gun ust uste aktif ol'), NOW());

INSERT INTO settings (user_id, data)
VALUES
  (1, JSON_OBJECT('aiProvider', 'gemini', 'pomodoroWork', 25, 'pomodoroShort', 5, 'pomodoroLong', 15, 'notifications', true));
