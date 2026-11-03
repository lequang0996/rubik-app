// Thành phần giao diện dùng chung (port từ gui/panels.py + viewport.LegendButton)
import { h, clear, esc } from './dom.js';
import { t, td } from './i18n.js';
import { moveCount } from './data.js';
import { caseImage } from './diagrams.js';
import { getPuzzle } from './registry.js';
import { CUBE_COLORS } from './cubes.js';

// ------------------------------------------------------------------ Segmented
export class Segmented {
  constructor(labels, onChange, tips = null) {
    this.el = h('div', { class: 'seg' });
    this.onChange = onChange;
    this.setItems(labels, tips);
  }
  setItems(labels, tips = null) {
    clear(this.el);
    this.buttons = labels.map((label, i) => {
      const b = h('button', { type: 'button', class: 'seg-btn', title: (tips && tips[i]) || null, onClick: () => { this.setIndex(i); this.onChange(i); } }, label);
      this.el.append(b);
      return b;
    });
    this.setIndex(0);
  }
  setIndex(i) { this.buttons.forEach((b, k) => b.classList.toggle('on', k === i)); this.index = i; }
}

// ------------------------------------------------------------------ DescBox
function richParagraphs(text) {
  return (text || '').split('\n').map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
}

export class DescBox {
  constructor() {
    this.open = true;
    this.toggle = h('button', { type: 'button', class: 'desc-toggle', onClick: () => { this.open = !this.open; this._sync(); } });
    this.body = h('div', { class: 'desc' });
    this.el = h('div', { class: 'descbox' }, this.toggle, this.body);
    this.has = false;
  }
  setText(text) {
    this.has = !!(text && text.trim());
    this.body.innerHTML = richParagraphs(text);
    this.body.scrollTop = 0;
    this._sync();
  }
  _sync() {
    this.toggle.textContent = (this.open ? '▾' : '▸') + '  ' + t('desc.toggle');
    this.toggle.style.display = this.has ? '' : 'none';
    this.body.style.display = this.has && this.open ? '' : 'none';
  }
}

// ------------------------------------------------------------------ Thẻ ca công thức
function thumb(img, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cv = h('canvas', { class: 'thumb' });
  cv.width = cv.height = Math.round(size * dpr);
  cv.style.width = cv.style.height = size + 'px';
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}
export { thumb };

class AlgRow {
  constructor(alg, onClick) {
    this.el = h('div', { class: 'algrow', role: 'button', onClick: (e) => { e.stopPropagation(); onClick(); } },
      h('span', { class: 'algplay' }, '▶'),
      h('span', { class: 'algtext' }, alg),
      h('span', { class: 'algmeta' }, t('alg.moves', { n: moveCount(alg) })));
  }
  setActive(on) { this.el.classList.toggle('active', on); }
}

export class CaseCard {
  constructor(puzzleKey, cs, category, onPick) {
    this.rows = [];
    const setup = cs.setup || getPuzzle(puzzleKey).invertAlg(cs.algs[0]);
    const img = caseImage(puzzleKey, setup, category.diagram || '3d', category.mode || 'orient', 92);
    const col = h('div', { class: 'case-col' }, h('div', { class: 'case-title' }, td(cs.name)));
    if (cs.note) col.append(h('div', { class: 'case-note' }, td(cs.note)));
    cs.algs.forEach((a) => {
      const r = new AlgRow(a, () => onPick(this, r, a, cs));
      this.rows.push(r);
      col.append(r.el);
    });
    this.el = h('div', { class: 'case', onClick: () => { if (this.rows.length) this.rows[0].el.click(); } }, thumb(img, 92), col);
  }
}

// ------------------------------------------------------------------ Chú giải màu (nút ?)
const dot = (c) => `<span class="dot" style="color:${c}">●</span>`;
export function legendHtml(key) {
  const c = CUBE_COLORS;
  let rows, extra;
  if (key === 'pyraminx') {
    rows = [['#F7D21E', t('leg.pyra.bottom'), t('color.yellow')], ['#1FA84F', t('leg.pyra.front'), t('color.green')],
      ['#D7263D', t('leg.pyra.left'), t('color.red')], ['#1E5BD8', t('leg.pyra.right'), t('color.blue')]];
    extra = t('leg.extra.pyraminx');
  } else {
    rows = [[c[0], t('leg.U'), t('color.yellow')], [c[1], t('leg.D'), t('color.white')], [c[2], t('leg.F'), t('color.green')],
      [c[3], t('leg.B'), t('color.blue')], [c[4], t('leg.R'), t('color.orange')], [c[5], t('leg.L'), t('color.red')]];
    extra = key === 'skewb' ? t('leg.extra.skewb') : t('leg.extra.cube');
  }
  const body = rows.map(([col, name, cn]) => `<tr><td>${dot(col)}</td><td>${esc(name)}</td><td><b>${esc(cn)}</b></td></tr>`).join('');
  return `<div class="leg"><b>${esc(t('legend.title'))}</b> <span class="muted">${esc(t('legend.solved'))}</span>` +
    `<table>${body}</table><div class="legx">${extra}</div></div>`;
}

export class LegendButton {
  constructor() {
    this.key = '3x3';
    this.pop = h('div', { class: 'legend-pop', hidden: true });
    this.btn = h('button', { type: 'button', class: 'legend-btn', 'aria-label': t('legend.title'), onClick: () => this.toggle() }, '?');
    this.el = h('div', { class: 'legend' }, this.btn, this.pop);
    if (matchMedia('(hover: hover)').matches) {
      this.btn.addEventListener('mouseenter', () => this.show());
      this.btn.addEventListener('mouseleave', () => this.hide());
    }
    document.addEventListener('pointerdown', (e) => { if (!this.el.contains(e.target)) this.hide(); });
  }
  setKey(k) { this.key = k; }
  show() { this.pop.innerHTML = legendHtml(this.key); this.pop.hidden = false; }
  hide() { this.pop.hidden = true; }
  toggle() { if (this.pop.hidden) this.show(); else this.hide(); }
}

// ------------------------------------------------------------------ Thanh phát công thức
const svg = (body) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${body}</svg>`;
const ICON = {
  restart: svg('<rect x="5" y="5" width="2.6" height="14" rx=".8"/><path d="M19 5.5v13L9 12z"/>'),
  back: svg('<path d="M17.5 5.5v13L7 12z"/>'),
  play: svg('<path d="M7.5 4.8v14.4L19 12z"/>'),
  pause: svg('<rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/>'),
  forward: svg('<path d="M5 5.5v13L15.5 12z"/><rect x="16.4" y="5" width="2.6" height="14" rx=".8"/>'),
};
export class PlayerBar {
  constructor(handlers) {
    this.tokens = []; this.formulaHidden = false;
    this.placeholder = t('bar.placeholder.guide');
    this._i = 0; this._n = 0;
    this.line = h('div', { class: 'algline' }, this.placeholder);
    const btn = (txt, tip, fn, cls = 'ctl') => h('button', { type: 'button', class: cls, title: tip || null, 'aria-label': tip || txt, onClick: fn }, txt);
    this.bRestart = btn('', t('bar.restart'), handlers.restart); this.bRestart.innerHTML = ICON.restart;
    this.bBack = btn('', t('bar.back'), handlers.back); this.bBack.innerHTML = ICON.back;
    this.bPlay = btn('', t('bar.play') === 'bar.play' ? null : t('bar.play'), handlers.play, 'ctl primary'); this.bPlay.innerHTML = ICON.play;
    this.bFwd = btn('', t('bar.forward'), handlers.forward); this.bFwd.innerHTML = ICON.forward;
    this.val = h('span', { class: 'muted speedval' }, '1x');
    this.slider = h('input', { type: 'range', min: 25, max: 400, value: 100, class: 'slider', 'aria-label': t('bar.speed') });
    this.slider.addEventListener('input', () => { const v = +this.slider.value / 100; handlers.speed(v); this.val.textContent = `${+v.toPrecision(2)}x`; });
    this.counter = h('span', { class: 'muted counter' });
    this.el = h('div', { class: 'playerbar' }, this.line,
      h('div', { class: 'ctlrow' }, this.bRestart, this.bBack, this.bPlay, this.bFwd,
        h('span', { class: 'muted speedlbl' }, t('bar.speed')), this.slider, this.val, h('span', { class: 'grow' }), this.counter));
    this.setEnabled(false);
  }
  setEnabled(on) { [this.bRestart, this.bBack, this.bPlay, this.bFwd].forEach((b) => { b.disabled = !on; }); }
  setAlg(tokens) { this.tokens = tokens; this.setEnabled(tokens.length > 0); this.setProgress(0, tokens.length); }
  setPlaceholder(text) { this.placeholder = text; if (!this.tokens.length) this.line.textContent = text; }
  setFormulaHidden(on) { this.formulaHidden = on; this.setProgress(this._i, this._n); }
  setProgress(i, n) {
    this._i = i; this._n = n;
    if (!this.tokens.length) { this.counter.textContent = ''; this.line.textContent = this.placeholder; return; }
    const parts = this.tokens.map((tk, k) => {
      const s = this.formulaHidden && k >= i ? '•' : esc(tk);
      if (k < i) return `<span class="done">${s}</span>`;
      if (k === i) return `<span class="cur">&nbsp;${s}&nbsp;</span>`;
      return s;
    });
    this.line.innerHTML = parts.join('&nbsp; ');
    this.counter.textContent = `${i}/${n}`;
    const cur = this.line.querySelector('.cur');
    if (cur) {
      const L = this.line;
      if (cur.offsetTop < L.scrollTop || cur.offsetTop + cur.offsetHeight > L.scrollTop + L.clientHeight) L.scrollTop = Math.max(0, cur.offsetTop - 4);
    }
  }
  setPlaying(on) { this.bPlay.innerHTML = on ? ICON.pause : ICON.play; }
}
