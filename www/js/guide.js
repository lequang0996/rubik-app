// Tab Hướng dẫn: cấp độ → danh mục → danh sách ca công thức (port GuidePanel)
import { h, clear } from './dom.js';
import { t, td } from './i18n.js';
import { loadPuzzleData } from './data.js';
import { getPuzzle } from './registry.js';
import { progress, levelReq } from './progress.js';
import { toast } from './levelui.js';
import { icon } from './icons.js';
import { caseKey } from './customalgs.js';
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
  constructor(onAlg, onSelect = null) {
    this.onAlg = onAlg; this.onSelect = onSelect;     // onSelect({level, cat, name, alg}) – để lưu lại vị trí đang xem
    this.sel = null; this.want = null;
    this.PAGE = 20;
    this.key = null; this.data = null; this.levels = []; this.levelId = 'basic';
    this.gen = 0; this.activeRow = null; this.cases = []; this.filtered = []; this.page = 0; this.cat = null;

    this.seg = new Segmented([t('level.basic')], (i) => this.levelChanged(i));
    this.levelTitle = h('div', { class: 'h2' });
    this.combo = new StepPicker((i) => this.categoryChanged(i));
    this.desc = new DescBox();
    this.count = h('span', { class: 'counttext' });
    this.countChip = h('div', { class: 'countchip' }, icon('list', 16), this.count);
    this.list = h('div', { class: 'cases' });
    this.bPrev = h('button', { type: 'button', class: 'ctl', onClick: () => this.goto(this.page - 1) }, '◀');
    this.bNext = h('button', { type: 'button', class: 'ctl', onClick: () => this.goto(this.page + 1) }, '▶');
    this.pageIn = h('input', { type: 'number', class: 'input pagein', min: 1, inputmode: 'numeric' });
    this.pageIn.addEventListener('change', () => this.goto((parseInt(this.pageIn.value, 10) || 1) - 1));
    this.pageTotal = h('span', { class: 'muted' }, '/ 1');
    this.pager = h('div', { class: 'pager', hidden: true }, this.bPrev, h('span', { class: 'muted' }, t('pager.page')), this.pageIn, this.pageTotal, this.bNext);
    this.el = h('div', { class: 'pane guide' }, this.seg.el, this.levelTitle, this.combo.el, this.desc.el,
      h('div', { class: 'guidebar' }, this.countChip), this.list, this.pager);
  }

  async setPuzzle(key) {
    this.key = key;
    const data = await loadPuzzleData(key);
    if (this.key !== key) return;
    this.data = data;
    this.levels = levelList(data);
    this.seg.setItems(this.levels.map((l) => l[1]).length ? this.levels.map((l) => l[1]) : [t('level.basic')], this.levels.length ? this.levels.map((l) => l[2]) : null);
    this.seg.setLocks(this.levels.map((l) => levelReq(key, l[0])), () => progress.level, (req) => toast(t('lv.locked', { n: req }), 'lock'));
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

  // vị trí đang xem: cấp + mục + (công thức đã chọn)
  snapshot() {
    const [level, cat] = this.selection();
    return { level, cat, name: this.sel ? this.sel.name : null, alg: this.sel ? this.sel.alg : null };
  }
  emitSel() { if (this.onSelect && this.data) this.onSelect(this.snapshot()); }

  // Khôi phục vị trí đã lưu; load=true thì chọn luôn công thức (nạp lên khối). Trả về true nếu khôi phục được cấp/mục.
  restore(s, load) {
    if (!s || !this.data) return false;
    const li = this.levels.findIndex((l) => l[0] === s.level);
    if (li < 0 || levelReq(this.key, s.level) > progress.level) return false;
    if (li > 0 || this.levelId !== s.level) { this.seg.setIndex(li); this.levelChanged(li); }
    const ci = this.cats().findIndex((c) => c.id === s.cat);
    if (ci < 0) return true;
    if (ci !== this.combo.selectedIndex) { this.combo.selectedIndex = ci; this.categoryChanged(ci); }
    if (s.name) {
      const idx = this.filtered.findIndex((c) => c.name === s.name);
      if (idx >= 0) {
        this.want = { ...s, load: !!load };                // load=false: chỉ đánh dấu hàng đã chọn, không nạp lên khối
        this.sel = { name: s.name, alg: s.alg };
        this.page = Math.floor(idx / this.PAGE); this.showPage();
        this.emitSel();
      }
    }
    return true;
  }

  // Quay lại tab Hướng dẫn: nạp lại công thức đang chọn lên khối
  reloadSelected() { if (this.activeRow) this.activeRow.el.click(); }

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
    this.sel = null; this.want = null;
    this.clearList();
    if (!cats.length || i < 0 || i >= cats.length) {
      this.desc.setText(t('guide.nodata'));
      this.count.textContent = t('count.zero');
      this.cases = []; this.filtered = [];
      this.pager.hidden = true;
      this.emitSel();
      return;
    }
    this.cat = cats[i];
    this.desc.setText(td(this.cat.desc || ''));
    this.cases = this.cat.cases;
    this.filtered = [...this.cases];
    this.page = 0;
    this.updateCount();
    this.showPage();
    this.emitSel();
  }

  updateCount() {
    const n = this.cases.length, a = this.cases.reduce((s, c) => s + c.algs.length, 0);
    this.count.textContent = t('count.all', { n, a });
  }

  caseKey(cs) { return caseKey(this.key, this.levelId, this.cat ? this.cat.id : '', cs.name); }

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
      const cs = this.pending.shift();
      const card = new CaseCard(this.key, cs, this.cat, (c, r, a, cs2) => this.pick(c, r, a, cs2), {
        key: this.caseKey(cs),
        onRemoved: (row) => { if (this.activeRow === row) { this.activeRow = null; this.sel = null; this.emitSel(); } },   // xoá đúng công thức đang chọn
      });
      this.list.append(card.el);
      if (this.want && cs.name === this.want.name) {            // đang khôi phục: chọn lại đúng công thức đã xem
        const w = this.want; this.want = null;
        const row = card.rows.find((r) => r.alg === w.alg) || card.rows[0];     // cả công thức tự thêm
        if (row && w.load) row.el.click();
        else if (row) { row.setActive(true); this.activeRow = row; }
        requestAnimationFrame(() => card.el.scrollIntoView({ block: 'center' }));
      }
    }
    if (this.pending.length) setTimeout(() => this.build(gen), 0);
  }

  pick(card, row, alg, cs) {
    if (this.activeRow) this.activeRow.setActive(false);
    row.setActive(true);
    this.activeRow = row;
    this.sel = { name: cs.name, alg };
    this.emitSel();
    const setup = cs.setup || getPuzzle(this.key).invertAlg(alg);
    this.onAlg(setup, alg, '');
  }
}
