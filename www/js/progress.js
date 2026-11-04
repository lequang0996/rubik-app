// Hệ thống cấp độ người chơi: +1 exp mỗi giây mở app; cấp n cần 2^(n-1) exp (Lv1 = 2^0 … Lv30 = 2^29)
export const EXP_PER_SECOND = 1;          // đặt số lớn (vd 1000) khi muốn thử nhanh các mốc mở khoá
export const MAX_LEVEL = 30;
const STORE = 'rubik_studio_progress';

// Mốc mở khoá
export const MODE_REQ = [0, 10, 10];      // Hướng dẫn / Luyện tập / Chơi
export const REQ_ADVANCED = 15;           // cấp nâng cao của mọi puzzle; 3x3: Tối ưu (l3) và Roux (l4)
export const REQ_COMPETITION = 20;        // 3x3: Thi đấu (l5)

// Cấp độ nội dung (basic/advanced/l3/l4/l5) cần người chơi đạt Lv bao nhiêu
export function levelReq(puzzleKey, levelId) {
  if (levelId === 'basic') return 0;
  if (puzzleKey === '3x3' && levelId === 'l5') return REQ_COMPETITION;
  return REQ_ADVANCED;
}

export const levelExp = (n) => (n <= 0 ? 0 : 2 ** (n - 1));      // tổng exp cần để đạt Lv n
export function levelOf(exp) {
  let n = 0;
  while (n < MAX_LEVEL && exp >= 2 ** n) n++;
  return n;
}

// 90 → "1m 30s", 4000 → "1h 6m", 600000 → "6d 22h"
export function fmtDuration(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const Y = 31536000, D = 86400, H = 3600, M = 60;
  if (sec >= Y) return `${Math.floor(sec / Y)}y ${Math.floor((sec % Y) / D)}d`;
  if (sec >= D) return `${Math.floor(sec / D)}d ${Math.floor((sec % D) / H)}h`;
  if (sec >= H) return `${Math.floor(sec / H)}h ${Math.floor((sec % H) / M)}m`;
  if (sec >= M) return `${Math.floor(sec / M)}m ${sec % M}s`;
  return `${sec}s`;
}

class Progress {
  constructor() {
    this.exp = 0; this._h = {}; this._timer = null; this._ticks = 0;
    try {
      const v = Number(JSON.parse(localStorage.getItem(STORE) || '{}').exp);
      if (Number.isFinite(v) && v >= 0) this.exp = Math.floor(v);
    } catch { /* bắt đầu từ 0 */ }
    this.level = levelOf(this.exp);
  }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return () => { this._h[ev] = this._h[ev].filter((f) => f !== fn); }; }
  emit(ev, ...a) { (this._h[ev] || []).slice().forEach((f) => f(...a)); }

  // vị trí trong cấp hiện tại: 0..1
  fraction() {
    if (this.level >= MAX_LEVEL) return 1;
    const lo = levelExp(this.level), hi = levelExp(this.level + 1);
    return Math.min(1, Math.max(0, (this.exp - lo) / (hi - lo)));
  }
  expToNext() { return this.level >= MAX_LEVEL ? 0 : levelExp(this.level + 1) - this.exp; }

  add(n) { this.setExp(this.exp + n); }
  setExp(v) {
    this.exp = Math.max(0, Math.floor(v));
    const old = this.level;
    this.level = levelOf(this.exp);
    this.emit('change', this.exp, this.level);
    if (this.level > old) this.emit('levelup', this.level, old);
  }

  save() { try { localStorage.setItem(STORE, JSON.stringify({ exp: this.exp })); } catch { /* bỏ qua */ } }

  // Mỗi giây app đang mở (màn hình hiển thị) cộng exp
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (document.hidden) return;
      this.add(EXP_PER_SECOND);
      if (++this._ticks % 5 === 0) this.save();
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    addEventListener('pagehide', () => this.save());
  }
}

export const progress = new Progress();
