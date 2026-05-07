-- ── 0. إصلاح نوع parts_count ليقبل الكسور (2.5 جزء) ──
ALTER TABLE students ALTER COLUMN parts_count TYPE numeric(5,2) USING parts_count::numeric;
ALTER TABLE track_configs ALTER COLUMN parts_divisions TYPE int USING parts_divisions::int;

-- ============================================================
-- fix_rls.sql — شغّله كاملاً في Supabase SQL Editor
-- ============================================================

-- ── 1. إضافة حقول مفقودة ──
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS approval_whatsapp_template text DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_mode text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manager_name text DEFAULT '';

-- إضافة email لجدول users (لتسجيل الدخول بالجوال)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text DEFAULT '';

-- ── 2. تعطيل تأكيد البريد (مهم جداً) ──
-- افعل هذا يدوياً في: Authentication → Settings → "Enable email confirmations" → أوقفه

-- ── 3. حذف كل الـ policies القديمة ──
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
    WHERE tablename IN ('complexes','users','settings','halaqas','students','track_configs','records','attendance')
    AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
  END LOOP;
END $$;

-- ── 4. Helper functions ──
CREATE OR REPLACE FUNCTION get_my_complex_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT complex_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 5. Complexes ──
CREATE POLICY "cx_read_all"   ON complexes FOR SELECT USING (true);
CREATE POLICY "cx_insert_all" ON complexes FOR INSERT WITH CHECK (true);
CREATE POLICY "cx_update_adm" ON complexes FOR UPDATE
  USING (get_my_role() = 'superadmin');
CREATE POLICY "cx_delete_adm" ON complexes FOR DELETE
  USING (get_my_role() = 'superadmin');

-- ── 6. Users ──
CREATE POLICY "usr_insert_pub" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "usr_select" ON users FOR SELECT
  USING (
    id = auth.uid()
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'supervisor' AND complex_id = get_my_complex_id())
  );
CREATE POLICY "usr_update" ON users FOR UPDATE
  USING (
    id = auth.uid()
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'supervisor' AND complex_id = get_my_complex_id())
  );
CREATE POLICY "usr_delete_adm" ON users FOR DELETE
  USING (get_my_role() = 'superadmin');

-- ── 7. Settings ──
CREATE POLICY "st_insert_pub" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "st_select" ON settings FOR SELECT USING (true);
CREATE POLICY "st_update" ON settings FOR UPDATE
  USING (
    complex_id = get_my_complex_id()
    OR get_my_role() = 'superadmin'
  );

-- ── 8. Halaqas (قراءة عامة للمسمّعين الزائرين) ──
CREATE POLICY "hq_select" ON halaqas FOR SELECT USING (true);
CREATE POLICY "hq_insert" ON halaqas FOR INSERT
  WITH CHECK (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');
CREATE POLICY "hq_update" ON halaqas FOR UPDATE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');
CREATE POLICY "hq_delete" ON halaqas FOR DELETE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');

-- ── 9. Students (قراءة عامة) ──
CREATE POLICY "stu_select" ON students FOR SELECT USING (true);
CREATE POLICY "stu_insert" ON students FOR INSERT
  WITH CHECK (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');
CREATE POLICY "stu_update" ON students FOR UPDATE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');
CREATE POLICY "stu_delete" ON students FOR DELETE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');

-- ── 10. Track Configs ──
CREATE POLICY "tc_select" ON track_configs FOR SELECT USING (true);
CREATE POLICY "tc_insert" ON track_configs FOR INSERT
  WITH CHECK (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');
CREATE POLICY "tc_update" ON track_configs FOR UPDATE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');
CREATE POLICY "tc_delete" ON track_configs FOR DELETE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');

-- ── 11. Records (عام - المسمّع الزائر يكتب بدون تسجيل) ──
CREATE POLICY "rec_select" ON records FOR SELECT USING (true);
CREATE POLICY "rec_insert" ON records FOR INSERT WITH CHECK (true);
CREATE POLICY "rec_update" ON records FOR UPDATE USING (true);
CREATE POLICY "rec_delete" ON records FOR DELETE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');

-- ── 12. Attendance (كتابة عامة للمشرف والمسمّع) ──
CREATE POLICY "att_select" ON attendance FOR SELECT USING (true);
CREATE POLICY "att_insert" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "att_update" ON attendance FOR UPDATE USING (true);
CREATE POLICY "att_delete" ON attendance FOR DELETE
  USING (complex_id = get_my_complex_id() OR get_my_role() = 'superadmin');

-- ── 13. تعيين السوبر أدمن ──
INSERT INTO users (id, name, role, status)
VALUES ('b8b0addc-fe62-41ed-b7f7-6ef0bf1bea43', 'Super Admin', 'superadmin', 'active')
ON CONFLICT (id) DO UPDATE SET role='superadmin', status='active';

-- ── تحقق من النجاح ──
SELECT 'تم تطبيق الإعدادات بنجاح ✓' AS result;
