// Widget hiển thị puzzle 3D: animation, kéo chuột/chạm, phát công thức (port từ gui/viewport.py)
import { rotMatrix, Move } from './puzzle.js';
import { getPuzzle } from './registry.js';
import { randomScramble } from './scramble.js';
import { render } from './render3d.js';

export const VIEWS = {
  '3x3': [-35, 28], '2x2': [-35, 28], '4x4': [-35, 28], '5x5': [-35, 28],
  pyraminx: [-40, 16], skewb: [-35, 28],
};
export const CUBE_KEYS = ['2x2', '3x3', '4x4', '5x5'];
const KEYMAP = {
  cube: { ...Object.fromEntries([...'rufldb'].map((k) => [k, k.toUpperCase()])), x: 'x', y: 'y', z: 'z', m: 'M', e: 'E', s: 'S' },
  pyraminx: Object.fromEntries([...'ulrb'].map((k) => [k, k.toUpperCase()])),
  skewb: Object.fromEntries([...'rlub'].map((k) => [k, k.toUpperCase()])),
};

const ease = (t) => t * t * (3 - 2 * t);

export function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return this; }
  clearHandlers() { this._h = {}; }
  emit(ev, ...a) { (this._h[ev] || []).forEach((f) => f(...a)); }
}

export class PuzzleView extends Emitter {
  // events: progress(i, n), playingChanged(bool), userMoved(n), puzzleChanged(), turn(durMs)
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.puzzle = null;
    this.yaw = -35; this.pitch = 28; this.zoom = 1.0;
    this.speed = 1.0;
    this.anim = null; this.frame = null;
    this.steps = []; this.stepIdx = 0; this.auto = false;
    this.baseR = null; this.playMode = false;
    this.history = []; this.redoStack = [];
    this._queue = []; this._press = null; this._drawReq = false;
    this._pointers = new Map(); this._pinch = null;
    this.w = 300; this.h = 300; this.dpr = 1;
    this.fit = false; this.zMin = 0.55; this.zMax = 1.9;   // đọc từ CSS (--cube-*), xem css/app.css
    this._bind();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.w = Math.max(50, Math.round(r.width)); this.h = Math.max(50, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    const cs = getComputedStyle(this.canvas.parentElement);
    this.fit = cs.getPropertyValue('--cube-fit').trim() === 'width';
    this.zMin = parseFloat(cs.getPropertyValue('--cube-minzoom')) || 0.55;
    this.zMax = parseFloat(cs.getPropertyValue('--cube-maxzoom')) || 1.9;
    this.zoom = this._clampZoom(this.zoom);
    this.update();
  }

  _clampZoom(z) { return Math.min(this.zMax, Math.max(this.zMin, z)); }

  // Hệ số kích thước khối. Điện thoại dọc: kích thước tính theo CHIỀU RỘNG màn hình (không phụ thuộc chiều cao khung),
  // bằng đúng mức "thu nhỏ hết cỡ" của bản trước (≈ 0,40 × chiều rộng).
  _baseScale() {
    if (!this.fit) return 1;
    const m = Math.min(this.w, this.h);
    return Math.min(0.549 * this.w / m, 1.25);
  }

  // ---------- puzzle ----------
  setPuzzle(key) {
    this.stop();
    this.puzzle = getPuzzle(key);
    [this.yaw, this.pitch] = VIEWS[key] || [-35, 28];
    this.zoom = 1.0;
    this.steps = []; this.stepIdx = 0;
    this.history = []; this.redoStack = [];
    this.baseR = this.puzzle.R.slice();
    this.emit('puzzleChanged');
    this.emit('progress', 0, 0);
    this.update();
  }

  stop() {
    this._queue.length = 0;
    this.auto = false; this.anim = null;
    this.emit('playingChanged', false);
  }

  get animating() { return this.anim !== null; }

  // ---------- animation ----------
  _startAnim(moves, done = null, fast = 1.0) {
    const items = [];
    for (const m of moves) if (this.puzzle.valid(m)) items.push([m, this.puzzle.select(m)]);
    if (!items.length) { if (done) done(); return false; }
    const big = Math.max(...items.map(([m]) => Math.abs(m.angle)));
    const dur = 330 * (0.62 + 0.38 * Math.min(1.0, big / (Math.PI / 2))) / (this.speed * fast);
    this.anim = { items, t0: performance.now(), dur, done };
    this.emit('turn', dur);                       // → phát tiếng xoay (cả Hướng dẫn, Luyện tập, Chơi)
    this._loop();
    return true;
  }

  _loop() {
    if (this._looping) return;
    this._looping = true;
    const tick = () => {
      const a = this.anim;
      if (!a) { this._looping = false; this.update(); return; }
      const t = (performance.now() - a.t0) / a.dur;
      if (t >= 1.0) {
        for (const [m] of a.items) this.puzzle.apply(m);
        this.anim = null;
        this._looping = false;
        this._draw();
        if (a.done) a.done();
        if (this.anim && !this._looping) this._loop();
        return;
      }
      this._draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- chế độ hướng dẫn ----------
  loadAlg(setupAlg, alg) {
    this.stop();
    this.puzzle.reset();
    if (setupAlg) this.puzzle.applyAlg(setupAlg);
    this.baseR = this.puzzle.R.slice();
    this.steps = this.puzzle.parse(alg);
    this.stepIdx = 0;
    this.emit('progress', 0, this.steps.length);
    this.update();
  }

  loadState(setupAlg) {
    this.stop();
    this.puzzle.reset();
    if (setupAlg) this.puzzle.applyAlg(setupAlg);
    this.baseR = this.puzzle.R.slice();
    this.steps = []; this.stepIdx = 0;
    this.emit('progress', 0, 0);
    this.update();
  }

  play() {
    if (this.animating) return;
    if (this.stepIdx >= this.steps.length) this.restart();
    this.auto = true;
    this.emit('playingChanged', true);
    this._advance();
  }
  pause() { this.auto = false; this.emit('playingChanged', false); }
  togglePlay() { if (this.auto) this.pause(); else this.play(); }

  _advance() {
    if (!this.auto) return;
    if (this.stepIdx >= this.steps.length) { this.auto = false; this.emit('playingChanged', false); return; }
    const step = this.steps[this.stepIdx];
    this._startAnim(step.moves, () => {
      this.stepIdx++;
      this.emit('progress', this.stepIdx, this.steps.length);
      if (this.auto) setTimeout(() => this._advance(), 110 / this.speed);
      if (this.stepIdx >= this.steps.length) { this.auto = false; this.emit('playingChanged', false); }
    });
  }

  stepForward() {
    if (this.animating || this.stepIdx >= this.steps.length) return;
    this.auto = false; this.emit('playingChanged', false);
    const step = this.steps[this.stepIdx];
    this._startAnim(step.moves, () => { this.stepIdx++; this.emit('progress', this.stepIdx, this.steps.length); });
  }

  stepBack() {
    if (this.animating || this.stepIdx <= 0) return;
    this.auto = false; this.emit('playingChanged', false);
    const step = this.steps[this.stepIdx - 1];
    this._startAnim([...step.moves].reverse().map((m) => m.inv()), () => { this.stepIdx--; this.emit('progress', this.stepIdx, this.steps.length); });
  }

  restart() {
    this.auto = false; this.anim = null;
    this.puzzle.R = this.baseR.slice();
    this.stepIdx = 0;
    this.emit('playingChanged', false);
    this.emit('progress', 0, this.steps.length);
    this.update();
  }

  setSpeed(s) { this.speed = s; }

  // ---------- chế độ chơi ----------
  setPlayMode(on) { this.playMode = on; this.stop(); }

  userMove(moves, record = true) {
    if (this.animating) return;
    this._startAnim(moves, () => {
      if (record) { this.history.push(moves); this.redoStack.length = 0; }
      this.emit('userMoved', this.history.length);
      this._drain();
    }, Math.min(3.0, 1 + 0.5 * this._queue.length));
  }

  // Thực hiện một nước theo ký hiệu (phím ảo/bàn phím); đang xoay thì xếp hàng
  userToken(token) {
    if (this.animating) { if (this._queue.length < 30) this._queue.push(token); return; }
    let steps;
    try { steps = this.puzzle.parse(token); } catch { return; }
    if (steps.length) this.userMove(steps[0].moves);
  }

  _drain() { if (this._queue.length && !this.animating) this.userToken(this._queue.shift()); }

  undo() {
    if (this.animating || !this.history.length) return;
    const moves = this.history.pop();
    this.redoStack.push(moves);
    this._startAnim([...moves].reverse().map((m) => m.inv()), () => this.emit('userMoved', this.history.length));
  }

  redo() {
    if (this.animating || !this.redoStack.length) return;
    const moves = this.redoStack.pop();
    this._startAnim(moves, () => { this.history.push(moves); this.emit('userMoved', this.history.length); });
  }

  scramble() {
    this.stop();
    this.puzzle.reset();
    randomScramble(this.puzzle);
    this.history = []; this.redoStack = [];
    this.emit('userMoved', 0);
    this.update();
  }

  resetPuzzle() {
    this.stop();
    this.puzzle.reset();
    this.history = []; this.redoStack = [];
    this.emit('userMoved', 0);
    this.update();
  }

  // ---------- vẽ ----------
  update() {
    if (this._drawReq) return;
    this._drawReq = true;
    requestAnimationFrame(() => { this._drawReq = false; this._draw(); });
  }

  _draw() {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!this.puzzle) return;
    const anims = [];
    if (this.anim) {
      const a = this.anim;
      const e = ease(Math.min(1.0, (performance.now() - a.t0) / a.dur));
      for (const [m, idx] of a.items) anims.push([idx, rotMatrix(m.axis, m.angle * e)]);
    }
    this.frame = render(ctx, w, h, this.puzzle, this.yaw, this.pitch, anims, this.zoom * this._baseScale(), true, -8);
  }

  // ---------- chuột / cảm ứng ----------
  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = this._clampZoom(this.zoom * 1.0015 ** (-e.deltaY));
      this.update();
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    const up = (e) => this._up(e);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  _down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    const pos = this._pos(e);
    this._pointers.set(e.pointerId, pos);
    if (this._pointers.size === 2) {           // chụm hai ngón → zoom
      const [a, b] = [...this._pointers.values()];
      this._pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom };
      this._press = null;
      return;
    }
    let hit = null;
    if (this.playMode && this.frame && !this.animating) {
      for (const [pts, , cen, nrm, piece] of this.frame.hits) {
        if (pointInPoly(pos, pts)) { hit = [cen, nrm, piece]; break; }
      }
    }
    this._press = { pos, last: pos, hit, done: false };
  }

  _move(e) {
    if (!this._pointers.has(e.pointerId)) return;
    const pos = this._pos(e);
    this._pointers.set(e.pointerId, pos);
    if (this._pinch && this._pointers.size >= 2) {
      const [a, b] = [...this._pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      this.zoom = this._clampZoom(this._pinch.z * d / Math.max(1, this._pinch.d));
      this.update();
      return;
    }
    const pr = this._press;
    if (!pr) return;
    if (pr.hit) {
      if (!pr.done) {
        const dx = pos[0] - pr.pos[0], dy = pos[1] - pr.pos[1];
        if (dx * dx + dy * dy > 90) { pr.done = true; this._dragTurn(pr.hit, [dx, dy]); }
      }
      return;
    }
    const dx = pos[0] - pr.last[0], dy = pos[1] - pr.last[1];
    pr.last = pos;
    this.yaw += dx * 0.5;
    this.pitch = Math.min(89, Math.max(-89, this.pitch + dy * 0.5));
    this.update();
  }

  _up(e) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
    if (this._pointers.size === 0) this._press = null;
  }

  _dragTurn([cen, nrm, piece], drag) {
    const fr = this.frame;
    let best = null, bs = 0;
    const base = fr.project(cen);
    const ld = Math.hypot(drag[0], drag[1]);
    for (const t of this.puzzle.pickCandidates(piece)) {
      const ax = t.axis;
      if (this.puzzle.pickExcludeParallel && Math.abs(ax[0] * nrm[0] + ax[1] * nrm[1] + ax[2] * nrm[2]) > 0.85) continue;
      const tang = [ax[1] * cen[2] - ax[2] * cen[1], ax[2] * cen[0] - ax[0] * cen[2], ax[0] * cen[1] - ax[1] * cen[0]];
      if (Math.hypot(...tang) < 1e-6) continue;
      const p2 = fr.project([cen[0] + tang[0] * 0.05, cen[1] + tang[1] * 0.05, cen[2] + tang[2] * 0.05]);
      const d = [p2[0] - base[0], p2[1] - base[1]];
      const nd = Math.hypot(d[0], d[1]);
      if (nd < 1e-9) continue;
      const sc = (d[0] * drag[0] + d[1] * drag[1]) / (nd * ld);
      if (Math.abs(sc) > Math.abs(bs)) { best = t; bs = sc; }
    }
    if (!best || Math.abs(bs) < 0.25) return;
    this.userMove([new Move(best.axis, best.lo, best.hi, best.angle * (bs > 0 ? 1 : -1))]);
  }

  // ---------- bàn phím ----------
  keyToken(key, shift) {
    if (!this.playMode || !this.puzzle) return false;
    const k = this.puzzle.key;
    const table = CUBE_KEYS.includes(k) ? KEYMAP.cube : KEYMAP[k] || {};
    let tok = table[key.toLowerCase()];
    if (tok === undefined) return false;
    if (shift) tok += "'";
    this.userToken(tok);
    return true;
  }
}
