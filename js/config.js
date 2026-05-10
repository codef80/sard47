// =============================================
// sard/js/config.js — إعداد Supabase
// =============================================

const SARD_CONFIG = {
  supabase: {
    url: 'https://bqcwrectxxlkngzbpiwx.supabase.co',
    key: 'sb_publishable_1vfsGjMlpfv0r9TSfftWRQ_nAijq7kT'
  },
  push: {
    // مفتاح VAPID العام فقط. المفتاح الخاص يوضع في Supabase Secrets ولا يوضع في الواجهة.
    vapidPublicKey: 'BDeyBapZj_sArEVB1WV_4qgeDqUgDaiMqZr8eNa5FHmXcuCzkHLnY_KCroGb_BmIMq7YhqNMxhroZzavY19h7YI',
    functionName: 'send-admin-push'
  },
  version: '2.1.0'
};

// تهيئة Supabase client
const _sb = supabase.createClient(SARD_CONFIG.supabase.url, SARD_CONFIG.supabase.key);

// =============================================
// مساعدات مضغوطة للـ sections (توفير مساحة)
// =============================================
// المفاتيح الكاملة → القصيرة
const SEC_ENCODE = { partNumber:'p', hizb:'h', mistakes:'m', warnings:'w', score:'s', isPassed:'ok', failFace:'ff', teacherName:'t', date:'d' };
// القصيرة → الكاملة
const SEC_DECODE = Object.fromEntries(Object.entries(SEC_ENCODE).map(([k,v])=>[v,k]));

function encodeSection(sec) {
  const out = {};
  for (const [full, short] of Object.entries(SEC_ENCODE)) {
    if (sec[full] === undefined || sec[full] === null) continue;
    let v = sec[full];
    // ضغط التاريخ: "2026-04-20" → "260420"
    if (full === 'date' && v && v.includes('-')) {
      v = v.slice(2).replace(/-/g,'');  // "260420"
    }
    // حذف القيم الافتراضية لتوفير المساحة
    if (full === 'mistakes' && v === 0) continue;
    if (full === 'warnings' && v === 0) continue;
    if (full === 'failFace' && !v) continue;
    out[short] = v;
  }
  return out;
}

function decodeSection(sec) {
  const out = {};
  for (const [short, full] of Object.entries(SEC_DECODE)) {
    if (sec[short] === undefined) continue;
    let v = sec[short];
    // فك ضغط التاريخ: "260420" → "2026-04-20"
    if (full === 'date' && v && v.length === 6 && /^[0-9]{6}$/.test(String(v))) {
      v = '20'+v.slice(0,2)+'-'+v.slice(2,4)+'-'+v.slice(4,6);
    }
    out[full] = v;
  }
  // defaults للقيم المحذوفة
  if (out.mistakes === undefined) out.mistakes = 0;
  if (out.warnings === undefined) out.warnings = 0;
  if (out.failFace === undefined) out.failFace = '';
  // fallback للمفاتيح الكاملة القديمة
  for (const key of Object.keys(SEC_ENCODE)) {
    if (sec[key] !== undefined && out[key] === undefined) out[key] = sec[key];
  }
  return out;
}

function encodeSections(sections) {
  return (sections || []).map(encodeSection);
}

function decodeSections(sections) {
  return (sections || []).map(decodeSection);
}
