-- ============================================================
-- إصلاح التسجيل: السماح بتكرار البريد الحقيقي إذا اختلف رمز المجمع
-- شغّل هذا الملف في Supabase SQL Editor مرة واحدة.
-- ============================================================

-- البريد الحقيقي للعرض والتواصل
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS auth_email text DEFAULT '';

-- لا تسمح بتكرار نفس البريد داخل نفس المجمع فقط
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_complex_email
  ON public.users (complex_id, lower(email))
  WHERE coalesce(email,'') <> '';

-- لا تسمح بتكرار نفس الجوال داخل نفس المجمع فقط
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_complex_phone
  ON public.users (complex_id, phone)
  WHERE coalesce(phone,'') <> '';

-- ملاحظة:
-- Supabase Auth لا يسمح بتكرار نفس البريد على مستوى المشروع،
-- لذلك الكود يولّد auth_email داخليًا بصيغة: name+sardCODE@domain.com
-- ويحفظ البريد الحقيقي كما أدخله المستخدم في users.email.


-- دالة آمنة تساعد تسجيل الدخول بالبريد الحقيقي أو الجوال داخل رمز المجمع
-- وتعيد auth_email الفعلي دون فتح جدول users كاملًا للعامة.
CREATE OR REPLACE FUNCTION public.get_auth_email_for_login(
  p_complex_code text,
  p_login text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_email text;
  v_login text;
  v_phone text;
BEGIN
  v_login := lower(trim(coalesce(p_login,'')));
  v_phone := regexp_replace(coalesce(p_login,''), '[\s-]', '', 'g');

  SELECT coalesce(nullif(u.auth_email,''), nullif(u.email,''))
    INTO v_auth_email
  FROM public.users u
  JOIN public.complexes c ON c.id = u.complex_id
  WHERE upper(c.code) = upper(trim(coalesce(p_complex_code,'')))
    AND (
      lower(coalesce(u.email,'')) = v_login
      OR coalesce(u.phone,'') = v_phone
    )
  ORDER BY u.created_at DESC
  LIMIT 1;

  RETURN v_auth_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_for_login(text,text) TO anon, authenticated;
