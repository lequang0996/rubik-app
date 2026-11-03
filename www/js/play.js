// Tab Chơi: xáo trộn, bấm giờ, phím ảo, hoàn tác (port PlayPanel + pad_groups)
import { h, clear } from './dom.js';
import { t, tm } from './i18n.js';
import { CUBE_COLORS, FACE_DIRS } from './cubes.js';
import { PYRA_COLORS, PYRA_OPP } from './pyraminx.js';
import { SKEWB_CORNER } from './skewb.js';

const BEST_KEY = 'rubik_studio_best';
const FACE_COL = { U: CUBE_COLORS[0], D: CUBE_COLORS[1], F: CUBE_COLORS[2], B: CUBE_COLORS[3], R: CUBE_COLORS[4], L: CUBE_COLORS[5] };
const SUF3 = ['', "'", '2'], SUF2 = ['', "'"];
const COLOR_KEY = Object.fromEntries(CUBE_COLORS.map((c, i) => [c.toUpperCase(), ['yellow', 'white', 'green', 'blue', 'orange', 'red'][i]]));
const colorName = (hex) => t('color.' + (COLOR_KEY[hex.toUpperCase()] || 'white'));
const colorNames = (cols) => cols.map(colorName).join(' · ');
const pyraminxCornerColors = (v) => PYRA_OPP.filter(([opp]) => opp !== v.toUpperCase()).map(([, ci]) => PYRA_COLORS[ci]);
const skewbCornerColors = (c) => {
  const v = SKEWB_CORNER[c.toUpperCase()];
  return FACE_DIRS.filter(([, d]) => d[0] * v[0] + d[1] * v[1] + d[2] * v[2] > 0).map(([f]) => CUBE_COLORS[f]);
};

function faceOf(tok) {
  for (const ch of tok) if (FACE_COL[ch.toUpperCase()] && !/\d/.test(ch)) return ch.toUpperCase();
  return null;
}
const rows = (bases, suffixes, colorOf, hint) => bases.map((b) => {
  const col = colorOf ? colorOf(b) : null;
  return suffixes.map((s) => [b + s, col, hint ? hint(b, s) : b + s]);
});

// Các nhóm phím ảo cho từng loại puzzle: [[tên nhóm, [hàng [[token, màu, gợi ý]]]]]
export function padGroups(key) {
  const dirs = { '': t('dir.cw'), "'": t('dir.ccw'), 2: t('dir.half') };
  const faceHint = (b, s) => t('hint.face', { t: `${b}${s}`, face: t('face.' + b.slice(-1).toUpperCase()), dir: dirs[s] });
  const col = (b) => FACE_COL[faceOf(b)] || null;
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
  const rot = [['x', t('hint.rot.x')], ['y', t('hint.rot.y')], ['z', t('hint.rot.z')]];
  const rsuf = { '': '', "'": t('hint.rot.prime'), 2: t('hint.rot.half') };
  const rotation = [t('pad.rotate'), rot.map(([ax, tip]) => SUF3.map((s) => [ax + s, null, tip + rsuf[s]]))];
  const facesGroup = [t('pad.faces'), rows(faces, SUF3, col, faceHint)];
  const hint = (k) => (b, s) => t(k, { t: `${b}${s}` });
  if (key === '2x2') return [facesGroup, rotation];
  if (key === '3x3') {
    return [facesGroup,
      [t('pad.slices'), ['M', 'E', 'S'].map((b) => SUF3.map((s) => [b + s, null, t('hint.slice', { t: `${b}${s}` })]))],
      [t('pad.wide'), rows(['r', 'l', 'u', 'd', 'f', 'b'], SUF3, col, hint('hint.wide2'))],
      rotation];
  }
  if (key === '4x4') {
    return [facesGroup,
      [t('pad.wide'), rows(faces.map((f) => f + 'w'), SUF3, col, hint('hint.wide2out'))],
      [t('pad.inner'), rows(faces.map((f) => '2' + f), SUF3, col, hint('hint.second'))],
      rotation];
  }
  if (key === '5x5') {
    const inner = ['2R', '3R', '2L', '2U', '3U', '2D', '2F', '3F', '2B'];
    return [facesGroup,
      [t('pad.wide2'), rows(faces.map((f) => f + 'w'), SUF3, col, hint('hint.wide2out'))],
      [t('pad.wide3'), rows(faces.map((f) => '3' + f + 'w'), SUF3, col, hint('hint.wide3'))],
      [t('pad.inner'), rows(inner, SUF3, col, hint('hint.inner'))],
      rotation];
  }
  if (key === 'pyraminx') {
    return [[t('pad.layer'), rows(['U', 'L', 'R', 'B'], SUF2, pyraminxCornerColors,
      (b, s) => t('hint.pyra.layer', { t: `${b}${s}`, v: b, c: colorNames(pyraminxCornerColors(b)) }))],
    [t('pad.tip'), rows(['u', 'l', 'r', 'b'], SUF2, pyraminxCornerColors,
      (b, s) => t('hint.pyra.tip', { t: `${b}${s}`, v: b.toUpperCase(), c: colorNames(pyraminxCornerColors(b)) }))]];
  }
  if (key === 'skewb') {
    return [[t('pad.corner'), rows(['R', 'L', 'U', 'B'], SUF2, skewbCornerColors,
      (b, s) => t('hint.skewb', { t: `${b}${s}`, v: b, c: colorNames(skewbCornerColors(b)) }))]];
  }
  return [];
}

const fmt = (ms) => { const s = ms / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`; };

export class PlayPanel {
  constructor(view) {
    this.view = view;
    this.running = false; this.scrambled = false; this.padKey = null;
    this.t0 = 0; this.tick = null;
    try { this.best = JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch { this.best = {}; }

    this.title = h('div', { class: 'h1' }, t('mode.play'));
    this.time = h('div', { class: 'timer' }, '0:00.00');
    this.status = h('div', { class: 'stat center' });
    this.bScr = h('button', { type: 'button', class: 'action primary', onClick: () => this.scramble() }, '🔀  ' + t('play.scramble'));
    this.bReset = h('button', { type: 'button', class: 'action', onClick: () => this.reset() }, '↺ ' + t('play.reset'));
    this.bUndo = h('button', { type: 'button', class: 'action', onClick: () => view.undo() }, '↶ ' + t('play.undo'));
    this.bRedo = h('button', { type: 'button', class: 'action', onClick: () => view.redo() }, '↷ ' + t('play.redo'));
    this.slider = h('input', { type: 'range', min: 50, max: 500, value: 180, class: 'slider', 'aria-label': t('play.speed') });
    this.slider.addEventListener('input', () => view.setSpeed(+this.slider.value / 100));
    this.chipRow = h('div', { class: 'chips' });
    this.padHost = h('div', { class: 'padhost' });
    this.keyhint = h('div', { class: 'keyhint' });
    this.help = h('div', { class: 'desc' });
    this.el = h('div', { class: 'pane play' }, this.title, this.time, this.status, this.bScr,
      h('div', { class: 'row gap three' }, this.bReset, this.bUndo, this.bRedo),
      h('div', { class: 'row gap' }, h('span', { class: 'muted' }, t('play.speed')), this.slider),
      h('div', { class: 'section' }, t('play.keys')), this.chipRow, this.padHost, this.keyhint, this.help);
    view.speed = +this.slider.value / 100;
    view.on('userMoved', (n) => this.onMoved(n));
    view.on('puzzleChanged', () => this.refreshHelp());
  }

  buildPad() {
    const key = this.view.puzzle.key;
    if (key === this.padKey) return;
    this.padKey = key;
    clear(this.chipRow); clear(this.padHost);
    const groups = padGroups(key);
    this.pages = groups.map(([, rws]) => {
      const cols = rws[0].length;
      const page = h('div', { class: 'pad', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
      rws.forEach((row) => row.forEach(([tok, color, tip]) => page.append(this.keyBtn(tok, color, tip))));
      this.padHost.append(page);
      return page;
    });
    this.chips = groups.map(([title], i) => {
      const b = h('button', { type: 'button', class: 'chip', onClick: () => this.showPad(i) }, title);
      if (groups.length > 1) this.chipRow.append(b);
      return b;
    });
    this.showPad(0);
  }

  showPad(i) {
    this.pages.forEach((p, k) => { p.style.display = k === i ? '' : 'none'; });
    this.chips.forEach((c, k) => c.classList.toggle('on', k === i));
  }

  keyBtn(tok, color, tip) {
    const multi = Array.isArray(color);
    const b = h('button', { type: 'button', class: 'key', title: tip, 'aria-label': tip }, tok);
    if (color && !multi) b.style.borderBottom = `3px solid ${color}`;
    if (multi && color.length >= 2) {
      const w = 100 / color.length;
      b.append(h('span', { class: 'stripes', style: { background: `linear-gradient(90deg, ${color.map((c, i) => `${c} ${i * w}% ${(i + 1) * w}%`).join(', ')})` } }));
    }
    b.addEventListener('click', () => { this.keyhint.textContent = tip; this.view.userToken(tok); });
    return b;
  }

  refreshHelp() {
    if (!this.view.puzzle) return;
    const k = this.view.puzzle.key;
    const keys = k === 'pyraminx' || k === 'skewb' ? t('help.keys.' + k) : t('help.keys.cube');
    this.help.innerHTML = tm('help.main', { keys });
    this.title.textContent = t('play.title', { name: this.view.puzzle.title });
    this.buildPad();
    this.keyhint.textContent = '';
    this.reset();
  }

  updateTime() { this.time.textContent = fmt(performance.now() - this.t0); }
  stopTick() { if (this.tick) { clearInterval(this.tick); this.tick = null; } }

  scramble() {
    this.view.scramble();
    this.scrambled = true; this.running = false;
    this.stopTick();
    this.time.textContent = '0:00.00';
    const b = this.best[this.view.puzzle.key];
    this.status.textContent = t('play.ready') + (b ? t('play.best', { t: fmt(b) }) : '');
  }

  reset() {
    this.view.resetPuzzle();
    this.scrambled = false; this.running = false;
    this.stopTick();
    this.time.textContent = '0:00.00';
    this.status.textContent = t('play.solved');
  }

  onMoved(n) {
    if (this.scrambled && !this.running && n > 0) {
      this.running = true;
      this.t0 = performance.now();
      this.tick = setInterval(() => this.updateTime(), 30);
    }
    if (!this.running) return;
    this.status.textContent = t('play.solving', { n });
    if (this.view.puzzle.isSolved()) {
      const ms = performance.now() - this.t0;
      this.stopTick();
      this.running = false; this.scrambled = false;
      this.time.textContent = fmt(ms);
      const key = this.view.puzzle.key;
      if (!(key in this.best) || ms < this.best[key]) {
        this.best[key] = ms;
        this.status.textContent = t('play.record', { n });
        try { localStorage.setItem(BEST_KEY, JSON.stringify(this.best)); } catch { /* bỏ qua */ }
      } else this.status.textContent = t('play.win', { n, t: fmt(this.best[key]) });
    }
  }
}
