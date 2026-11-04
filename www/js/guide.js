// Tab Hướng dẫn: cấp độ → danh mục → danh sách ca công thức (port GuidePanel)
import { h, clear } from './dom.js';
import { t, td } from './i18n.js';
import { loadPuzzleData } from './data.js';
import { getPuzzle } from './registry.js';
import { progress, levelReq } from './progress.js';
import { toast } from './levelui.js';
import { Segmented, DescBox, CaseCard, StepPicker, cleanTitle, levelSummary } from './components.js';

// Tính danh sách cấp độ từ dữ liệu: [[id, nhãn, tiêu đề]]
export function levelList(data, practice = false) {
  const levels = [];
  if (!data) return levels;
  const info = Object.fromEntries((data.level_info || []).map((x) => [x.id, x]));
  const defaults = { basic: t('level.basic'), advanced: t('level.advanced') };
  for (const [lid, cats] of Object.entries(data.levels)) {
    const usable = practice ? cats.filter((c) => c.id !== 'notation' && c.cases.length) : cats;
    if (!usable.length) continue;
    const x = info[lid] || {};
    levels.push([lid, x.label ? td(x.label) : defaults[lid] || lid, td(x.title || '')]);
  }
  const order = (data.level_info || []).map((x) => x.id);
  const rank = (id) => (order.includes(id) ? order.indexOf(id) : 99);
  return levels.sort((a, b) => rank(a[0]) - rank(b[0]));
}

export class GuidePanel {
  constructor(onAlg) {
    this.onAlg = onAlg;
    this.PAGE = 20;
    this.key = null; this.data = null; this.levels = []; this.levelId = 'basic';
    this.gen = 0; this.activeRow = null; this.cases = []; this.filtered = []; this.page = 0; this.cat = null;

    this.seg = new Segmented([t('level.basic')], (i) => this.levelChanged(i));
    this.levelTitle = h('div', { class: 'h2' });
    this.combo = new StepPicker((i) => this.categoryChanged(i));
    this.desc = new DescBox();
    this.count = h('span', { class: 'badge' });
    this.search = h('input', { type: 'search', class: 'input search', placeholder: t('search.placeholder'), enterkeyhint: 'search' });
    this.search.addEventListener('input', () => this.filterChanged(this.search.value));
    this.list = h('div', { class: 'cases' });
    this.bPrev = h('button', { type: 'button', class: 'ctl', onClick: () => this.goto(this.page - 1) }, '◀');
    this.bNext = h('button', { type: 'button', class: 'ctl', onClick: () => this.goto(this.page + 1) }, '▶');
    this.pageIn = h('input', { type: 'number', class: 'input pagein', min: 1, inputmode: 'numeric' });
    this.pageIn.addEventListener('change', () => this.goto((parseInt(this.pageIn.value, 10) || 1) - 1));
    this.pageTotal = h('span', { class: 'muted' }, '/ 1');
    this.pager = h('div', { class: 'pager', hidden: true }, this.bPrev, h('span', { class: 'muted' }, t('pager.page')), this.pageIn, this.pageTotal, this.bNext);
    this.el = h('div', { class: 'pane guide' }, this.seg.el, this.levelTitle, this.combo.el, this.desc.el,
      h('div', { class: 'row between' }, this.count, this.search), this.list, this.pager);
  }

  async setPuzzle(key) {
    this.key = key;
    const data = await loadPuzzleData(key);
    if (this.key !== key) return;
    this.data = data;
    this.levels = levelList(data);
    this.seg.setItems(this.levels.map((l) => l[1]).length ? this.levels.map((l) => l[1]) : [t('level.basic')], this.levels.length ? this.levels.map((l) => l[2]) : null);
    this.seg.setLocks(this.levels.map((l) => levelReq(key, l[0])), () => progress.level, (req) => toast(t('lv.locked', { n: req })));
    this.seg.el.style.display = this.levels.length > 1 ? '' : 'none';
    this.levelId = this.levels.length ? this.levels[0][0] : 'basic';
    this.levelChanged(0);
  }

  refreshLocks() { this.seg.refreshLocks(); }

  cats() { return this.data ? this.data.levels[this.levelId] || [] : []; }

  selection() {
    const cats = this.cats(), i = this.combo.selectedIndex;
    return [this.levelId, i >= 0 && i < cats.length ? cats[i].id : null];
  }

  levelChanged(i) {
    if (this.levels.length) {
      const lv = this.levels[Math.min(i, this.levels.length - 1)];
      this.levelId = lv[0];
      this.levelTitle.textContent = this.levels.length > 1 ? lv[2] : '';
      this.levelTitle.style.display = lv[2] && this.levels.length > 1 ? '' : 'none';
    } else this.levelTitle.style.display = 'none';
    const cats = this.cats();
    this.combo.setItems(cats.map((c) => ({ label: cleanTitle(td(c.title), c.cases.length), count: c.cases.length })), levelSummary(cats));
    this.categoryChanged(0);
  }

  clearList() {
    this.gen++; this.activeRow = null;
    clear(this.list);
  }

  categoryChanged(i) {
    const cats = this.cats();
    this.clearList();
    this.search.value = '';
    if (!cats.length || i < 0 || i >= cats.length) {
      this.desc.setText(t('guide.nodata'));
      this.count.textContent = t('count.zero');
      this.cases = []; this.filtered = [];
      this.pager.hidden = true; this.search.style.display = 'none';
      return;
    }
    this.cat = cats[i];
    this.desc.setText(td(this.cat.desc || ''));
    this.cases = this.cat.cases;
    this.search.style.display = this.cases.length > 12 ? '' : 'none';
    this.filtered = [...this.cases];
    this.page = 0;
    this.updateCount();
    this.showPage();
  }

  filterChanged(text) {
    const q = text.trim().toLowerCase();
    this.filtered = q ? this.cases.filter((c) => td(c.name).toLowerCase().includes(q) || td(c.note || '').toLowerCase().includes(q)
      || c.name.toLowerCase().includes(q) || c.algs.some((a) => a.toLowerCase().includes(q))) : [...this.cases];
    this.page = 0;
    this.updateCount();
    this.showPage();
  }

  updateCount() {
    const n = this.cases.length, a = this.cases.reduce((s, c) => s + c.algs.length, 0);
    this.count.textContent = this.filtered.length !== n ? t('count.match', { k: this.filtered.length, n }) : t('count.all', { n, a });
  }

  pages() { return Math.max(1, Math.ceil(this.filtered.length / this.PAGE)); }

  goto(p) {
    p = Math.max(0, Math.min(this.pages() - 1, p));
    if (p !== this.page) { this.page = p; this.showPage(); } else this.pageIn.value = this.page + 1;
  }

  showPage() {
    this.clearList();
    const pages = this.pages();
    this.pager.hidden = pages <= 1;
    this.pageIn.max = pages; this.pageIn.value = this.page + 1;
    this.pageTotal.textContent = `/ ${pages}`;
    this.bPrev.disabled = this.page <= 0; this.bNext.disabled = this.page >= pages - 1;
    this.pending = this.filtered.slice(this.page * this.PAGE, (this.page + 1) * this.PAGE);
    const sc = document.getElementById('panes');
    if (sc) sc.scrollTop = 0;
    if (!this.pending.length) { this.list.append(h('div', { class: 'muted' }, t('guide.nomatch'))); return; }
    this.build(this.gen);
  }

  build(gen) {
    if (gen !== this.gen) return;
    for (let k = 0; k < 5 && this.pending.length; k++) {
      this.list.append(new CaseCard(this.key, this.pending.shift(), this.cat, (c, r, a, cs) => this.pick(c, r, a, cs)).el);
    }
    if (this.pending.length) setTimeout(() => this.build(gen), 0);
  }

  pick(card, row, alg, cs) {
    if (this.activeRow) this.activeRow.setActive(false);
    row.setActive(true);
    this.activeRow = row;
    const setup = cs.setup || getPuzzle(this.key).invertAlg(alg);
    this.onAlg(setup, alg, '');
  }
}
