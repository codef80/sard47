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

// =============================================
// SardAPI — كل عمليات Supabase
// =============================================
const SardAPI = {

  // ── Auth ──
  async getSession(){
    const{data}=await _sb.auth.getSession();
    return data.session;
  },

  async signIn(emailOrPhone,password){
    let loginEmail=emailOrPhone.trim();
    // إذا كان جوال: ابحث عن الإيميل المرتبط به
    const isPhone=/^(05|5)[0-9]{7,8}$/.test(loginEmail.replace(/[\s-]/g,''));
    if(isPhone){
      // جلب الإيميل من جدول users عبر الـ phone
      // ملاحظة: يحتاج RLS يسمح بقراءة phone عامة
      const phone=loginEmail.replace(/[\s-]/g,'');
      const{data:u}=await _sb.from('users').select('id').eq('phone',phone).single();
      if(!u)throw new Error('رقم الجوال غير مسجل');
      // نحتاج getUser بالـ id - لكن Supabase لا يكشف الإيميل من جدول users
      // الحل: جدول users يخزن الإيميل أيضاً
      const{data:authU}=await _sb.from('users').select('email').eq('phone',phone).single();
      if(!authU||!authU.email)throw new Error('لم يتم ربط الجوال ببريد إلكتروني');
      loginEmail=authU.email;
    }
    const{data,error}=await _sb.auth.signInWithPassword({email:loginEmail,password});
    if(error)throw new Error(error.message==='Invalid login credentials'?'البريد/الجوال أو كلمة المرور غير صحيحة':error.message);
    return data;
  },

  // signUp يعمل بدون email confirmation إذا كان Supabase مضبوط على "Disable email confirmation"
  // أو نستخدم admin API بدلاً منه — هنا نستخدم signUp العادي
  async signUp(email,password,meta){
    const{data,error}=await _sb.auth.signUp({email,password,options:{data:meta}});
    if(error)throw new Error(error.message);
    if(!data.user)throw new Error('فشل التسجيل، حاول مرة أخرى');
    return data;
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
    await _sb.from('settings').insert({complex_id:data.id}).catch(()=>{});
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

  async createUserProfile(id,name,role,complexId,phone,status='pending',email=''){
    const{error}=await _sb.from('users').insert({id,name,role,complex_id:complexId,phone:phone||null,status,email:email||''});
    if(error)throw error;
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

  async createStudent(complexId,halaqaId,fields){
    const allowed={sid:1,name:1,track:1,guardian_phone:1,student_phone:1,parts_count:1};
    const clean={};
    Object.keys(fields).forEach(k=>{
      if(!allowed[k])return;
      // parts_count يقبل أرقام عشرية
      if(k==='parts_count')clean[k]=parseFloat(String(fields[k]||0).replace(/,/g,'.'))||0;
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
      else clean[k]=fields[k];
    });
    const{error}=await _sb.from('students').update(clean).eq('id',id);
    if(error)throw error;
  },

  async deleteStudent(id){
    const{error}=await _sb.from('students').delete().eq('id',id);
    if(error)throw error;
  },

  // استيراد بالجملة — يتحقق من الحلقات ويُنشئ أو يُحدِّث
  async upsertStudentsBulk(complexId,rows,halaqas){
    const halaqaMap={};
    (halaqas||[]).forEach(h=>{ halaqaMap[h.name]=h.id; });

    const toInsert=rows.map(r=>{
      const halaqaId=r.halaqa_id||halaqaMap[r.halaqa_name]||null;
      return{
        complex_id:complexId,
        halaqa_id:halaqaId,
        sid:String(r.sid||'').trim(),
        name:String(r.name||'').trim(),
        track:String(r.track||'').trim(),
        guardian_phone:String(r.guardian_phone||'').trim(),
        student_phone:String(r.student_phone||'').trim(),
        parts_count:parseFloat(String(r.parts_count||0).replace(/,/g,'.'))||0
      };
    }).filter(r=>r.name);

    if(!toInsert.length)throw new Error('لم يتم تحليل أي بيانات صالحة');

    // دفعات من 50
    let inserted=0;
    for(let i=0;i<toInsert.length;i+=50){
      const batch=toInsert.slice(i,i+50);
      const{error}=await _sb.from('students').insert(batch);
      if(error)throw new Error('خطأ في الاستيراد: '+error.message);
      inserted+=batch.length;
    }
    return inserted;
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

  async saveTrackConfigs(complexId,configs){
    await _sb.from('track_configs').delete().eq('complex_id',complexId);
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
      const{error}=await _sb.from('track_configs').insert(rows);
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

  async saveRecord(complexId,studentId,sections){
    // حفظ المقاطع مضغوطة — المقاطع الفارغة تُحفظ كـ {}
    const encoded=(sections||[]).map(s=>{
      if(!s||!s.partNumber||!s.hizb)return{};
      return encodeSection(s);
    });
    const{error}=await _sb.from('records').upsert({
      complex_id:complexId,
      student_id:studentId,
      sections:encoded,
      updated_at:new Date().toISOString()
    },{onConflict:'complex_id,student_id'});
    if(error)throw error;
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
};
