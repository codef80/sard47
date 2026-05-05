-- =============================================
-- برنامج السرد - Supabase Schema
-- =============================================

-- تفعيل UUID
create extension if not exists "uuid-ossp";

-- =============================================
-- جدول المجمعات
-- =============================================
create table complexes (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  code        text unique not null, -- رمز المجمع القصير للرابط
  created_at  timestamptz default now()
);

-- =============================================
-- جدول المستخدمين (مرتبط بـ Supabase Auth)
-- =============================================
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  complex_id  uuid references complexes(id) on delete set null,
  name        text not null,
  role        text not null check (role in ('superadmin','supervisor','reciter')),
  phone       text,
  status      text not null default 'pending' check (status in ('pending','active','rejected')),
  created_at  timestamptz default now()
);

-- =============================================
-- جدول الحلقات
-- =============================================
create table halaqas (
  id          uuid primary key default uuid_generate_v4(),
  complex_id  uuid not null references complexes(id) on delete cascade,
  name        text not null,
  created_at  timestamptz default now()
);

-- =============================================
-- جدول الطلاب
-- =============================================
create table students (
  id              uuid primary key default uuid_generate_v4(),
  complex_id      uuid not null references complexes(id) on delete cascade,
  halaqa_id       uuid references halaqas(id) on delete set null,
  sid             text,               -- هوية الطالب
  name            text not null,
  track           text,               -- المسار
  guardian_phone  text,               -- رقم ولي الأمر
  student_phone   text,               -- رقم الطالب
  parts_count     int default 0,      -- عدد الأجزاء المحفوظة
  created_at      timestamptz default now()
);

-- =============================================
-- جدول الإعدادات (لكل مجمع)
-- =============================================
create table settings (
  id                          uuid primary key default uuid_generate_v4(),
  complex_id                  uuid unique not null references complexes(id) on delete cascade,
  parts_divisions             int default 2 check (parts_divisions in (1,2,4)),
  mistake_deduction           numeric(4,2) default 0.5,
  warning_deduction           numeric(4,2) default 0.25,
  passing_score               numeric(4,2) default 7,
  show_track_in_selection     bool default false,
  hide_halaqas_use_tracks     bool default false,
  require_fail_reason         bool default false,
  active_track                text default '',
  show_reports_button         bool default false,
  lock_full_file              bool default false,
  show_delete_section         bool default false,
  settings_lock_code          text default '',
  edit_sections_code          text default '',
  whatsapp_template           text default '',
  registration_mode           text default 'auto' check (registration_mode in ('auto','manual')),
  updated_at                  timestamptz default now()
);

-- =============================================
-- جدول إعدادات المسارات الخاصة
-- =============================================
create table track_configs (
  id                    uuid primary key default uuid_generate_v4(),
  complex_id            uuid not null references complexes(id) on delete cascade,
  name                  text not null,
  parts_divisions       int default 2 check (parts_divisions in (1,2,4)),
  mistake_deduction     numeric(4,2) default 0.5,
  warning_deduction     numeric(4,2) default 0.25,
  passing_score         numeric(4,2) default 7,
  unique (complex_id, name)
);

-- =============================================
-- جدول سجلات التسميع
-- مضغوط: استخدام مفاتيح قصيرة في الـ JSON
-- البنية: [{p,h,m,w,s,ok,ff,t,d}]
-- p=partNumber, h=hizb, m=mistakes, w=warnings
-- s=score, ok=isPassed, ff=failFace, t=teacherName, d=date
-- =============================================
create table records (
  id          uuid primary key default uuid_generate_v4(),
  complex_id  uuid not null references complexes(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  sections    jsonb not null default '[]',
  updated_at  timestamptz default now(),
  unique (complex_id, student_id)
);

-- =============================================
-- جدول الحضور
-- =============================================
create table attendance (
  id          uuid primary key default uuid_generate_v4(),
  complex_id  uuid not null references complexes(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  halaqa_id   uuid references halaqas(id),
  date        date not null,
  status      text not null check (status in ('present','late','excused','absent')),
  unique (complex_id, student_id, date)
);

-- =============================================
-- Row Level Security
-- =============================================
alter table complexes      enable row level security;
alter table users          enable row level security;
alter table halaqas        enable row level security;
alter table students       enable row level security;
alter table settings       enable row level security;
alter table track_configs  enable row level security;
alter table records        enable row level security;
alter table attendance     enable row level security;

-- Superadmin يرى كل شيء (يُحدد في metadata)
-- بقية المستخدمين يرون مجمعهم فقط

create or replace function get_my_complex_id()
returns uuid language sql security definer stable as $$
  select complex_id from users where id = auth.uid()
$$;

create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from users where id = auth.uid()
$$;

-- policies للمجمعات
create policy "superadmin sees all complexes"
  on complexes for select
  using (get_my_role() = 'superadmin');

create policy "users see own complex"
  on complexes for select
  using (id = get_my_complex_id());

create policy "superadmin manages complexes"
  on complexes for all
  using (get_my_role() = 'superadmin');

-- policies عامة لبقية الجداول (نفس المجمع)
create policy "complex_isolation_select" on halaqas for select
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');
create policy "complex_isolation_all" on halaqas for all
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');

create policy "students_select" on students for select
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');
create policy "students_all" on students for all
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');

create policy "settings_select" on settings for select
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');
create policy "settings_all" on settings for all
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');

create policy "track_configs_select" on track_configs for select
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');
create policy "track_configs_all" on track_configs for all
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');

create policy "records_select" on records for select
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');
create policy "records_all" on records for all
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');

create policy "attendance_select" on attendance for select
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');
create policy "attendance_all" on attendance for all
  using (complex_id = get_my_complex_id() or get_my_role() = 'superadmin');

-- users: كل واحد يرى نفسه + المشرف يرى مجمعه + السوبر يرى الكل
create policy "users_self" on users for select
  using (id = auth.uid());
create policy "supervisor_sees_complex" on users for select
  using (complex_id = get_my_complex_id() and get_my_role() in ('supervisor','superadmin'));
create policy "supervisor_manages_complex" on users for update
  using (complex_id = get_my_complex_id() and get_my_role() in ('supervisor','superadmin'));
create policy "superadmin_all_users" on users for all
  using (get_my_role() = 'superadmin');

-- =============================================
-- Indexes للأداء
-- =============================================
create index on students(complex_id);
create index on students(halaqa_id);
create index on records(complex_id, student_id);
create index on attendance(complex_id, date);
create index on attendance(student_id, date);
create index on users(complex_id, role, status);
