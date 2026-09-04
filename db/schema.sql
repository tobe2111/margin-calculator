-- 유어팀 마진 계산기 — 계정 · 저장 데이터 스키마 (Cloudflare D1)
--
--   $ npx wrangler d1 create margin-calculator
--   $ npx wrangler d1 execute margin-calculator --remote --file=db/schema.sql
--
-- 여러 번 실행해도 안전하다 (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  email_lower   TEXT NOT NULL UNIQUE,   -- 대소문자 무시 로그인용
  name          TEXT,
  password_hash TEXT NOT NULL,          -- pbkdf2$sha256$<iters>$<salt>$<hash>
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0
);

-- 세션 토큰은 원문이 아니라 SHA-256 해시로만 저장한다.
-- DB가 유출돼도 그 값으로는 로그인할 수 없다.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  user_agent  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

-- 계산 히스토리 · 저장한 상품 · 프로젝트를 한 테이블에 kind 로 구분해 담는다.
--   kind: 'calc'(메인 계산기) | 'shopee'(쇼피 국가별) | 'qoo10'(큐텐 재팬) | 'project'
CREATE TABLE IF NOT EXISTS records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  title      TEXT,
  payload    TEXT NOT NULL,             -- JSON 문자열
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_recent ON records(user_id, created_at DESC);
