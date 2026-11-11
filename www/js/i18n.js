// Đa ngôn ngữ: mỗi ngôn ngữ là một file JSON phẳng trong locales/ (port từ gui/i18n.py)
// [mã, tên bản ngữ, cờ quốc gia]
export const LANGS = [
  ['en', 'English', '🇬🇧'], ['zh', '简体中文', '🇨🇳'], ['es', 'Español', '🇪🇸'], ['pt', 'Português (Brasil)', '🇧🇷'],
  ['ru', 'Русский', '🇷🇺'], ['ja', '日本語', '🇯🇵'], ['ko', '한국어', '🇰🇷'], ['vi', 'Tiếng Việt', '🇻🇳'],
];
export const CODES = LANGS.map((l) => l[0]);
const DEFAULT = 'en';
const SETTINGS = 'rubik_studio_settings';
const cache = {};
const state = { lang: DEFAULT };

export async function loadLocale(code) {
  if (cache[code]) return cache[code];
  try {
    const r = await fetch(`locales/${code}.json`);
    cache[code] = await r.json();
  } catch { cache[code] = {}; }
  return cache[code];
}
export const language = () => state.lang;
export async function setLanguage(code) {
  state.lang = CODES.includes(code) ? code : DEFAULT;
  await Promise.all([loadLocale(DEFAULT), loadLocale(state.lang)]);
  document.documentElement.lang = state.lang;
  return state.lang;
}
export const has = (key) => (cache[state.lang] && key in cache[state.lang]) || (cache[DEFAULT] && key in cache[DEFAULT]);

// Chuỗi giao diện theo ngôn ngữ hiện tại (thiếu thì dùng tiếng Anh, rồi đến chính khoá)
export function t(key, kw) {
  let s = (cache[state.lang] || {})[key];
  if (s === undefined) s = (cache[DEFAULT] || {})[key];
  if (s === undefined) s = key;
  if (kw) return s.replace(/\{(\w+)\}/g, (m, k) => (k in kw ? String(kw[k]) : m));
  return s;
}

// Nhãn trong menu ngôn ngữ: "🇬🇧 - English (Tiếng Anh)" = cờ - tên bản ngữ (tên theo ngôn ngữ đang dùng)
export function langLabel(code) {
  const [, native, flag] = LANGS.find((l) => l[0] === code);
  const local = t('lang.' + code);
  return `${flag} - ${native}` + (local && local !== native ? ` (${local})` : '');
}

// Biến thể cho màn hình cảm ứng: ưu tiên khoá "<khoá>.m" nếu có
export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export function tm(key, kw) { return isTouch() && has(key + '.m') ? t(key + '.m', kw) : t(key, kw); }

const corners = (c) => (String(c) === '0' ? t('ph.c0') : t('ph.cn', { c }));
function expand(key, p) {
  if (key === 't.ollcp' || key === 't.1lll') return t(key, { edges: t('ph.e' + p.e), corners: corners(p.c) });
  if (key === 't.zbll') return t(key, { corners: corners(p.c) });
  if (key === 't.vls') return t(key, { sub: t('ph.vls' + p.xy) });
  return t(key, p);
}
// '@khoá|tham_số=giá_trị|…' → chuỗi đã dịch; văn bản thường giữ nguyên
export function td(text) {
  if (!text || text[0] !== '@') return text;
  const parts = text.slice(1).split('|');
  const params = {};
  for (const p of parts.slice(1)) {
    const i = p.indexOf('=');
    if (i >= 0) params[p.slice(0, i)] = p.slice(i + 1);
  }
  return expand(parts[0], params);
}

export function loadSaved() {
  let code = null;
  try { const l = JSON.parse(localStorage.getItem(SETTINGS) || '{}').lang; if (CODES.includes(l)) code = l; } catch { /* chưa lưu */ }
  if (!code) {
    // chưa từng chọn ngôn ngữ: theo ngôn ngữ của máy nếu app hỗ trợ (file cài đặt có thể đã tồn tại vì lưu âm thanh)
    const nav = (navigator.language || 'en').toLowerCase().slice(0, 2);
    code = CODES.includes(nav) ? nav : DEFAULT;
  }
  return setLanguage(code);
}
// true nếu người dùng đã từng chọn ngôn ngữ (lần đầu mở app thì false → hiện popup chọn ngôn ngữ)
export function hasSavedLanguage() {
  try { return CODES.includes(JSON.parse(localStorage.getItem(SETTINGS) || '{}').lang); } catch { return false; }
}
export function saveLanguage(code) {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(SETTINGS) || '{}'); } catch { /* bỏ qua */ }
  if (typeof data !== 'object' || !data) data = {};
  data.lang = code;
  try { localStorage.setItem(SETTINGS, JSON.stringify(data)); } catch { /* bỏ qua */ }
}
