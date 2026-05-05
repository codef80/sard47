// =============================================
// sard/js/api.js — طبقة البيانات Supabase
// =============================================

// ─── مساعدات HTML ───
function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escapeAttr(v) { return escapeHtml(v); }
function jsString(v) { return String(v ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

// ─── Spinner ───
function showSpinner(msg) {
  const sp = document.getElementById('spinner');
  if (!sp) return;
  const p = sp.querySelector('p');
  if (p) p.textContent = msg || 'جارٍ التحميل...';
  sp.style.display = 'flex';
}
function hideSpinner() {
  const sp = document.getElementById('spinner');
  if (sp) sp.style.display = 'none';
}

// ─── Toast ───
function showToast(msg, icon = 'success') {
  if (typeof Swal === 'undefined') { console.warn(msg); return; }
  Swal.fire({
    toast: true, position: 'bottom-end',
    icon: icon === 'loading' ? 'info' : icon,
    title: msg, showConfirmButton: false,
    timer: icon === 'error' ? 4500 : 2800,
    timerProgressBar: true,
    didOpen: t => {
      t.addEventListener('mouseenter', Swal.stopTimer);
      t.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
}
function showSaveSuccess(msg) {
  if (typeof Swal === 'undefined') return;
  Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: msg || 'تم الحفظ ✓', showConfirmButton: false, timer: 2200, timerProgressBar: true });
}

// ─── Button loading ───
function btnLoading(el, txt) {
  if (!el) return;
  el._h = el.innerHTML; el._d = el.disabled; el.disabled = true;
  el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:7px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite;flex-shrink:0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>${txt || 'جارٍ الحفظ...'}</span>`;
}
function btnReset(el) {
  if (!el) return;
  el.disabled = el._d || false;
  el.innerHTML = el._h || el.innerHTML;
}

// ─── pulse ───
function pulseBtn(el) {
  if (!el) return;
  el.style.transform = 'scale(0.93)';
  setTimeout(() => { el.style.transform = ''; }, 150);
}

// ─── divLabel ───
function divLabel(div) {
  if (div === 4) return 'الربع';
  if (div === 1) return 'كامل';
  return 'الحزب';
}

// =============================================
// API Supabase — طبقة البيانات
// =============================================
const SardAPI = {

  // ─── Auth ───
  async getSession() {
    const { data } = await _sb.auth.getSession();
    return data.session;
  },

  async signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email, password, meta) {
    const { data, error } = await _sb.auth.signUp({
      email, password,
      options: { data: meta }
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await _sb.auth.signOut();
  },

  async getCurrentUser() {
    const { data } = await _sb.auth.getUser();
    if (!data.user) return null;
    const { data: profile } = await _sb.from('users').select('*').eq('id', data.user.id).single();
    return profile;
  },

  // ─── المجمعات ───
  async getComplexes() {
    const { data, error } = await _sb.from('complexes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getComplexByCode(code) {
    const { data, error } = await _sb.from('complexes').select('*').eq('code', code).single();
    if (error) throw error;
    return data;
  },

  async createComplex(name, code) {
    const { data, error } = await _sb.from('complexes').insert({ name, code }).select().single();
    if (error) throw error;
    // إنشاء إعدادات افتراضية
    await _sb.from('settings').insert({ complex_id: data.id });
    return data;
  },

  async deleteComplex(id) {
    const { error } = await _sb.from('complexes').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── المستخدمون ───
  async getUsersInComplex(complexId) {
    const { data, error } = await _sb.from('users').select('*').eq('complex_id', complexId).order('created_at');
    if (error) throw error;
    return data;
  },

  async getAllUsers() {
    const { data, error } = await _sb.from('users').select('*, complexes(name)').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateUserStatus(userId, status) {
    const { error } = await _sb.from('users').update({ status }).eq('id', userId);
    if (error) throw error;
  },

  async updateUserRole(userId, role) {
    const { error } = await _sb.from('users').update({ role }).eq('id', userId);
    if (error) throw error;
  },

  async createUserProfile(id, name, role, complexId, phone) {
    const { error } = await _sb.from('users').insert({ id, name, role, complex_id: complexId, phone, status: 'pending' });
    if (error) throw error;
  },

  // ─── الحلقات ───
  async getHalaqas(complexId) {
    const { data, error } = await _sb.from('halaqas').select('*').eq('complex_id', complexId).order('name');
    if (error) throw error;
    return data;
  },

  async createHalaqa(complexId, name) {
    const { data, error } = await _sb.from('halaqas').insert({ complex_id: complexId, name }).select().single();
    if (error) throw error;
    return data;
  },

  async updateHalaqa(id, name) {
    const { error } = await _sb.from('halaqas').update({ name }).eq('id', id);
    if (error) throw error;
  },

  async deleteHalaqa(id) {
    const { error } = await _sb.from('halaqas').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── الطلاب ───
  async getStudents(complexId) {
    const { data, error } = await _sb.from('students')
      .select('*, halaqas(name)')
      .eq('complex_id', complexId)
      .order('name');
    if (error) throw error;
    return data.map(s => ({ ...s, halaqa: s.halaqas?.name || '', halaqa_id: s.halaqa_id }));
  },

  async createStudent(complexId, halaqaId, fields) {
    const { data, error } = await _sb.from('students').insert({
      complex_id: complexId,
      halaqa_id: halaqaId,
      ...fields
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateStudent(id, fields) {
    const { error } = await _sb.from('students').update(fields).eq('id', id);
    if (error) throw error;
  },

  async deleteStudent(id) {
    const { error } = await _sb.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  async upsertStudents(complexId, rows) {
    // رفع الطلاب بالجملة (من Google Sheets)
    const toInsert = rows.map(r => ({
      complex_id: complexId,
      halaqa_id: r.halaqa_id || null,
      sid: r.sid || '',
      name: r.name || '',
      track: r.track || '',
      guardian_phone: r.guardian_phone || '',
      student_phone: r.student_phone || '',
      parts_count: Number(r.parts_count) || 0
    }));
    const { error } = await _sb.from('students').upsert(toInsert, { onConflict: 'id' });
    if (error) throw error;
  },

  // ─── الإعدادات ───
  async getSettings(complexId) {
    const { data, error } = await _sb.from('settings').select('*').eq('complex_id', complexId).single();
    if (error && error.code === 'PGRST116') {
      // لا إعدادات → إنشاء افتراضية
      const { data: d2 } = await _sb.from('settings').insert({ complex_id: complexId }).select().single();
      return d2;
    }
    if (error) throw error;
    return data;
  },

  async saveSettings(complexId, s) {
    const { error } = await _sb.from('settings').upsert({ complex_id: complexId, ...s, updated_at: new Date().toISOString() }, { onConflict: 'complex_id' });
    if (error) throw error;
  },

  // ─── إعدادات المسارات ───
  async getTrackConfigs(complexId) {
    const { data, error } = await _sb.from('track_configs').select('*').eq('complex_id', complexId);
    if (error) throw error;
    return data;
  },

  async saveTrackConfigs(complexId, configs) {
    // حذف الموجود وإعادة إدراج
    await _sb.from('track_configs').delete().eq('complex_id', complexId);
    if (configs.length) {
      const rows = configs.map(c => ({ complex_id: complexId, ...c }));
      const { error } = await _sb.from('track_configs').insert(rows);
      if (error) throw error;
    }
  },

  // ─── سجلات التسميع ───
  async getRecords(complexId) {
    const { data, error } = await _sb.from('records').select('*').eq('complex_id', complexId);
    if (error) throw error;
    return data.map(r => ({
      ...r,
      sections: decodeSections(r.sections || [])
    }));
  },

  async getRecordByStudent(complexId, studentId) {
    const { data, error } = await _sb.from('records')
      .select('*').eq('complex_id', complexId).eq('student_id', studentId).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return { ...data, sections: decodeSections(data.sections || []) };
  },

  async saveRecord(complexId, studentId, sections) {
    const encoded = encodeSections(sections);
    const { error } = await _sb.from('records').upsert({
      complex_id: complexId,
      student_id: studentId,
      sections: encoded,
      updated_at: new Date().toISOString()
    }, { onConflict: 'complex_id,student_id' });
    if (error) throw error;
  },

  // ─── الحضور ───
  async getAttendance(complexId, date) {
    const { data, error } = await _sb.from('attendance')
      .select('*').eq('complex_id', complexId).eq('date', date);
    if (error) throw error;
    return data;
  },

  async saveAttendance(complexId, halaqaId, date, entries) {
    // upsert لكل طالب
    const rows = entries.map(e => ({
      complex_id: complexId,
      student_id: e.studentId,
      halaqa_id: halaqaId,
      date,
      status: e.status
    }));
    const { error } = await _sb.from('attendance').upsert(rows, { onConflict: 'complex_id,student_id,date' });
    if (error) throw error;
  },

  async getAttendanceReport(complexId, from, to) {
    const { data, error } = await _sb.from('attendance')
      .select('*, students(name, track, halaqas(name))')
      .eq('complex_id', complexId)
      .gte('date', from)
      .lte('date', to)
      .order('date');
    if (error) throw error;
    return data;
  },

  // ─── تحقق رمز الإعدادات ───
  async checkLockCode(complexId, code) {
    const { data } = await _sb.from('settings').select('settings_lock_code').eq('complex_id', complexId).single();
    return data && data.settings_lock_code === code;
  }
};
