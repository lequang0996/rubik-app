// Thống kê thời gian sử dụng: giây theo từng puzzle và từng mục (cross, f2l, oll…). Lưu cục bộ trên máy.
// Dạng dữ liệu: { "3x3": { "basic/cross": 120, "basic/oll": 4300, "play": 90 }, "2x2": {…} }
const KEY = 'rubik_studio_stats';

class Stats {
  constructor() {
    this.data = {}; this._n = 0; this._timer = null;
    try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); if (d && typeof d === 'object') this.data = d; } catch { /* bắt đầu từ 0 */ }
  }
  add(puzzle, bucket, sec = 1) {
    const p = (this.data[puzzle] ||= {});
    p[bucket] = (p[bucket] || 0) + sec;
  }
  total(puzzle) { return Object.values(this.data[puzzle] || {}).reduce((a, b) => a + b, 0); }
  grand() { return Object.keys(this.data).reduce((s, k) => s + this.total(k), 0); }
  buckets(puzzle) { return Object.entries(this.data[puzzle] || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* bỏ qua */ } }

  // getCtx() → { puzzle, bucket } đang xem; mỗi giây app hiển thị cộng 1 giây
  start(getCtx) {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (document.hidden) return;
      const c = getCtx();
      if (c && c.puzzle) this.add(c.puzzle, c.bucket || 'other');
      if (++this._n % 5 === 0) this.save();
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    addEventListener('pagehide', () => this.save());
  }
}
export const stats = new Stats();
