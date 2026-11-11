// Giao diện thưởng: "Khối Rubik vàng ánh kim phát sáng" – mở khoá ở Lv tối đa, bật/tắt trong menu ☰
import { progress, MAX_LEVEL } from './progress.js';

const SETTINGS = 'rubik_studio_settings';     // dùng chung file cài đặt với ngôn ngữ / âm thanh
function read() {
  try { const d = JSON.parse(localStorage.getItem(SETTINGS) || '{}'); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function write(patch) {
  const d = read(); Object.assign(d, patch);
  try { localStorage.setItem(SETTINGS, JSON.stringify(d)); } catch { /* bỏ qua */ }
}

class Look {
  constructor() { this.pref = read().gold !== false; this._h = []; }      // mặc định bật khi đã mở khoá
  get unlocked() { return progress.level >= MAX_LEVEL; }
  get gold() { return this.unlocked && this.pref; }
  setGold(v) { this.pref = !!v; write({ gold: this.pref }); this.refresh(); }
  toggle() { this.setGold(!this.pref); }
  onChange(fn) { this._h.push(fn); return () => { this._h = this._h.filter((f) => f !== fn); }; }
  refresh() { this._h.slice().forEach((f) => f()); }
}
export const look = new Look();
