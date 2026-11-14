// Hệ thống cấp độ người chơi: Lv 1 → 30.
//  - Lên Lv 2…10: mỗi cấp cần 512 exp.   - Lên Lv 11…30: lên tới cấp n cần 2^(n-1) exp (Lv 11 = 1024 … Lv 30 = 2^29).
// Tốc độ exp mỗi giây phụ thuộc gói đang đăng ký (progress.rate, mặc định 1) – xem plans.js / billing.js.
import { BASE_RATE } from './plans.js';

export const REWARD_EXP = 100;           // mỗi lần xem hết quảng cáo có thưởng: +100 exp
export const MAX_LEVEL = 30;
const FLAT_UNTIL = 10, FLAT_COST = 512;
const STORE = 'rubik_studio_progress';
const SCHEMA = 2;                          // định dạng dữ liệu lưu: { v, exp, lv, celebrated }
// Công thức cấp độ CŨ (trước phiên bản này): cấp n khi tổng exp ≥ 2^(n-1). Chỉ dùng để suy ra cấp của dữ liệu cũ chưa lưu 'lv'.
const legacyLevelOf = (exp) => { let n = 0; while (n < MAX_LEVEL && exp >= 2 ** n) n++; return n; };
// Đọc dữ liệu đã lưu: khoá chính + bản sao dự phòng (phòng ghi dở bị hỏng JSON) → lấy bản có exp lớn hơn
function readSaved() {
  let best = {};
  for (const k of [STORE, STORE + '_bak']) {
    try {
      const d = JSON.parse(localStorage.getItem(k) || 'null');
      if (d && typeof d === 'object' && (!best.exp || Number(d.exp) > Number(best.exp))) best = d;
    } catch { /* bỏ qua bản hỏng */ }
  }
  return best;
}

// Mốc mở khoá (Lv)
export const MODE_REQ = [0, 0, 0];        // Hướng dẫn / Luyện tập / Chơi: mở sẵn từ đầu
export const REQ_STATS = 18;              // menu: Thống kê
export const REQ_ADV = { '2x2': 19, '4x4': 20, '5x5': 21 };   // cấp Nâng cao theo puzzle
export const REQ_ADV_OTHER = 19;          // Nâng cao của Pyraminx / Skewb (không có trong danh sách mốc → dùng mốc đầu tiên)
export const REQ_OPTIMAL = 22;            // 3x3: Tối ưu (l3)
export const REQ_ROUX = 23;               // 3x3: Roux (l4)
export const REQ_ULTIMATE = 24;           // 3x3: Tối thượng (l5)
export const REQ_FEEDBACK = 25;           // menu: Góp ý

// Danh sách mốc hiển thị (Lv, khoá chuỗi dịch) – dùng cho bảng cấp độ và thông báo lên cấp
export const UNLOCKS = [[REQ_STATS, 'unl.stats'], [REQ_ADV['2x2'], 'unl.adv2'], [REQ_ADV['4x4'], 'unl.adv4'], [REQ_ADV['5x5'], 'unl.adv5'],
  [REQ_OPTIMAL, 'unl.opt'], [REQ_ROUX, 'unl.roux'], [REQ_ULTIMATE, 'unl.ult'], [REQ_FEEDBACK, 'unl.fb']];

// Cấp độ nội dung (basic/advanced/l3/l4/l5) cần người chơi đạt Lv bao nhiêu
export function levelReq(puzzleKey, levelId) {
  if (levelId === 'basic') return 0;
  if (puzzleKey === '3x3') return levelId === 'l5' ? REQ_ULTIMATE : levelId === 'l4' ? REQ_ROUX : REQ_OPTIMAL;
  return REQ_ADV[puzzleKey] || REQ_ADV_OTHER;
}

// exp cần để LÊN tới cấp n (từ cấp n-1)
export const stepCost = (n) => (n <= 1 ? 0 : n <= FLAT_UNTIL ? FLAT_COST : 2 ** (n - 1));
// TOTAL[n] = tổng exp cần để đạt Lv n (Lv 1 = 0 exp)
const TOTAL = [0, 0];
for (let n = 2; n <= MAX_LEVEL; n++) TOTAL[n] = TOTAL[n - 1] + stepCost(n);

export const levelExp = (n) => TOTAL[Math.min(Math.max(n, 1), MAX_LEVEL)];      // tổng exp cần để đạt Lv n
export function levelOf(exp) {
  let n = 1;
  while (n < MAX_LEVEL && exp >= TOTAL[n + 1]) n++;
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
    this.exp = 0; this.celebrated = false; this._h = {}; this._timer = null; this._ticks = 0; this.rate = BASE_RATE;
    const d = readSaved();
    let exp = Number.isFinite(Number(d.exp)) && Number(d.exp) >= 0 ? Math.floor(Number(d.exp)) : 0;
    this.celebrated = d.celebrated === true;
    // Giữ nguyên tổng exp đã nhận VÀ cấp đã đạt khi cập nhật bản mới / đổi công thức lên cấp:
    //  - d.lv = cấp đã lưu ở lần trước (bản cũ chưa lưu thì suy ra từ công thức cũ legacyLevelOf)
    //  - công thức mới đòi nhiều exp hơn cho cấp đó → nâng exp lên đúng mốc của cấp, người chơi không bị tụt cấp
    const savedLv = Number.isFinite(Number(d.lv)) ? Number(d.lv) : (exp > 0 ? legacyLevelOf(exp) : 0);
    const keep = Math.min(MAX_LEVEL, Math.max(0, Math.floor(savedLv)));
    if (keep > 1 && levelOf(exp) < keep) exp = levelExp(keep);
    this.exp = exp;
    this.level = levelOf(this.exp);
    this.save();                                  // ghi lại ngay theo định dạng mới (và sửa khoá chính nếu vừa khôi phục từ bản sao)
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

  add(n) { if (this.level >= MAX_LEVEL) return; this.setExp(this.exp + n); }   // đạt Lv tối đa: dừng cộng exp
  grant(n) { if (n > 0) { this.setExp(this.exp + n); this.save(); } }        // thưởng / mua exp: luôn cộng và lưu ngay
  setRate(n) { this.rate = Math.max(BASE_RATE, Math.floor(Number(n)) || BASE_RATE); this.emit('rate', this.rate); }   // exp mỗi giây (theo gói)
  setExp(v) {
    this.exp = Math.max(0, Math.floor(v));
    const old = this.level;
    this.level = levelOf(this.exp);
    this.emit('change', this.exp, this.level);
    if (this.level > old) this.emit('levelup', this.level, old);
  }

  save() {
    const raw = JSON.stringify({ v: SCHEMA, exp: this.exp, lv: this.level, celebrated: this.celebrated });
    try { localStorage.setItem(STORE, raw); localStorage.setItem(STORE + '_bak', raw); } catch { /* bỏ qua */ }
  }
  markCelebrated() { this.celebrated = true; this.save(); }       // đã chiếu màn chúc mừng Lv 30 (chỉ tự chiếu một lần)

  // Mỗi giây app đang mở (màn hình hiển thị) cộng exp
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (document.hidden) return;
      this.add(this.rate);
      if (++this._ticks % 5 === 0) this.save();
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    addEventListener('pagehide', () => this.save());
  }
}

export const progress = new Progress();
