# برنامج السرد v2.0 — دليل الإعداد

## هيكل الملفات
```
sard/
├── index.html              ← صفحة المسمّع الرئيسية
├── register.html           ← تسجيل / إنشاء مجمع
├── supervisor.html         ← لوحة المشرف
├── superadmin.html         ← لوحة السوبر أدمن
├── css/
│   ├── sard.css            ← الستايل المشترك
│   └── reports.css         ← ستايل التقارير
├── js/
│   ├── config.js           ← إعداد Supabase + مساعدات الضغط
│   ├── api.js              ← طبقة البيانات (Supabase API)
│   └── reports.js          ← منطق التقارير والإحصاءات
├── pages/
│   ├── report-complex.html        ← تقرير المجمع والحلق
│   ├── report-halaqas.html        ← تقرير الحلق التفصيلي
│   ├── report-students.html       ← استعلام نتائج الطلاب
│   ├── report-honor.html          ← صفحة التكريم
│   ├── report-tracks.html         ← تقرير المسارات التفصيلي
│   └── report-complex-tracks.html ← تقرير المجمع والمسارات
└── supabase_schema.sql     ← سكيما قاعدة البيانات
```

---

## خطوات الإعداد

### 1. إعداد Supabase
1. افتح مشروعك على [supabase.com](https://supabase.com)
2. اذهب إلى **SQL Editor**
3. انسخ محتوى `supabase_schema.sql` وشغّله كاملاً
4. تأكد من تفعيل **Email Auth** في Authentication → Settings

### 2. إنشاء حساب السوبر أدمن
بعد تشغيل السكيما، نفّذ هذا في SQL Editor:
```sql
-- 1. أنشئ المستخدم عبر Supabase Auth Dashboard أولاً
-- 2. ثم نفّذ هذا باستخدام UUID من Auth:
INSERT INTO users (id, name, role, status)
VALUES ('UUID_من_Auth', 'اسمك', 'superadmin', 'active');
```

### 3. النشر على GitHub Pages
1. أنشئ Repository جديد على GitHub
2. ارفع كل الملفات
3. اذهب Settings → Pages → اختر Branch: main
4. الرابط سيكون: `https://username.github.io/repo-name/`

### 4. إنشاء أول مجمع
- افتح `register.html`
- اختر "إنشاء مجمع جديد"
- أدخل اسم المجمع والرمز (مثلاً: RAHMA)
- سيُنشأ المجمع والمشرف تلقائياً

---

## روابط الصفحات

| الصفحة | الرابط | من يستخدمها |
|--------|--------|-------------|
| التطبيق الرئيسي | `index.html?c=كود_المجمع` | المسمّعون |
| لوحة المشرف | `supervisor.html?c=كود` | المشرف |
| لوحة السوبر أدمن | `superadmin.html` | السوبر أدمن فقط |
| تسجيل جديد | `register.html` | الجميع |

---

## تقليص مساحة التخزين
النظام يضغط بيانات المقاطع تلقائياً:
```
القديم: {"partNumber":"3","hizb":1,"mistakes":0,...}
الجديد: {"p":"3","h":1,"m":0,"w":0,"s":10,"ok":true,"ff":"","t":"محمد","d":"2026-04-20"}
```
**توفير: ~60% من مساحة التخزين**

---

## ملاحظات مهمة
- كل المجمعات منعزلة عن بعض (Row Level Security)
- رمز المجمع يظهر في URL مثل: `?c=RAHMA`
- واتساب يعمل عبر `wa.me` مباشرة
- التقارير تحسب البيانات محلياً في المتصفح (سريعة)
