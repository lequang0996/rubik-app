// Giao diện cấp độ: nhãn Lv + thanh exp, bảng chi tiết, thông báo (toast)
import { h, clear } from './dom.js';
import { t, language } from './i18n.js';
import { progress, MAX_LEVEL, levelExp, fmtDuration, EXP_PER_SECOND, MODE_REQ, REQ_ADVANCED, REQ_COMPETITION } from './progress.js';

let toastTimer = null;
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.append(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export const fmtNum = (n) => n.toLocaleString(language());

// Nhãn nhỏ "Lv 7" + thanh tiến độ; bấm để mở bảng chi tiết
export class LevelPill {
  constructor(wide = false) {
    this.num = h('span', { class: 'lvnum' });
    this.bar = h('i');
    this.exp = h('span', { class: 'lvexp' });
    this.el = h('button', { type: 'button', class: 'lvpill' + (wide ? ' wide' : ''), 'aria-label': t('lv.title'), onClick: openLevelSheet },
      h('span', { class: 'lvtop' }, this.num, wide ? this.exp : null), h('span', { class: 'lvbar' }, this.bar));
    this.update();
  }
  update() {
    this.num.textContent = t('lv.short', { n: progress.level });
    this.exp.textContent = `${fmtNum(progress.exp)} exp`;
    this.bar.style.width = `${(progress.fraction() * 100).toFixed(1)}%`;
  }
}

export function openLevelSheet() {
  const root = document.getElementById('modal-root');
  const head = h('div', { class: 'lvhead' });
  const expLine = h('div', { class: 'lvline' });
  const bar = h('span', { class: 'lvbar big' }, h('i'));
  const next = h('div', { class: 'lvline muted' });
  const rows = [[MODE_REQ[1], `${t('mode.practice')} · ${t('mode.play')}`], [REQ_ADVANCED, t('lv.u15')], [REQ_COMPETITION, t('lv.u20')]]
    .map(([req, text]) => ({
      req,
      el: h('div', { class: 'unlockrow' },
        h('span', { class: 'stepidx wide' }, t('lv.short', { n: req })),
        h('span', { class: 'steptitle' }, text),
        h('span', { class: 'ustate' })),
    }));
  const sheet = h('div', { class: 'sheet', role: 'dialog' }, h('div', { class: 'sheet-title' }, t('lv.title')), head, bar, expLine, next,
    h('div', { class: 'lvline muted' }, t('lv.rule')), h('div', { class: 'section' }, t('lv.unlocks')), h('div', { class: 'steplist' }, rows.map((r) => r.el)));
  const refresh = () => {
    head.textContent = t('lv.short', { n: progress.level });
    bar.firstChild.style.width = `${(progress.fraction() * 100).toFixed(1)}%`;
    expLine.textContent = t('lv.exp', { e: fmtNum(progress.exp) });
    next.textContent = progress.level >= MAX_LEVEL ? t('lv.max')
      : t('lv.next', { n: progress.level + 1, e: fmtNum(levelExp(progress.level + 1)), t: fmtDuration(progress.expToNext() / EXP_PER_SECOND) });
    for (const r of rows) {
      const ok = progress.level >= r.req;
      r.el.classList.toggle('done', ok);
      r.el.lastChild.textContent = ok ? '✓' : '🔒';
    }
  };
  refresh();
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
  const off = progress.on('change', () => { if (!document.body.contains(sheet)) off(); else refresh(); });
}
