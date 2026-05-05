// =============================================
// sard/js/reports.js — منطق التقارير المشترك
// =============================================

// ─── مساعدات تنسيق ───
function fN(v) { return Number(v||0).toLocaleString('en-US'); }
function fP(v) { return Number(v||0).toLocaleString('en-US', {maximumFractionDigits:1}); }
function escH(s) { return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rkCls(r) { return r===1?'rk-1':r===2?'rk-2':r===3?'rk-3':'rk-n'; }
function pgCls(p) { return p>=80?'prog-green':p>=60?'prog-blue':p>=40?'prog-amber':'prog-red'; }
function divLabel(d) { return d===4?'الربع':d===1?'الجزء':'الحزب'; }

// ─── KPI cards ───
function kpiCard(label, value, icon, colorCls, sub) {
  return `<div class="kpi-card animate-in">
    <div class="kpi-label">${escH(label)}</div>
    <div class="kpi-value ${colorCls||''}">${escH(String(value))}</div>
    ${sub?`<div class="text-muted" style="margin-top:4px;font-size:.75rem;">${sub}</div>`:''}
    <i class="fas ${escH(icon)} kpi-float"></i></div>`;
}
function kpiCardBar(label, value, icon) {
  const pct = Math.min(Number(value)||0, 100);
  return `<div class="kpi-card animate-in">
    <div class="kpi-label">${escH(label)}</div>
    <div class="kpi-value">${fP(value)}%</div>
    <div class="prog-bar"><div class="prog-fill ${pgCls(pct)}" style="width:${pct}%"></div></div>
    <i class="fas ${escH(icon)} kpi-float"></i></div>`;
}

// ─── miniTable للمقاطع ───
function buildMiniTable(sections, partsDivisions) {
  if (!sections || !sections.length) return '<p class="text-muted" style="padding:16px;text-align:center;">لا توجد مقاطع مسجَّلة</p>';
  const div = Number(partsDivisions)||2;
  const lbl = divLabel(div);
  const map = {};
  sections.forEach(s => {
    if (!s||!s.partNumber) return;
    const pn = Number(s.partNumber); if (!pn||pn<1||pn>30) return;
    const hz = div===1?1:Number(s.hizb||1); if (hz<1||hz>div) return;
    if (!map[pn]) { map[pn]={}; for (let i=1;i<=div;i++) map[pn][i]=null; }
    map[pn][hz] = s;
  });
  const parts = Object.keys(map).sort((a,b)=>Number(a)-Number(b));
  if (!parts.length) return '<p class="text-muted" style="padding:16px;text-align:center;">لا توجد مقاطع مسجَّلة</p>';

  let thead = '<thead>';
  if (div===1) {
    thead += '<tr><th class="th-part" style="min-width:64px;">الجزء</th><th>النتيجة</th><th>الدرجة</th><th>المسمّع</th><th>التاريخ</th></tr>';
  } else {
    const hizbCols = Array.from({length:div},(_,i)=>`<th>${lbl} ${i+1}</th>`).join('');
    thead += `<tr><th class="th-part" style="min-width:56px;">جزء</th>${hizbCols}</tr>`;
  }
  thead += '</thead>';

  let tbody = '<tbody>';
  if (div===1) {
    parts.forEach(pn => {
      const s = map[pn][1];
      if (!s) return;
      tbody += `<tr>
        <td class="td-part">${pn}</td>
        <td class="${s.isPassed?'cell-pass':'cell-fail'}">${s.isPassed?'✔ ناجح':'✖ راسب'}</td>
        <td>${fP(s.score)}</td>
        <td class="text-muted" style="font-size:.75rem;">${escH(s.teacherName||'—')}</td>
        <td class="text-muted" style="font-size:.75rem;">${escH(s.date||'—')}</td>
      </tr>`;
    });
  } else {
    parts.forEach(pn => {
      let cells = '';
      for (let h=1;h<=div;h++) {
        const s = map[pn][h];
        if (!s) cells += '<td class="cell-empty">—</td>';
        else cells += `<td class="${s.isPassed?'cell-pass':'cell-fail'}" title="درجة: ${fP(s.score)}">${s.isPassed?'✔':'✖'}<small style="display:block;font-size:.65rem;color:var(--text-muted);">${fP(s.score)}</small></td>`;
      }
      tbody += `<tr><td class="td-part">${pn}</td>${cells}</tr>`;
    });
  }
  tbody += '</tbody>';

  return `<div class="mini-tbl-wrap"><table class="mini-table">${thead}${tbody}</table></div>`;
}

// =============================================
// حساب الإحصاءات من بيانات Supabase
// =============================================

function getEffSettings(student, settings, trackConfigs) {
  const tc = (trackConfigs||[]).find(t => t.name === student.track);
  const s = settings || {};
  return {
    partsDivisions:       tc?.parts_divisions      ?? s.parts_divisions      ?? 2,
    mistakeDeduction:     tc?.mistake_deduction     ?? s.mistake_deduction    ?? 0.5,
    warningDeduction:     tc?.warning_deduction     ?? s.warning_deduction    ?? 0.25,
    passingScore:         tc?.passing_score         ?? s.passing_score        ?? 7
  };
}

// حساب إحصاءات طالب واحد
function calcStudentStats(student, record, settings, trackConfigs, attendanceList) {
  const eff = getEffSettings(student, settings, trackConfigs);
  const sections = (record?.sections || []).filter(s => s && s.partNumber);
  const totalExpected = Math.ceil((Number(student.parts_count)||0) * Number(eff.partsDivisions));
  const displayed     = sections.length;
  const passed        = sections.filter(s => s.isPassed).length;
  const failed        = displayed - passed;
  const remaining     = Math.max(0, totalExpected - displayed);
  const coveragePct   = totalExpected > 0 ? (displayed / totalExpected * 100) : 0;
  const passPct       = displayed > 0 ? (passed / displayed * 100) : 0;
  const passFromExpPct= totalExpected > 0 ? (passed / totalExpected * 100) : 0;
  const failPct       = displayed > 0 ? (failed / displayed * 100) : 0;
  // درجة الطالب: متوسط الدرجات المحصلة
  const avgScore      = displayed > 0 ? (sections.reduce((acc,s)=>acc+(Number(s.score)||0),0) / displayed) : 0;
  // نسبة الطالب الشاملة (60% عرض + 40% اجتياز)
  const studentPct    = coveragePct * 0.4 + passPct * 0.6;

  // الحضور
  const attToday = attendanceList ? attendanceList.find(a => a.student_id === student.id) : null;

  return {
    id: student.id,
    name: student.name || '',
    sid: student.sid || '',
    track: student.track || '',
    halaqa_id: student.halaqa_id,
    halaqa: student.halaqa || '',
    parts_count: Number(student.parts_count)||0,
    eff,
    totalExpected,
    displayed,
    passed,
    failed,
    remaining,
    coveragePct,
    passPct,
    passFromExpPct,
    failPct,
    avgScore,
    studentPct,
    sections,
    status: attToday?.status || '',
    guardian_phone: student.guardian_phone || ''
  };
}

// حساب إحصاءات حلقة
function calcHalaqaStats(halaqa, studentStats) {
  const present    = studentStats.filter(s=>s.status==='present').length;
  const late       = studentStats.filter(s=>s.status==='late').length;
  const excused    = studentStats.filter(s=>s.status==='excused').length;
  const absent     = studentStats.filter(s=>s.status==='absent').length;
  const expected   = studentStats.reduce((a,s)=>a+s.totalExpected, 0);
  const displayed  = studentStats.reduce((a,s)=>a+s.displayed, 0);
  const passed     = studentStats.reduce((a,s)=>a+s.passed, 0);
  const failed     = studentStats.reduce((a,s)=>a+s.failed, 0);
  const remaining  = studentStats.reduce((a,s)=>a+s.remaining, 0);
  const coveragePct= expected > 0 ? (displayed / expected * 100) : 0;
  const globalPct  = studentStats.length > 0 ? (studentStats.reduce((a,s)=>a+s.studentPct,0)/studentStats.length) : 0;
  const failPct    = displayed > 0 ? (failed / displayed * 100) : 0;

  return {
    id: halaqa.id,
    name: halaqa.name,
    studentCount: studentStats.length,
    present, late, excused, absent,
    expectedParts: expected,
    displayedParts: displayed,
    passedParts: passed,
    failedParts: failed,
    remainingParts: remaining,
    coveragePercent: coveragePct,
    globalPercent: globalPct,
    failPercent: failPct,
    rank: 0, // يُحسب بعد
    students: studentStats
  };
}

// تجميع الإحصاءات الكاملة
function buildSummary(halaqas, students, records, attendance, settings, trackConfigs) {
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = attendance.filter(a => a.date === today);

  // حساب stats الطلاب
  const studentStatsMap = {};
  students.forEach(st => {
    const rec = records.find(r => r.student_id === st.id);
    studentStatsMap[st.id] = calcStudentStats(st, rec, settings, trackConfigs, todayAtt);
  });

  // حساب stats الحلقات
  const halaqaStats = halaqas.map(h => {
    const sts = students.filter(s => s.halaqa_id === h.id).map(s => studentStatsMap[s.id]);
    return calcHalaqaStats(h, sts);
  });

  // ترتيب الحلقات
  halaqaStats.sort((a,b) => b.globalPercent - a.globalPercent);
  halaqaStats.forEach((h,i) => { h.rank = i+1; });

  // ترتيب الطلاب داخل كل حلقة
  halaqaStats.forEach(h => {
    h.students.sort((a,b) => b.studentPct - a.studentPct);
    h.students.forEach((s,i) => { s.rank = i+1; });
  });

  // إحصاءات المجمع
  const center = {
    halaqaCount:    halaqas.length,
    studentCount:   students.length,
    present:        halaqaStats.reduce((a,h)=>a+h.present,0),
    late:           halaqaStats.reduce((a,h)=>a+h.late,0),
    excused:        halaqaStats.reduce((a,h)=>a+h.excused,0),
    absent:         halaqaStats.reduce((a,h)=>a+h.absent,0),
    expectedParts:  halaqaStats.reduce((a,h)=>a+h.expectedParts,0),
    displayedParts: halaqaStats.reduce((a,h)=>a+h.displayedParts,0),
    passedParts:    halaqaStats.reduce((a,h)=>a+h.passedParts,0),
    failedParts:    halaqaStats.reduce((a,h)=>a+h.failedParts,0),
    remainingParts: halaqaStats.reduce((a,h)=>a+h.remainingParts,0),
  };
  center.coveragePercent = center.expectedParts > 0 ? (center.displayedParts / center.expectedParts * 100) : 0;
  center.globalPercent   = halaqaStats.length > 0 ? (halaqaStats.reduce((a,h)=>a+h.globalPercent,0)/halaqaStats.length) : 0;

  // حساب stats المسارات
  const trackNames = [...new Set(students.map(s=>s.track).filter(Boolean))];
  const trackStats = trackNames.map(t => {
    const sts = students.filter(s=>s.track===t).map(s=>studentStatsMap[s.id]);
    const expected  = sts.reduce((a,s)=>a+s.totalExpected,0);
    const displayed = sts.reduce((a,s)=>a+s.displayed,0);
    const passed    = sts.reduce((a,s)=>a+s.passed,0);
    const failed    = sts.reduce((a,s)=>a+s.failed,0);
    const remaining = sts.reduce((a,s)=>a+s.remaining,0);
    const coverage  = expected > 0 ? (displayed/expected*100) : 0;
    const global    = sts.length > 0 ? (sts.reduce((a,s)=>a+s.studentPct,0)/sts.length) : 0;
    return { name:t, studentCount:sts.length, expectedParts:expected, displayedParts:displayed, passedParts:passed, failedParts:failed, remainingParts:remaining, coveragePercent:coverage, globalPercent:global, students:sts, rank:0 };
  });
  trackStats.sort((a,b) => b.globalPercent - a.globalPercent);
  trackStats.forEach((t,i) => t.rank = i+1);

  // أفضل الطلاب (كل المجمع)
  const allStudentStats = Object.values(studentStatsMap)
    .filter(s => s.displayed > 0)
    .sort((a,b) => b.studentPct - a.studentPct);
  allStudentStats.forEach((s,i) => s.globalRank = i+1);

  return { center, halaqas: halaqaStats, tracks: trackStats, students: allStudentStats, studentsByHalaqa: Object.fromEntries(halaqaStats.map(h=>[h.name, h.students])), studentStatsMap };
}

// ─── تحميل البيانات للتقارير ───
async function loadReportData() {
  const params = new URLSearchParams(location.search);
  const code = params.get('c') || localStorage.getItem('sard_complex_code') || '';
  if (!code) throw new Error('لا يوجد رمز مجمع');

  const complex = await SardAPI.getComplexByCode(code);
  const cid = complex.id;

  const [settings, trackConfigs, halaqas, students, records, todayAtt] = await Promise.all([
    SardAPI.getSettings(cid),
    SardAPI.getTrackConfigs(cid),
    SardAPI.getHalaqas(cid),
    SardAPI.getStudents(cid),
    SardAPI.getRecords(cid),
    SardAPI.getAttendance(cid, new Date().toISOString().split('T')[0])
  ]);

  return {
    complex,
    settings,
    trackConfigs,
    summary: buildSummary(halaqas, students, records, todayAtt, settings, trackConfigs)
  };
}

// ─── تصدير CSV ───
function exportCSV(rows, filename) {
  const BOM = '\uFEFF';
  const content = BOM + rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([content], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
