-- =============================================================
-- fix_records_merge.sql
-- إصلاح فقد التسميعات عند عمل أكثر من مسمّع على نفس الطالب.
--
-- المشكلة: المتصفح كان يرسل مصفوفة المقاطع كاملة ويستبدل بها ما في
-- القاعدة (upsert). فأي مقطع سجّله مسمّع آخر بعد آخر تحديث للقطة
-- المتصفح كان يُمسح نهائياً بلا أي خطأ.
--
-- الحل: المتصفح يرسل المقاطع التي غيّرها فقط، والدمج يتم هنا داخل
-- معاملة واحدة مع قفل صف الطالب — فلا يتداخل مسمّعان أبداً.
-- =============================================================

create or replace function sard_merge_record(
  p_complex_id uuid,
  p_student_id uuid,
  p_upserts    jsonb default '[]'::jsonb,  -- مقاطع تُضاف أو تُعدَّل
  p_deletes    jsonb default '[]'::jsonb   -- مقاطع تُحذف، يكفي فيها {p,h}
) returns jsonb
language plpgsql
as $fn$
declare
  v_sections jsonb;
  v_item     jsonb;
  v_clean    jsonb;
  v_idx      int;
  v_len      int;
  i          int;
begin
  if p_complex_id is null or p_student_id is null then
    raise exception 'complex_id و student_id مطلوبان';
  end if;

  -- 1) اقفل صف الطالب. أي مسمّع آخر يحفظ لنفس الطالب ينتظر دوره.
  select sections into v_sections from records
   where complex_id = p_complex_id and student_id = p_student_id
   for update;

  if not found then
    insert into records (complex_id, student_id, sections, updated_at)
    values (p_complex_id, p_student_id, '[]'::jsonb, now())
    on conflict (complex_id, student_id) do nothing;

    select sections into v_sections from records
     where complex_id = p_complex_id and student_id = p_student_id
     for update;
  end if;

  v_sections := coalesce(v_sections, '[]'::jsonb);

  -- 2) الحذف: تفريغ الخانة التي تحمل نفس (الجزء، الحزب)
  for v_item in select value from jsonb_array_elements(coalesce(p_deletes, '[]'::jsonb))
  loop
    v_len := jsonb_array_length(v_sections);
    i := 0;
    while i < v_len loop
      if (v_sections -> i) ? 'p'
         and (v_sections -> i ->> 'p') = (v_item ->> 'p')
         and (v_sections -> i ->> 'h') = (v_item ->> 'h')
      then
        v_sections := jsonb_set(v_sections, array[i::text], '{}'::jsonb);
      end if;
      i := i + 1;
    end loop;
  end loop;

  -- 3) الإضافة/التعديل
  for v_item in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb))
  loop
    if (v_item ->> 'p') is null or (v_item ->> 'h') is null then
      continue;
    end if;

    -- لا نقبل إلا المفاتيح المعروفة
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean
      from jsonb_each(v_item) as t(k, v)
     where k in ('p','h','m','w','s','ok','ff','t','d');

    v_len := jsonb_array_length(v_sections);
    v_idx := null;

    -- نفس (الجزء، الحزب) موجود؟ استبدله في مكانه
    i := 0;
    while i < v_len loop
      if (v_sections -> i ->> 'p') = (v_clean ->> 'p')
         and (v_sections -> i ->> 'h') = (v_clean ->> 'h')
      then
        v_idx := i;
        exit;
      end if;
      i := i + 1;
    end loop;

    -- وإلا ضعه في أول خانة فارغة
    if v_idx is null then
      i := 0;
      while i < v_len loop
        if not ((v_sections -> i) ? 'p') then
          v_idx := i;
          exit;
        end if;
        i := i + 1;
      end loop;
    end if;

    -- وإلا ألحقه في النهاية
    if v_idx is null then
      v_sections := v_sections || jsonb_build_array(v_clean);
    else
      v_sections := jsonb_set(v_sections, array[v_idx::text], v_clean);
    end if;
  end loop;

  update records
     set sections = v_sections, updated_at = now()
   where complex_id = p_complex_id and student_id = p_student_id;

  return v_sections;
end;
$fn$;

-- =============================================================
-- منع تكرار الطلاب عند إعادة الاستيراد
-- كان الاستيراد يستخدم insert دائماً، فإعادة استيراد نفس الشيت
-- تُنشئ نسخة ثانية من كل طالب، وتسميعات النسخة الأولى تختفي عن الشاشة.
-- =============================================================
-- الهوية الفارغة تُخزَّن NULL، وبوستجرس لا يعتبر NULL متعارضاً مع NULL،
-- فيبقى مسموحاً بعدة طلاب بلا هوية، ويُمنع تكرار نفس الهوية داخل المجمع.
update students set sid = null where sid is not null and btrim(sid) = '';

drop index if exists students_complex_sid_uniq;

create unique index students_complex_sid_uniq
  on students (complex_id, sid);
