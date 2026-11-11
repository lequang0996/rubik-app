// Âm thanh: nhạc nền (file OGG lặp liền mạch qua WebAudio) + tiếng xoay Rubik (tổng hợp tại chỗ, gắn với thời lượng animation)
const SETTINGS = 'rubik_studio_settings';        // dùng chung file cài đặt với ngôn ngữ (giữ khoá cũ để không mất dữ liệu)

// [id, file] – tên hiển thị nằm trong locales: snd.t.<id> / snd.d.<id>
export const TRACKS = [
  ['lofi', 'audio/lofi.ogg'],
  ['focus', 'audio/focus.ogg'],
  ['box', 'audio/musicbox.ogg'],
  ['pulse', 'audio/pulse.ogg'],
];
const MUSIC_LEVEL = 0.32, SFX_LEVEL = 0.9;

function readSettings() {
  try { const d = JSON.parse(localStorage.getItem(SETTINGS) || '{}'); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function writeSettings(patch) {
  const d = readSettings();
  Object.assign(d, patch);
  try { localStorage.setItem(SETTINGS, JSON.stringify(d)); } catch { /* bỏ qua */ }
}

class Sound {
  constructor() {
    const s = readSettings();
    this.music = s.music !== false;                                   // mặc định bật cả hai
    this.sfx = s.sfx !== false;
    this.track = TRACKS.some((t) => t[0] === s.track) ? s.track : TRACKS[0][0];
    this.last = { music: true, sfx: true };                            // trạng thái trước khi tắt hết → bật lại đúng như cũ
    this.hidden = false;
    this.ctx = null; this.cur = null; this.buffers = new Map();
    this._pending = null; this._lastTurn = 0; this._handlers = [];
  }

  get on() { return this.music || this.sfx; }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  // đăng ký lắng nghe thay đổi; trả về hàm huỷ
  onChange(fn) {
    this._handlers.push(fn);
    return () => { this._handlers = this._handlers.filter((f) => f !== fn); };
  }

  // ---- bật AudioContext: trình duyệt/WebView chỉ cho phát sau lần chạm đầu tiên ----
  armUnlock() {
    const evs = ['pointerdown', 'touchend', 'keydown', 'click'];
    const go = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') evs.forEach((e) => document.removeEventListener(e, go, true));
    };
    evs.forEach((e) => document.addEventListener(e, go, true));
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor();                      // chống vỡ tiếng khi nhiều âm chồng nhau
      comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      this.master = c.createGain(); this.master.gain.value = 1;
      this.musicGain = c.createGain(); this.musicGain.gain.value = MUSIC_LEVEL;
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = SFX_LEVEL;
      this.musicGain.connect(this.master); this.sfxGain.connect(this.master);
      this.master.connect(comp); comp.connect(c.destination);
      const n = c.sampleRate, nb = c.createBuffer(1, n, c.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;      // nhiễu trắng 1 giây dùng cho tiếng ma sát/click
      this.noise = nb;
    }
    if (this.ctx.state !== 'running') this.ctx.resume().then(() => this._sync()).catch(() => {});
    this._sync();
  }

  // app xuống nền → dừng nhạc & treo AudioContext; quay lại → chạy tiếp
  setHidden(hidden) {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) {
      this._sync();
      setTimeout(() => { if (this.hidden && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }, 450);
    } else {
      this.ctx.resume().then(() => this._sync()).catch(() => {});
    }
  }

  // ---- điều khiển ----
  toggleAll() {
    if (this.on) { this.last = { music: this.music, sfx: this.sfx }; this.music = false; this.sfx = false; }
    else { this.music = this.last.music; this.sfx = this.last.sfx; if (!this.music && !this.sfx) this.music = this.sfx = true; }
    this._changed();
  }
  setMusic(v) { this.music = !!v; this._changed(); }
  setSfx(v) { this.sfx = !!v; this._changed(); }
  setTrack(id) {
    if (!TRACKS.some((t) => t[0] === id)) return;
    this.track = id; this.music = true;                               // chọn bài = muốn nghe ngay
    this._changed();
  }
  _changed() {
    writeSettings({ music: this.music, sfx: this.sfx, track: this.track });
    this.unlock();
    this._handlers.slice().forEach((f) => f());
  }

  // ---- nhạc nền ----
  async _load(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    const file = TRACKS.find((t) => t[0] === id)[1];
    const res = await fetch(file);
    const data = await res.arrayBuffer();
    const buf = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
    this.buffers.clear();                                             // chỉ giữ bài đang phát (PCM giải nén khá nặng)
    this.buffers.set(id, buf);
    return buf;
  }

  _sync() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const want = this.music && !this.hidden;
    if (want) {
      if ((!this.cur || this.cur.id !== this.track) && this._pending !== this.track) this._startTrack();
    } else this._stopCurrent(0.3);
  }

  async _startTrack() {
    const id = this.track;
    this._pending = id;
    try {
      const buf = await this._load(id);
      if (this._pending !== id) return;                               // người dùng đã đổi bài khác trong lúc tải
      this._pending = null;
      if (!this.music || this.hidden || id !== this.track) return;
      this._stopCurrent(0.6);
      const c = this.ctx, now = c.currentTime;
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 1.2);
      src.connect(g); g.connect(this.musicGain);
      src.start(now);
      this.cur = { id, src, g };
    } catch {
      if (this._pending === id) this._pending = null;
    }
  }

  _stopCurrent(fade) {
    this._pending = null;
    const cur = this.cur;
    if (!cur) return;
    this.cur = null;
    const c = this.ctx, now = c.currentTime;
    try {
      cur.g.gain.cancelScheduledValues(now);
      cur.g.gain.setValueAtTime(cur.g.gain.value, now);
      cur.g.gain.linearRampToValueAtTime(0, now + fade);
      cur.src.stop(now + fade + 0.05);
    } catch { /* đã dừng */ }
    cur.src.onended = () => { try { cur.src.disconnect(); cur.g.disconnect(); } catch { /* bỏ qua */ } };
  }

  // ---- tiếng xoay Rubik: ma sát nhựa + "tạch" khi lớp vào khớp ----
  turn(durMs) {
    const c = this.ctx;
    if (!c || !this.sfx || this.hidden || c.state !== 'running') return;
    const now = c.currentTime;
    if (now - this._lastTurn < 0.03) return;                          // các nước xếp hàng liên tiếp không chồng thành tạp âm
    this._lastTurn = now;
    const dur = Math.min(0.5, Math.max(0.1, durMs / 1000));
    this._scrape(now, dur);
    this._click(now + 0.002, 0.3);                                    // lớp bắt đầu rời khớp
    this._click(now + dur * 0.93, 0.95);                              // lớp vào khớp
  }

  _noiseSrc(offset, when) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    s.start(when, offset * this.noise.duration);
    return s;
  }

  _scrape(t0, dur) {
    const c = this.ctx, r = Math.random;
    const src = this._noiseSrc(r(), t0);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + r() * 500; bp.Q.value = 0.8;
    const hpf = c.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 500;
    const mod = c.createGain(); mod.gain.value = 0.62;                // độ "lạo xạo": biên độ rung theo tần số ~ 55-75 Hz
    const lfo = c.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 55 + r() * 20;
    const depth = c.createGain(); depth.gain.value = 0.38;
    lfo.connect(depth); depth.connect(mod.gain);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.2, t0 + dur * 0.18);
    env.gain.setValueAtTime(0.2, t0 + dur * 0.62);
    env.gain.linearRampToValueAtTime(0.0001, t0 + dur * 0.93);
    src.connect(hpf); hpf.connect(bp); bp.connect(mod); mod.connect(env); env.connect(this.sfxGain);
    lfo.start(t0);
    const end = t0 + dur + 0.05;
    src.stop(end); lfo.stop(end);
    src.onended = () => { try { src.disconnect(); lfo.disconnect(); env.disconnect(); } catch { /* bỏ qua */ } };
  }

  _click(when, vel) {
    const c = this.ctx, r = Math.random;
    const src = this._noiseSrc(r(), when);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 + r() * 1800; bp.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel * 0.95, when + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.032);
    src.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    src.stop(when + 0.06);
    // "cộp" trầm của nhựa
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(250 * (0.9 + r() * 0.25), when);
    o.frequency.exponentialRampToValueAtTime(105, when + 0.05);
    const og = c.createGain();
    og.gain.setValueAtTime(0, when);
    og.gain.linearRampToValueAtTime(vel * 0.5, when + 0.002);
    og.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    o.connect(og); og.connect(this.sfxGain);
    o.start(when); o.stop(when + 0.09);
    src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); } catch { /* bỏ qua */ } };
  }

  // ---- lễ kỷ niệm Lv 30: pháo hoa + kèn chúc mừng (tổng hợp tại chỗ, tuân theo công tắc hiệu ứng) ----
  _can() { const c = this.ctx; return !!c && this.sfx && !this.hidden && c.state === 'running' && !!this.noise; }

  _tone(f, when, dur, vol, type = 'triangle') {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(when); o.stop(when + dur + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* bỏ qua */ } };
  }

  launch() {                                                          // "vút" khi quả pháo bay lên
    if (!this._can()) return;
    const c = this.ctx, t = c.currentTime;
    const src = this._noiseSrc(Math.random(), t);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    src.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    src.stop(t + 0.7);
    src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); } catch { /* bỏ qua */ } };
  }

  boom(size = 1) {                                                    // "bùm" + lách tách khi nổ
    if (!this._can()) return;
    const c = this.ctx, t = c.currentTime, r = Math.random;
    const src = this._noiseSrc(r(), t);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2800, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * size, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(lp); lp.connect(g); g.connect(this.sfxGain);
    src.stop(t + 0.75);
    src.onended = () => { try { src.disconnect(); lp.disconnect(); g.disconnect(); } catch { /* bỏ qua */ } };
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.55 * size, t + 0.01); og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(og); og.connect(this.sfxGain); o.start(t); o.stop(t + 0.45);
    o.onended = () => { try { o.disconnect(); og.disconnect(); } catch { /* bỏ qua */ } };
    for (let i = 0; i < 6; i++) this._click(t + 0.12 + r() * 0.5, 0.18 + r() * 0.2);
  }

  fanfare() {                                                         // kèn chúc mừng: C–E–G–C rồi hợp âm
    if (!this._can()) return;
    const t0 = this.ctx.currentTime + 0.02;
    for (const [f, w, d] of [[523.25, 0, 0.22], [659.25, 0.15, 0.22], [783.99, 0.3, 0.22], [1046.5, 0.45, 0.5]]) {
      this._tone(f, t0 + w, d, 0.2); this._tone(f * 1.003, t0 + w, d, 0.036, 'square');
    }
    for (const f of [523.25, 659.25, 783.99, 1046.5]) { this._tone(f, t0 + 0.75, 1.6, 0.14); this._tone(f * 1.003, t0 + 0.75, 1.6, 0.025, 'square'); }
  }

  sparkle() {                                                         // lấp lánh khi lộ món quà
    if (!this._can()) return;
    const t0 = this.ctx.currentTime + 0.02;
    [1318.5, 1568, 2093, 2637].forEach((f, i) => this._tone(f, t0 + i * 0.09, 0.55, 0.12, 'sine'));
  }
}

export const sound = new Sound();
