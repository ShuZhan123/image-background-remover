-- This is an incomplete schema for NextAuth.js D1 Adapter.
-- It includes only the required tables.
-- For more information, see https://authjs.dev/reference/adapter/d1

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires TIMESTAMP NOT NULL,
  token TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, providerAccountId)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionToken TEXT NOT NULL,
  userId INTEGER NOT NULL,
  expires TIMESTAMP NOT NULL,
  UNIQUE(sessionToken)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  email_verified TIMESTAMP,
  image TEXT,
  quota_free_used INTEGER DEFAULT 0 NOT NULL,
  quota_free_total INTEGER DEFAULT 5 NOT NULL,
  quota_paid_used INTEGER DEFAULT 0 NOT NULL,
  quota_paid_total INTEGER DEFAULT 0 NOT NULL,
  plan_type TEXT DEFAULT 'free' NOT NULL, -- free, pro, premium
  plan_expires_at TIMESTAMP,
  customer_id TEXT, -- PayPal customer ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(email)
);

-- 用户处理历史记录
CREATE TABLE IF NOT EXISTS processing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_name TEXT,
  file_size INTEGER,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  status TEXT NOT NULL, -- success, failed
  error TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 订阅/支付记录
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  paypal_order_id TEXT,
  paypal_subscription_id TEXT,
  status TEXT NOT NULL, -- active, canceled, expired
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API keys (if user wants to use their own remove.bg key)
CREATE TABLE IF NOT EXISTS user_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL, -- removebg
  api_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
