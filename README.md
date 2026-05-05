# برنامج السرد v2.0 — دليل الإعداد الكامل

## هيكل الملفات
```
sard/
├── .nojekyll               ← مطلوب لـ GitHub Pages
├── index.html              ← الصفحة الرئيسية
├── register.html           ← تسجيل وإنشاء مجمع
├── supervisor.html         ← لوحة المشرف
├── superadmin.html         ← لوحة السوبر أدمن
├── fix_rls.sql             ← ⚠ شغّله أولاً في Supabase
├── supabase_schema.sql     ← سكيما قاعدة البيانات
├── css/sard.css + reports.css
├── js/config.js + api.js + reports.js
└── pages/ (6 تقارير)
```

---

## الخطوات بالترتيب الصحيح

### 1️⃣ إعداد Supabase

**أ) تشغيل السكيما:**
- SQL Editor ← الصق `supabase_schema.sql` ← Run

**ب) إيقاف تأكيد البريد (مهم جداً!):**
```
Authentication → Settings → Auth Providers → Email
→ أوقف "Enable email confirmations"
→ Save
```
بدون هذه الخطوة، المستخدمون لن يستطيعوا الدخول بعد التسجيل.

**ج) تشغيل fix_rls.sql:**
- SQL Editor ← الصق `fix_rls.sql` ← Run
- يجب أن ترى: "تم تطبيق الإعدادات بنجاح ✓"

### 2️⃣ إنشاء حساب السوبر أدمن

```
Authentication → Users → Add User
البريد: codef3y@gmail.com
كلمة مرور: اختر كلمة مرور قوية
```

ثم في SQL Editor:
```sql
INSERT INTO users (id, name, role, status)
VALUES (
  'b8b0addc-fe62-41ed-b7f7-6ef0bf1bea43',
  'Super Admin',
  'superadmin',
  'active'
)
ON CONFLICT (id) DO UPDATE SET role='superadmin', status='active';
```

### 3️⃣ رفع الملفات على GitHub Pages

1. أنشئ Repository جديد
2. ارفع كل ملفات مجلد `sard/` (بما فيها `.nojekyll`)
3. Settings → Pages → Source: main → root
4. انتظر دقيقة → الرابط: `https://username.github.io/repo/`

### 4️⃣ أنشئ أول مجمع

افتح `register.html` ← "إنشاء برنامج سرد" ← أدخل البيانات

---

## آلية الدخول

| المستخدم | الرابط | طريقة الدخول |
|---------|--------|-------------|
| **المسمّع الزائر** | `index.html?c=RAHMA` | اسم فقط (بدون تسجيل) |
| **مسمّع مسجل** | `index.html?c=RAHMA` | اسم فقط أو "دخول بحساب" |
| **المشرف** | `index.html` ← دخول العاملين | رمز المجمع + بريد + كلمة مرور → يُوجَّه لـ supervisor.html |
| **السوبر أدمن** | `superadmin.html` | بريد + كلمة مرور |

**ملاحظة المسمّع الزائر:** لا يُضاف للـ Database — اسمه يُحفظ في localStorage فقط. هذا مقصود.

---

## استيراد الطلاب من Google Sheets

في supervisor.html → الحلقات → استيراد

**ترتيب الأعمدة في Google Sheets:**
```
A: هوية الطالب  |  B: اسم الطالب  |  C: المسار
D: الحلقة       |  E: جوال ولي الأمر  |  F: جوال الطالب  |  G: عدد الأجزاء
```

حدد كل الصفوف في Sheets ← Ctrl+C ← الصق في مربع الاستيراد

**مهم:** الحلقات يجب أن تكون موجودة في النظام أولاً قبل الاستيراد.

---

## ضغط بيانات التخزين

النظام يضغط سجلات التسميع تلقائياً:
```
قبل: {"partNumber":"3","hizb":1,"mistakes":0,"warnings":0,"score":10,"isPassed":true,"teacherName":"محمد","date":"2026-04-20"}
بعد: {"p":"3","h":1,"m":0,"w":0,"s":10,"ok":true,"t":"محمد","d":"2026-04-20"}
```
**توفير: ~60% من مساحة التخزين**

---

## حل مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| "خطأ: رمز المجمع غير صحيح" | تأكد أن الرابط يحتوي `?c=RAHMA` |
| "Invalid login credentials" | تحقق من البريد وكلمة المرور |
| التسجيل ينجح لكن الدخول يفشل | أوقف "Enable email confirmations" في Supabase |
| "new row violates row-level security" | شغّل `fix_rls.sql` مجدداً |
| التقارير تعطي خطأ | تأكد أن رابط التقرير يحتوي `?c=RAHMA` |
