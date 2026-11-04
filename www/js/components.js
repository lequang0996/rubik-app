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
    this.locks = []; this.getLevel = () => 99; this.onLocked = () => {};
    this.setItems(labels, tips);
  }
  setItems(labels, tips = null) {
    clear(this.el);
    this.locks = [];
    this.buttons = labels.map((label, i) => {
      const b = h('button', { type: 'button', class: 'seg-btn', title: (tips && tips[i]) || null, onClick: () => {
        if (this._locked(i)) { this.onLocked(this.locks[i]); return; }
        this.setIndex(i); this.onChange(i);
      } }, label);
      this.el.append(b);
      return b;
    });
    this.setIndex(0);
  }
  // reqs[i] = cấp người chơi cần có để dùng mục i (0 = luôn mở)
  setLocks(reqs, getLevel, onLocked) { this.locks = reqs; this.getLevel = getLevel; this.onLocked = onLocked; this.refreshLocks(); }
  _locked(i) { return (this.locks[i] || 0) > this.getLevel(); }
  refreshLocks() {
    this.buttons.forEach((b, i) => {
      const lk = this._locked(i), ic = b.querySelector('.lockic');
      b.classList.toggle('locked', lk);
      if (lk && !ic) b.prepend(h('span', { class: 'lockic' }, '🔒'));
      else if (!lk && ic) ic.remove();
    });
  }
  setIndex(i) { this.buttons.forEach((b, k) => b.classList.toggle('on', k === i)); this.index = i; }
}

// ------------------------------------------------------------------ Chọn mục (thay cho dropdown)
// Bỏ số lượng ca nhúng sẵn trong tiêu đề ("OLL – 57 cases", "(324)") vì giao diện đã có nhãn số riêng
export function cleanTitle(text, n) {
  const N = String(n);
  let s = text.replace(new RegExp(`\\s*[（(]\\s*${N}\\s*[）)]\\s*$`), '');
  s = s.replace(new RegExp(`\\s*[–—-]\\s*${N}\\S*(\\s+\\S+){0,2}\\s*$`), '');
  return s.trim() || text;
}

// Tổng số ca / công thức cần học của một nhóm danh mục (không tính phần "Ký hiệu")
export function levelSummary(cats) {
  let n = 0, a = 0;
  for (const c of cats) {
    if (c.id === 'notation') continue;
    n += c.cases.length;
    a += c.cases.reduce((x, cs) => x + cs.algs.length, 0);
  }
  return n ? t('guide.total', { c: t('count.all', { n, a }) }) : '';
}

export class StepPicker {
  constructor(onChange) {
    this.onChange = onChange; this.items = []; this.index = 0; this.summary = '';
    this.titleEl = h('span', { class: 'steptitle' });
    this.countEl = h('span', { class: 'stepcount' });
    this.btn = h('button', { type: 'button', class: 'stepbtn', 'aria-haspopup': 'dialog', onClick: () => this.open() },
      this.titleEl, this.countEl, h('span', { class: 'chev' }, '▾'));
    this.sumEl = h('div', { class: 'stepsum' });
    this.el = h('div', { class: 'steppicker' }, this.btn, this.sumEl);
    this._esc = (e) => { if (e.key === 'Escape') this.close(); };
  }
  // items: [{label, count (hoặc null), all?}]
  setItems(items, summary = '') { this.items = items; this.summary = summary; this.index = 0; this._sync(); }
  get selectedIndex() { return this.index; }
  set selectedIndex(i) { this.index = Math.max(0, Math.min(this.items.length - 1, i)); this._sync(); }
  _sync() {
    const it = this.items[this.index];
    this.titleEl.textContent = it ? it.label : '';
    const has = it && it.count !== null && it.count !== undefined;
    this.countEl.textContent = has ? it.count : '';
    this.countEl.style.display = has ? '' : 'none';
    this.sumEl.textContent = this.summary;
    this.sumEl.style.display = this.summary ? '' : 'none';
    this.btn.disabled = !it;
  }
  open() {
    const root = document.getElementById('modal-root');
    // Tên dạng "2 · F2L – …": lấy số làm badge, bỏ khỏi tên để không bị lặp
    const parsed = this.items.map((it) => { const m = /^(\d+)\s*·\s*(.+)$/.exec(it.label); return m ? { num: m[1], text: m[2] } : { num: null, text: it.label }; });
    const anyNum = parsed.some((x) => x.num);
    const rows = this.items.map((it, i) => h('button', {
      type: 'button', class: 'steprow' + (i === this.index ? ' on' : ''),
      onClick: () => { this.close(); this.selectedIndex = i; this.onChange(i); },
    }, h('span', { class: 'stepidx' }, it.all ? '∗' : parsed[i].num || (anyNum ? '•' : String(i + 1))), h('span', { class: 'steptitle' }, parsed[i].text),
    it.count !== null && it.count !== undefined ? h('span', { class: 'stepcount' }, it.count) : null,
    i === this.index ? h('span', { class: 'check' }, '✓') : null));
    const list = h('div', { class: 'steplist' }, rows);
    const sheet = h('div', { class: 'sheet', role: 'dialog' },
      h('div', { class: 'sheet-title' }, t('guide.pick')),
      this.summary ? h('div', { class: 'sheet-sub' }, this.summary) : null, list);
    clear(root);
    root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) this.close(); } }, sheet));
    document.addEventListener('keydown', this._esc);
    const row = rows[this.index];
    if (row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2);
  }
  close() { document.removeEventListener('keydown', this._esc); clear(document.getElementById('modal-root')); }
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
    this.counter = h('span', { class: 'muted counter' });
    this.el = h('div', { class: 'playerbar' }, this.line,
      h('div', { class: 'ctlrow' }, this.bRestart, this.bBack, this.bPlay, this.bFwd,
        h('span', { class: 'grow' }), this.counter));
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
