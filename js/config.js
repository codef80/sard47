// =============================================
// sard/js/config.js — إعداد Supabase
// =============================================

const SARD_CONFIG = {
  supabase: {
    url: 'https://bqcwrectxxlkngzbpiwx.supabase.co',
    key: 'sb_publishable_1vfsGjMlpfv0r9TSfftWRQ_nAijq7kT'
  },
  version: '2.0.0'
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
    if (sec[full] !== undefined) out[short] = sec[full];
  }
  return out;
}

function decodeSection(sec) {
  const out = {};
  for (const [short, full] of Object.entries(SEC_DECODE)) {
    if (sec[short] !== undefined) out[full] = sec[short];
  }
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
