// Giao diện sáng / tối. Mặc định theo hệ thống; người dùng đổi tay thì lưu lại (khoá `theme` trong cài đặt chung).
const SETTINGS = 'rubik_studio_settings';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
const handlers = [];

function readPref() {
  try { const p = JSON.parse(localStorage.getItem(SETTINGS) || '{}').theme; return p === 'light' || p === 'dark' ? p : 'auto'; } catch { return 'auto'; }
}
let pref = readPref();

// màu cho canvas (canvas không đọc được biến CSS trực tiếp) – cập nhật mỗi lần đổi theme
export const palette = { floor: 0.6 };

export function mode() { return pref === 'auto' ? (mq && mq.matches ? 'light' : 'dark') : pref; }

function apply() {
  const m = mode(), root = document.documentElement;
  root.dataset.theme = m;
  const cs = getComputedStyle(root), v = (n) => cs.getPropertyValue(n).trim();
  palette.floor = parseFloat(v('--floor')) || 0.5;
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = v('--bg');
  const sc = document.querySelector('meta[name="color-scheme"]'); if (sc) sc.content = m;
}

export function setPref(p) {
  pref = p;
  try {
    const d = JSON.parse(localStorage.getItem(SETTINGS) || '{}');
    d.theme = p; localStorage.setItem(SETTINGS, JSON.stringify(d));
  } catch { /* bỏ qua */ }
  apply();
  handlers.slice().forEach((f) => f());
}
export const toggle = () => setPref(mode() === 'dark' ? 'light' : 'dark');
export const onChange = (fn) => { handlers.push(fn); return () => handlers.splice(handlers.indexOf(fn), 1); };

if (mq) mq.addEventListener('change', () => { if (pref === 'auto') { apply(); handlers.slice().forEach((f) => f()); } });
apply();
