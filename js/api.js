// =============================================
// sard/js/api.js — طبقة البيانات Supabase v2.1
// =============================================

// ─── مساعدات عامة ───
function escapeHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escapeAttr(v){return escapeHtml(v);}
function jsString(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function showSpinner(msg){const sp=document.getElementById('spinner');if(!sp)return;const p=sp.querySelector('p');if(p)p.textContent=msg||'جارٍ التحميل...';sp.style.display='flex';}
function hideSpinner(){const sp=document.getElementById('spinner');if(sp)sp.style.display='none';}
function showToast(msg,icon='success'){if(typeof Swal==='undefined'){console.warn(msg);return;}Swal.fire({toast:true,position:'bottom-end',icon:icon==='loading'?'info':icon,title:msg,showConfirmButton:false,timer:icon==='error'?4500:2800,timerProgressBar:true,didOpen:t=>{t.addEventListener('mouseenter',Swal.stopTimer);t.addEventListener('mouseleave',Swal.resumeTimer);}});}
function showSaveSuccess(msg){if(typeof Swal==='undefined')return;Swal.fire({toast:true,position:'bottom-end',icon:'success',title:msg||'تم الحفظ ✓',showConfirmButton:false,timer:2200,timerProgressBar:true});}
function btnLoading(el,txt){if(!el)return;el._h=el.innerHTML;el._d=el.disabled;el.disabled=true;el.innerHTML=`<span style="display:inline-flex;align-items:center;gap:7px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite;flex-shrink:0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>${txt||'جارٍ الحفظ...'}</span>`;}
function btnReset(el){if(!el)return;el.disabled=el._d||false;el.innerHTML=el._h||el.innerHTML;}
function pulseBtn(el){if(!el)return;el.style.transform='scale(0.93)';setTimeout(()=>{el.style.transform='';},150);}
function divLabel(div){return div===4?'الربع':div===1?'كامل':'الحزب';}

// بريد Supabase Auth يجب أن يكون فريدًا على مستوى المشروع كاملًا.
// لذلك نولّد بريد Auth داخليًا لكل مجمع، ونحفظ البريد الحقيقي في جدول users.email.
function normalizeEmail(v){return String(v??'').trim().toLowerCase();}
function normalizeComplexCode(v){return String(v??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');}
function buildAuthEmail(email,complexCode){
  email=normalizeEmail(email);
  const code=normalizeComplexCode(complexCode);
  if(!email||!code||!email.includes('@'))return email;
  const at=email.lastIndexOf('@');
  const local=email.slice(0,at);
  const domain=email.slice(at+1);
  return `${local}+sard${code.toLowerCase()}@${domain}`;
}

// =============================================
// SardAPI — كل عمليات Supabase
// =============================================
const SardAPI = {

  // ── Auth ──
  async getSession(){
    const{data}=await _sb.auth.getSession();
    return data.session;
  },

  // يحوّل ما كتبه المستخدم (بريد حقيقي أو جوال) إلى بريد Auth الفعلي.
  // complexCode يجب أن يُمرَّر صريحًا من صفحة الدخول — لا نقرأه من localStorage:
  // السوبر أدمن لا ينتمي لأي مجمع، فلو بقي رمز مجمع من زيارة سابقة لتحوّل
  // بريده إلى name+sardCODE@domain وفشل دخوله.
  async resolveAuthEmail(loginInput,complexCode=''){
    const originalLogin=String(loginInput||'').trim();
    const code=normalizeComplexCode(complexCode||'');
    if(!code)return originalLogin;

    const isPhone=/^(05|5)[0-9]{7,8}$/.test(originalLogin.replace(/[\s-]/g,''));
    // مع رمز المجمع نحاول جلب auth_email المخزن، وهذا يحافظ على المستخدمين القدامى أيضًا.
    const{data:lookupAuthEmail,error:lookupError}=await _sb.rpc('get_auth_email_for_login',{
      p_complex_code:code,
      p_login:originalLogin
    });

    if(!lookupError&&lookupAuthEmail)return lookupAuthEmail;
    // fallback للمستخدمين الجدد إذا لم توجد دالة SQL أو لم يوجد profile بعد.
    if(!isPhone)return buildAuthEmail(originalLogin,code);
    if(lookupError&&String(lookupError.message||'').includes('function')){
      throw new Error('شغّل ملف fix_registration_email_per_complex.sql أولاً لتفعيل الدخول بالجوال');
    }
    throw new Error('رقم الجوال غير مسجل في هذا المجمع');
  },

  async signIn(emailOrPhone,password,complexCode=''){
    const loginEmail=await this.resolveAuthEmail(emailOrPhone,complexCode);
    const{data,error}=await _sb.auth.signInWithPassword({email:loginEmail,password});
    if(error)throw new Error(error.message==='Invalid login credentials'?'البريد/الجوال أو كلمة المرور غير صحيحة':error.message);
    return data;
  },

  // ── استعادة كلمة المرور ──
  // رسالة الاستعادة تُرسل إلى بريد Auth. ومع تحويل البريد لكل مجمع
  // (name+sardCODE@domain) تصل الرسالة لنفس صندوق name@domain، فالمسار سليم.
  async requestPasswordReset(loginInput,complexCode=''){
    const email=await this.resolveAuthEmail(loginInput,complexCode);
    if(!email||!email.includes('@'))throw new Error('أدخل بريداً إلكترونياً صحيحاً');
    const base=location.origin+location.pathname.replace(/[^/]*$/,'');
    const{error}=await _sb.auth.resetPasswordForEmail(email,{redirectTo:base+'reset-password.html'});
    if(error)throw new Error(error.message);
    return email;
  },

  async setNewPassword(password){
    const{data,error}=await _sb.auth.updateUser({password});
    if(error)throw new Error(error.message);
    return data;
  },

  // عند وجود complexCode نولّد بريد Auth داخليًا حتى يمكن تكرار البريد الحقيقي بين مجمعات مختلفة.
  async signUp(email,password,meta={},complexCode=''){
    const realEmail=normalizeEmail(email);
    const code=normalizeComplexCode(complexCode);
    const authEmail=code?buildAuthEmail(realEmail,code):realEmail;
    const authMeta={...(meta||{}),email:realEmail,complexCode:code};

    const{data,error}=await _sb.auth.signUp({email:authEmail,password,options:{data:authMeta}});
    if(error)throw new Error(error.message);
    if(!data.user)throw new Error('فشل التسجيل، حاول مرة أخرى');
    return {...data,authEmail,realEmail};
  },

  async signOut(){await _sb.auth.signOut();},

  async getCurrentUser(){
    const{data}=await _sb.auth.getUser();
    if(!data.user)return null;
    const{data:profile}=await _sb.from('users').select('*').eq('id',data.user.id).single();
    return profile||null;
  },

  // ── المجمعات ──
  async getComplexes(){
    const{data,error}=await _sb.from('complexes').select('*').order('created_at',{ascending:false});
    if(error)throw error;
    return data||[];
  },

  async getComplexByCode(code){
    const{data,error}=await _sb.from('complexes').select('*').eq('code',code.toUpperCase()).single();
    if(error||!data)throw new Error('رمز المجمع غير صحيح');
    return data;
  },

  async createComplex(name,code){
    // إنشاء المجمع
    const{data,error}=await _sb.from('complexes').insert({name,code:code.toUpperCase()}).select().single();
    if(error){
      if(error.code==='23505')throw new Error('رمز المجمع مستخدم من قبل، اختر رمزاً آخر');
      throw error;
    }
    // إنشاء إعدادات افتراضية (تجاهل الخطأ إذا موجودة)
    const{error:settingsError}=await _sb.from('settings').insert({complex_id:data.id});
    if(settingsError&&settingsError.code!=='23505')console.warn('settings insert error:',settingsError.message);
    return data;
  },

  async deleteComplex(id){
    const{error}=await _sb.from('complexes').delete().eq('id',id);
    if(error)throw error;
  },

  async updateComplex(id,fields){
    const{error}=await _sb.from('complexes').update(fields).eq('id',id);
    if(error)throw error;
  },

  // ── المستخدمون ──
  async getUsersInComplex(complexId){
    const{data,error}=await _sb.from('users').select('*').eq('complex_id',complexId).order('created_at');
    if(error)throw error;
    return data||[];
  },

  async getAllUsers(){
    const{data,error}=await _sb.from('users').select('*,complexes(name)').order('created_at',{ascending:false});
    if(error)throw error;
    return data||[];
  },

  async createUserProfile(id,name,role,complexId,phone,status='pending',email='',authEmail=''){
    const realEmail=normalizeEmail(email);
    const{error}=await _sb.from('users').insert({
      id,
      name,
      role,
      complex_id:complexId,
      phone:phone||null,
      status,
      email:realEmail,
      auth_email:normalizeEmail(authEmail)||realEmail
    });
    if(error){
      if(error.code==='23505')throw new Error('هذا البريد أو رقم الجوال مسجل مسبقاً في نفس المجمع');
      throw error;
    }
  },

  async updateUserStatus(userId,status){
    const{error}=await _sb.from('users').update({status}).eq('id',userId);
    if(error)throw error;
  },

  async updateUserRole(userId,role){
    const{error}=await _sb.from('users').update({role}).eq('id',userId);
    if(error)throw error;
  },

  // ── الحلقات ──
  async getHalaqas(complexId){
    const{data,error}=await _sb.from('halaqas').select('*').eq('complex_id',complexId).order('name');
    if(error)throw error;
    return data||[];
  },

  async createHalaqa(complexId,name){
    const{data,error}=await _sb.from('halaqas').insert({complex_id:complexId,name}).select().single();
    if(error)throw error;
    return data;
  },

  async updateHalaqa(id,name){
    const{error}=await _sb.from('halaqas').update({name}).eq('id',id);
    if(error)throw error;
  },

  async deleteHalaqa(id){
    const{error}=await _sb.from('halaqas').delete().eq('id',id);
    if(error)throw error;
  },

  // ── الطلاب ──
  async getStudents(complexId){
    const{data,error}=await _sb.from('students')
      .select('*,halaqas(name)')
      .eq('complex_id',complexId)
      .order('name');
    if(error)throw error;
    return(data||[]).map(s=>({...s,halaqa:s.halaqas?.name||''}));
  },

  // الهوية الفارغة تُخزَّن NULL لا '' — القيد الفريد (complex_id,sid) يسمح
  // بعدة طلاب بلا هوية، لكنه يرفض تكرار نفس الهوية داخل المجمع.
  async createStudent(complexId,halaqaId,fields){
    const allowed={sid:1,name:1,track:1,guardian_phone:1,student_phone:1,parts_count:1};
    const clean={};
    Object.keys(fields).forEach(k=>{
      if(!allowed[k])return;
      // parts_count يقبل أرقام عشرية
      if(k==='parts_count')clean[k]=parseFloat(String(fields[k]||0).replace(/,/g,'.'))||0;
      else if(k==='sid')clean[k]=String(fields[k]||'').trim()||null;
      else clean[k]=fields[k];
    });
    const row={complex_id:complexId,halaqa_id:halaqaId||null,...clean};
    const{data,error}=await _sb.from('students').insert(row).select().single();
    if(error)throw error;
    return data;
  },

  async updateStudent(id,fields){
    const allowed={sid:1,name:1,track:1,guardian_phone:1,student_phone:1,parts_count:1,halaqa_id:1};
    const clean={};
    Object.keys(fields).forEach(k=>{
      if(!allowed[k])return;
      if(k==='parts_count')clean[k]=parseFloat(String(fields[k]||0).replace(/,/g,'.'))||0;
      else if(k==='sid')clean[k]=String(fields[k]||'').trim()||null;
      else clean[k]=fields[k];
    });
    const{error}=await _sb.from('students').update(clean).eq('id',id);
    if(error){
      if(error.code==='23505')throw new Error('هوية الطالب مستخدمة مسبقاً في هذا المجمع');
      throw error;
    }
  },

  async deleteStudent(id){
    const{error}=await _sb.from('students').delete().eq('id',id);
    if(error)throw error;
  },

  // استيراد بالجملة — upsert حقيقي، لا insert.
  // كان يستخدم insert دائماً، فإعادة استيراد نفس الشيت تُنشئ نسخة ثانية من كل
  // طالب، وتسميعات النسخة الأولى تختفي عن الشاشة وكأنها ضاعت.
  // الآن: الطالب صاحب الهوية يُحدَّث في مكانه عبر القيد الفريد (complex_id,sid)،
  // والصفوف بلا هوية تُطابق بالاسم داخل نفس المجمع.
  async upsertStudentsBulk(complexId,rows,halaqas){
    const halaqaMap={};
    (halaqas||[]).forEach(h=>{ halaqaMap[h.name]=h.id; });

    const parsed=rows.map(r=>{
      const halaqaId=r.halaqa_id||halaqaMap[r.halaqa_name]||null;
      return{
        complex_id:complexId,
        halaqa_id:halaqaId,
        sid:String(r.sid||'').trim()||null,
        name:String(r.name||'').trim(),
        track:String(r.track||'').trim(),
        guardian_phone:String(r.guardian_phone||'').trim(),
        student_phone:String(r.student_phone||'').trim(),
        parts_count:parseFloat(String(r.parts_count||0).replace(/,/g,'.'))||0
      };
    }).filter(r=>r.name);

    if(!parsed.length)throw new Error('لم يتم تحليل أي بيانات صالحة');

    // الهوية المكررة داخل نفس الشيت تُفشل الـ upsert، فنُبقي آخر صف لكل هوية
    const bySid=new Map();
    const noSid=[];
    parsed.forEach(r=>{ if(r.sid)bySid.set(r.sid,r); else noSid.push(r); });
    const withSid=[...bySid.values()];

    let affected=0;

    // بهوية: دفعات من 50 على القيد الفريد
    for(let i=0;i<withSid.length;i+=50){
      const batch=withSid.slice(i,i+50);
      const{error}=await _sb.from('students').upsert(batch,{onConflict:'complex_id,sid'});
      if(error)throw new Error('خطأ في الاستيراد: '+error.message);
      affected+=batch.length;
    }

    // بلا هوية: مطابقة بالاسم، وإلا إضافة
    if(noSid.length){
      const{data:existing,error:selError}=await _sb.from('students')
        .select('id,name').eq('complex_id',complexId);
      if(selError)throw new Error('خطأ في الاستيراد: '+selError.message);
      const byName=new Map();
      (existing||[]).forEach(s=>{ byName.set(String(s.name||'').trim(),s.id); });

      const toInsert=[];
      for(const r of noSid){
        const id=byName.get(r.name);
        if(!id){ toInsert.push(r); continue; }
        const{complex_id,...fields}=r;
        const{error}=await _sb.from('students').update(fields).eq('id',id);
        if(error)throw new Error('خطأ في الاستيراد: '+error.message);
        affected++;
      }
      for(let i=0;i<toInsert.length;i+=50){
        const batch=toInsert.slice(i,i+50);
        const{error}=await _sb.from('students').insert(batch);
        if(error)throw new Error('خطأ في الاستيراد: '+error.message);
        affected+=batch.length;
      }
    }

    return affected;
  },

  // ── الإعدادات ──
  async getSettings(complexId){
    const{data,error}=await _sb.from('settings').select('*').eq('complex_id',complexId).single();
    if(error&&error.code==='PGRST116'){
      // لا توجد إعدادات → إنشاء افتراضية
      const{data:d2,error:e2}=await _sb.from('settings').insert({complex_id:complexId}).select().single();
      if(e2){console.warn('settings insert error:',e2.message);return{};}
      return d2||{};
    }
    if(error){console.warn('settings fetch error:',error.message,error.code);return{};}
    return data;
  },

  async saveSettings(complexId,fields){
    // تنظيف: إزالة undefined
    const clean={};
    Object.entries(fields).forEach(([k,v])=>{if(v!==undefined)clean[k]=v;});
    const{error}=await _sb.from('settings')
      .upsert({complex_id:complexId,...clean,updated_at:new Date().toISOString()},{onConflict:'complex_id'});
    if(error)throw error;
  },

  async checkLockCode(complexId,code){
    if(!code&&code!==0)return false;
    const{data}=await _sb.from('settings').select('settings_lock_code').eq('complex_id',complexId).single();
    if(!data||!data.settings_lock_code)return false;
    return data.settings_lock_code===String(code);
  },

  // ── إعدادات المسارات ──
  async getTrackConfigs(complexId){
    const{data,error}=await _sb.from('track_configs').select('*').eq('complex_id',complexId);
    if(error)return[];
    return data||[];
  },

  // كان يحذف كل مسارات المجمع أولًا ثم يُدخل، فأي فشل في الإدخال يفقدها كلها.
  // الآن: upsert أولًا (يعتمد على القيد UNIQUE(complex_id,name))، ثم حذف ما أُزيل
  // من الواجهة فقط — والحذف بالمعرّفات لا بمطابقة أسماء داخل نص استعلام.
  async saveTrackConfigs(complexId,configs){
    const valid=(configs||[]).filter(c=>c.name);
    if(valid.length){
      const rows=valid.map(c=>({
        complex_id:complexId,
        name:c.name,
        parts_divisions:Number(c.parts_divisions)||2,
        mistake_deduction:Number(c.mistake_deduction)||0.5,
        warning_deduction:Number(c.warning_deduction)||0.25,
        passing_score:Number(c.passing_score)||7
      }));
      const{error}=await _sb.from('track_configs')
        .upsert(rows,{onConflict:'complex_id,name'});
      if(error)throw error;
    }
    const{data:existing,error:selError}=await _sb.from('track_configs')
      .select('id,name').eq('complex_id',complexId);
    if(selError)throw selError;
    const keep=new Set(valid.map(c=>c.name));
    const stale=(existing||[]).filter(r=>!keep.has(r.name)).map(r=>r.id);
    if(stale.length){
      const{error}=await _sb.from('track_configs').delete().in('id',stale);
      if(error)throw error;
    }
  },

  // ── سجلات التسميع ──
  async getRecords(complexId){
    const{data,error}=await _sb.from('records')
      .select('student_id,sections,updated_at')
      .eq('complex_id',complexId);
    if(error)throw error;
    return(data||[]).map(r=>({
      student_id:r.student_id,
      sections:decodeSections(r.sections||[]),
      updated_at:r.updated_at
    }));
  },

  // ⚠ لا ترسل مصفوفة المقاطع كاملة أبداً.
  // كانت الدالة السابقة تستبدل كل مقاطع الطالب بما في ذاكرة هذا المتصفح،
  // فتمحو أي تسميعة سجّلها مسمّع آخر بعد آخر تحديث للقطة هذه الصفحة —
  // بلا خطأ ولا تحذير. الآن نرسل ما تغيّر فقط، والدمج يتم داخل القاعدة
  // في معاملة واحدة مع قفل صف الطالب (انظر fix_records_merge.sql).
  // upserts: مقاطع كاملة بالمفاتيح الطويلة. deletes: [{partNumber,hizb}]
  async mergeRecord(complexId,studentId,upserts,deletes){
    const up=(upserts||[])
      .filter(s=>s&&s.partNumber&&s.hizb)
      .map(encodeSection);
    const del=(deletes||[])
      .filter(k=>k&&k.partNumber&&k.hizb)
      .map(k=>({p:String(k.partNumber),h:k.hizb}));
    if(!up.length&&!del.length)return null;
    const{data,error}=await _sb.rpc('sard_merge_record',{
      p_complex_id:complexId,
      p_student_id:studentId,
      p_upserts:up,
      p_deletes:del
    });
    if(error){
      if(String(error.message||'').includes('sard_merge_record'))
        throw new Error('شغّل ملف fix_records_merge.sql في Supabase أولاً');
      throw error;
    }
    return decodeSections(data||[]);
  },

  // ── الحضور ──
  async getAttendance(complexId,date){
    const{data,error}=await _sb.from('attendance')
      .select('student_id,halaqa_id,status,date')
      .eq('complex_id',complexId)
      .eq('date',date);
    if(error)return[];
    return data||[];
  },

  // تحضير البرنامج: آخر حالة محفوظة للطالب بغض النظر عن اليوم
  async getProgramAttendance(complexId){
    const{data,error}=await _sb.from('attendance')
      .select('student_id,halaqa_id,status,date,students(name,track,halaqas(name))')
      .eq('complex_id',complexId)
      .order('date',{ascending:false});
    if(error)return[];
    const seen=new Set();
    const out=[];
    (data||[]).forEach(r=>{
      if(!seen.has(r.student_id)){
        seen.add(r.student_id);
        out.push(r);
      }
    });
    return out;
  },

  async saveAttendance(complexId,halaqaId,date,entries){
    if(!entries||!entries.length)return;
    const rows=entries.map(e=>({
      complex_id:complexId,
      student_id:e.studentId,
      halaqa_id:halaqaId||null,
      date,
      status:e.status
    }));
    const{error}=await _sb.from('attendance')
      .upsert(rows,{onConflict:'complex_id,student_id,date'});
    if(error)throw error;
  },

  // يحفظ حالة واحدة فقط للطالب داخل البرنامج، وليس سجلاً يومياً متعددًا
  async saveProgramAttendance(complexId,halaqaId,entries){
    if(!entries||!entries.length)return;
    const studentIds=entries.map(e=>e.studentId).filter(Boolean);
    if(studentIds.length){
      const{error:delError}=await _sb.from('attendance')
        .delete()
        .eq('complex_id',complexId)
        .in('student_id',studentIds);
      if(delError)throw delError;
    }
    const d=new Date();
    const localDate=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const rows=entries.map(e=>({
      complex_id:complexId,
      student_id:e.studentId,
      halaqa_id:halaqaId||null,
      date:localDate,
      status:e.status
    }));
    const{error}=await _sb.from('attendance').insert(rows);
    if(error)throw error;
  },

  async getAttendanceReport(complexId,from,to){
    const{data,error}=await _sb.from('attendance')
      .select('*,students(name,track,halaqas(name))')
      .eq('complex_id',complexId)
      .gte('date',from)
      .lte('date',to)
      .order('date');
    if(error)throw error;
    return data||[];
  }
,

  // ── تنبيهات السوبر أدمن ──
  async notifySuperAdmin(type, payload={}){
    try{
      const session = await this.getSession();
      if(!session?.access_token){
        console.warn('Push skipped: no active session');
        return { ok:false, skipped:'no-session' };
      }
      const functionName = SARD_CONFIG?.push?.functionName || 'send-admin-push';
      const res = await fetch(`${SARD_CONFIG.supabase.url}/functions/v1/${functionName}`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SARD_CONFIG.supabase.key,
          'Authorization':`Bearer ${session.access_token}`
        },
        body:JSON.stringify({ type, payload })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){
        console.warn('Push notification error:', data);
        return { ok:false, error:data };
      }
      return data;
    }catch(e){
      console.warn('Push notification failed:', e);
      return { ok:false, error:e.message||String(e) };
    }
  }

};
