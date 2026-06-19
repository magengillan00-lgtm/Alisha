-- ============================================================
-- Alisha - Supabase Schema
-- مساعد AI صوتي مع أفاتار Live2D
-- ============================================================

-- ============ 1) إعدادات المستخدم ============
CREATE TABLE IF NOT EXISTS alisha_user_settings (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  response_language    TEXT NOT NULL DEFAULT 'ar' CHECK (response_language IN ('ar','en','ja')),
  selected_background  TEXT NOT NULL DEFAULT '',
  auto_change_bg       BOOLEAN NOT NULL DEFAULT FALSE,
  bg_interval_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (bg_interval_minutes >= 1),
  stt_provider         TEXT NOT NULL DEFAULT 'webspeech' CHECK (stt_provider IN ('assemblyai','webspeech')),
  active_provider      TEXT NOT NULL DEFAULT 'openrouter',
  selected_model       TEXT NOT NULL DEFAULT '',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ 2) الذاكرة الدائمة ============
CREATE TABLE IF NOT EXISTS alisha_memory (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alisha_memory_user ON alisha_memory(user_id, sort_order ASC);

-- ============ 3) مفاتيح API (مشفّرة من جهة العميل) ============
-- نخزّن المفتاح بعد تشفيره بـ Web Crypto API في المتصفح
-- (لا يمكن فك تشفيره إلا بـ key مشتق من كلمة مرور المستخدم)
CREATE TABLE IF NOT EXISTS alisha_user_keys (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,           -- المفتاح مشفّر من جهة العميل
  iv            TEXT NOT NULL,           -- initialization vector
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_alisha_user_keys_user ON alisha_user_keys(user_id);

-- ============ 4) سجل المحادثات (اختياري - للمزامنة بين الأجهزة) ============
CREATE TABLE IF NOT EXISTS alisha_messages (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alisha_messages_user ON alisha_messages(user_id, created_at DESC);

-- ============ 5) Row Level Security ============
ALTER TABLE alisha_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alisha_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE alisha_user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE alisha_messages ENABLE ROW LEVEL SECURITY;

-- سياسة عامة: كل المستخدم يرى/يعدّل بياناته فقط (user_id = auth.uid())
-- الإعدادات
CREATE POLICY "user_read_own_settings"
  ON alisha_user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_settings"
  ON alisha_user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_update_own_settings"
  ON alisha_user_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_delete_own_settings"
  ON alisha_user_settings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- الذاكرة
CREATE POLICY "user_read_own_memory"
  ON alisha_memory FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_memory"
  ON alisha_memory FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_update_own_memory"
  ON alisha_memory FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_delete_own_memory"
  ON alisha_memory FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- المفاتيح
CREATE POLICY "user_read_own_keys"
  ON alisha_user_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_keys"
  ON alisha_user_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_update_own_keys"
  ON alisha_user_keys FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_delete_own_keys"
  ON alisha_user_keys FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- الرسائل
CREATE POLICY "user_read_own_messages"
  ON alisha_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_messages"
  ON alisha_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_delete_own_messages"
  ON alisha_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============ 6) Triggers ============
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alisha_user_settings_set_updated_at ON alisha_user_settings;
CREATE TRIGGER alisha_user_settings_set_updated_at
  BEFORE UPDATE ON alisha_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS alisha_memory_set_updated_at ON alisha_memory;
CREATE TRIGGER alisha_memory_set_updated_at
  BEFORE UPDATE ON alisha_memory
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============ 7) دالة لتهيئة بيانات المستخدم الجديد تلقائياً ============
CREATE OR REPLACE FUNCTION init_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alisha_user_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS init_user_settings_on_signup ON auth.users;
CREATE TRIGGER init_user_settings_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION init_new_user_settings();
