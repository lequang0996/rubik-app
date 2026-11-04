// Tab Luyện tập: chọn ngẫu nhiên một ca trong bộ công thức đang chọn (port PracticePanel)
import { h } from './dom.js';
import { t, td } from './i18n.js';
import { loadPuzzleData } from './data.js';
import { getPuzzle } from './registry.js';
import { progress, levelReq } from './progress.js';
import { toast } from './levelui.js';
import { Segmented, CaseCard, StepPicker, cleanTitle, levelSummary } from './components.js';
import { levelList } from './guide.js';

const ALL = '__all__';

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export class PracticePanel {
  // handlers: onAlg(setup, alg), onCleared(), onHideChanged(bool)
  constructor(handlers) {
    this.hd = handlers;
    this.key = null; this.data = null; this.levels = []; this.levelId = null;
    this.cats = []; this.pool = []; this.poolId = null; this.decks = new Map();
    this.history = []; this.cur = null; this.card = null; this.formulaHidden = false; this.done = 0;

    this.title = h('div', { class: 'h1' }, t('mode.practice'));
    this.seg = new Segmented([t('level.basic')], (i) => this.levelChanged(i));
    this.levelTitle = h('div', { class: 'h2' });
    this.combo = new StepPicker((i) => this.poolChanged(i));
    this.count = h('span', { class: 'badge' });
    this.bPrev = h('button', { type: 'button', class: 'action prev', title: t('practice.prev'), 'aria-label': t('practice.prev'), onClick: () => this.prevCase() }, '◀');
    this.bNext = h('button', { type: 'button', class: 'action primary', onClick: () => this.nextCase() }, '🎲  ' + t('practice.random'));
    this.stat = h('div', { class: 'stat' });
    this.empty = h('div', { class: 'desc' }, t('practice.empty'));
    this.holder = h('div', { class: 'holder' }, this.empty);
    this.bHide = h('button', { type: 'button', class: 'action', onClick: () => this.toggleHide() }, '🙈  ' + t('practice.hide'));
    this.tip = h('div', { class: 'desc' }, t('practice.tip'));
    this.el = h('div', { class: 'pane practice' }, this.title, this.seg.el, this.levelTitle, this.combo.el,
      h('div', { class: 'row' }, this.count), h('div', { class: 'row gap' }, this.bPrev, this.bNext),
      this.stat, this.holder, this.bHide, this.tip);
    this.refreshButtons();
  }

  async setPuzzle(key) {
    this.key = key;
    const data = await loadPuzzleData(key);
    if (this.key !== key) return;
    this.data = data;
    this.levels = levelList(data, true);
    this.title.textContent = t('practice.title', { name: getPuzzle(key).title });
    this.seg.setItems(this.levels.length ? this.levels.map((l) => l[1]) : [t('level.basic')], this.levels.length ? this.levels.map((l) => l[2]) : null);
    this.seg.setLocks(this.levels.map((l) => levelReq(key, l[0])), () => progress.level, (req) => toast(t('lv.locked', { n: req })));
    this.seg.el.style.display = this.levels.length > 1 ? '' : 'none';
    this.levelId = this.levels.length ? this.levels[0][0] : null;
    this.done = 0;
    this.poolChanged(this.fillCats());
  }

  refreshLocks() { this.seg.refreshLocks(); }

  catsOf(lid) {
    if (!(this.data && lid)) return [];
    return (this.data.levels[lid] || []).filter((c) => c.id !== 'notation' && c.cases.length);
  }

  fillCats(selectId = null) {
    this.cats = this.catsOf(this.levelId);
    this.comboIds = [];
    const items = [];
    if (this.cats.length > 1) {
      const total = this.cats.reduce((x, c) => x + c.cases.length, 0);
      items.push({ label: t('practice.all', { n: total }), count: null, all: true });
      this.comboIds.push(ALL);
    }
    for (const c of this.cats) {
      items.push({ label: cleanTitle(td(c.title), c.cases.length), count: c.cases.length });
      this.comboIds.push(c.id);
    }
    this.combo.setItems(items, levelSummary(this.cats));
    let idx = 0;
    if (selectId !== null) { const k = this.comboIds.indexOf(selectId); if (k >= 0) idx = k; }
    else if (this.cats.length > 1) idx = 1;
    this.combo.selectedIndex = idx;
    return idx;
  }

  levelChanged(i) {
    if (!this.levels.length) return;
    i = Math.min(i, this.levels.length - 1);
    this.levelId = this.levels[i][0];
    this.poolChanged(this.fillCats());
  }

  poolChanged(i) {
    if (!this.comboIds || !this.comboIds.length) { this.pool = []; this.poolId = null; }
    else {
      const cid = this.comboIds[Math.max(0, i)];
      this.pool = cid === ALL ? this.cats.flatMap((c) => c.cases.map((cs) => [c, cs]))
        : this.cats.filter((c) => c.id === cid).flatMap((c) => c.cases.map((cs) => [c, cs]));
      this.poolId = cid;
    }
    const ttl = (this.levels.find((l) => l[0] === this.levelId) || [])[2] || '';
    this.levelTitle.textContent = ttl;
    this.levelTitle.style.display = ttl && this.levels.length > 1 ? '' : 'none';
    this.history = [];
    this.showCard(null);
    const n = this.pool.length;
    this.count.textContent = n ? t('practice.count', { n }) : t('practice.nocases');
    this.updateStat();
    this.refreshButtons();
    this.hd.onCleared();
  }

  // Khi vào chế độ luyện tập: lấy đúng cấp/mục đang xem ở tab Hướng dẫn
  sync(levelId, catId) {
    const wantLevel = this.levels.some((l) => l[0] === levelId) ? levelId : this.levelId;
    const wantCat = this.catsOf(wantLevel).some((c) => c.id === catId) ? catId : null;
    const curCat = this.comboIds ? this.comboIds[this.combo.selectedIndex] : null;
    if (wantLevel === this.levelId && (wantCat === null || wantCat === curCat)) return false;
    if (wantLevel !== this.levelId) {
      this.levelId = wantLevel;
      this.seg.setIndex(this.levels.findIndex((l) => l[0] === wantLevel));
    }
    this.poolChanged(this.fillCats(wantCat));
    return true;
  }

  draw() {
    const n = this.pool.length;
    if (!n) return null;
    const k = [this.key, this.levelId, this.poolId].join('|');
    let deck = this.decks.get(k);
    if (!deck || !deck.length) {
      deck = shuffle([...Array(n).keys()]);
      const last = this.poolIndex(this.cur);
      if (n > 1 && last !== null && deck[deck.length - 1] === last) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
      this.decks.set(k, deck);
    }
    return this.pool[deck.pop()];
  }

  poolIndex(cur) {
    if (!cur) return null;
    const i = this.pool.findIndex(([, cs]) => cs === cur[1]);
    return i < 0 ? null : i;
  }

  nextCase() {
    const item = this.draw();
    if (!item) return;
    this.history.push(item);
    this.done++;
    this.showCard(item);
    this.loadCurrent();
  }

  prevCase() {
    if (this.history.length < 2) return;
    this.history.pop();
    this.showCard(this.history[this.history.length - 1]);
    this.loadCurrent();
  }

  reloadCurrent() { if (this.cur) this.loadCurrent(); }

  loadCurrent() {
    if (!this.cur || !this.card || !this.card.rows.length) return;
    const [, cs] = this.cur;
    this.pick(this.card, this.card.rows[0], cs.algs[0], cs);
  }

  showCard(item) {
    if (this.card) { this.card.el.remove(); this.card = null; }
    this.cur = item;
    this.empty.style.display = item ? 'none' : '';
    if (item) {
      const [cat, cs] = item;
      this.card = new CaseCard(this.key, cs, cat, (c, r, a, k) => this.pick(c, r, a, k));
      this.holder.append(this.card.el);
      this.applyHide();
    }
    this.updateStat();
    this.refreshButtons();
  }

  pick(card, row, alg, cs) {
    card.rows.forEach((r) => r.setActive(r === row));
    this.hd.onAlg(cs.setup || getPuzzle(this.key).invertAlg(alg), alg, '');
  }

  toggleHide() {
    this.formulaHidden = !this.formulaHidden;
    this.bHide.textContent = this.formulaHidden ? '👁  ' + t('practice.show') : '🙈  ' + t('practice.hide');
    this.applyHide();
    this.hd.onHideChanged(this.formulaHidden);
  }

  applyHide() { if (this.card) this.card.rows.forEach((r) => { r.el.style.display = this.formulaHidden ? 'none' : ''; }); }

  updateStat() {
    const n = this.pool.length;
    if (!n) { this.stat.textContent = ''; return; }
    const deck = this.decks.get([this.key, this.levelId, this.poolId].join('|'));
    const seen = deck ? n - deck.length : 0;
    this.stat.textContent = this.done === 0 ? t('practice.start') : t('practice.stat', { a: seen, n, t: this.done });
  }

  refreshButtons() {
    this.bPrev.disabled = this.history.length < 2;
    this.bNext.disabled = !this.pool.length;
    this.bNext.textContent = '🎲  ' + (this.cur ? t('practice.next') : t('practice.random'));
  }
}
