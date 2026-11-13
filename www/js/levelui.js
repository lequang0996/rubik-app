// Giao diện cấp độ: nhãn Lv + thanh exp, bảng chi tiết, thông báo (toast)
import { h, clear } from './dom.js';
import { t, language } from './i18n.js';
import { icon } from './icons.js';
import { progress, MAX_LEVEL, levelExp, fmtDuration, UNLOCKS, REWARD_EXP } from './progress.js';
import { watchRewardedAd } from './ads.js';
import { badge, rankOf, RANKS, RANK_LAST } from './badges.js';
import { showCelebration } from './celebrate.js';
import { openShopSheet } from './shopui.js';

let toastTimer = null;
// Nhãn của một mốc mở khoá: 'u10' = Luyện tập · Chơi, còn lại là khoá chuỗi dịch
export const unlockText = (k) => (k === 'u10' ? `${t('mode.practice')} · ${t('mode.play')}` : t(k));

// kind: 'lock' (đang khoá) · 'up' (lên cấp) · 'info'
export function toast(text, kind = 'info') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.append(el); }
  el.dataset.kind = kind;
  clear(el);
  el.append(h('span', { class: 'ticon' }, icon(kind === 'lock' ? 'lock' : kind === 'up' ? 'star' : 'bulb', 19)), h('span', { class: 'ttext' }, text));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export const fmtNum = (n) => n.toLocaleString(language());

// Nhãn nhỏ "Lv 7" + thanh tiến độ; bấm để mở bảng chi tiết
export class LevelPill {
  constructor(wide = false) {
    this.wide = wide;
    this.digit = h('b');
    this.ring = h('span', { class: 'lvring' }, this.digit);
    this.num = h('span', { class: 'lvnum' });
    this.exp = h('span', { class: 'lvexp' });
    this.el = h('button', { type: 'button', class: 'lvpill' + (wide ? ' wide' : ''), 'aria-label': t('lv.title'), onClick: openLevelSheet },
      this.ring, h('span', { class: 'lvtext' }, this.num, this.exp));
    this._lv = -1;
    this.update();
  }
  update() {
    const f = progress.fraction();
    if (progress.level !== this._lv) {            // từ Lv 22: huy hiệu thay cho số trong vòng
      this._lv = progress.level;
      this.ring.replaceChildren(badge(progress.level, this.wide ? 30 : 24) || this.digit);
    }
    this.digit.textContent = progress.level;
    this.ring.style.setProperty('--p', (f * 100).toFixed(1));
    this.num.textContent = t('lv.short', { n: progress.level });
    this.exp.textContent = this.wide ? `${fmtNum(progress.exp)} exp` : `${Math.floor(f * 100)}%`;
  }
}

export function openLevelSheet() {
  const root = document.getElementById('modal-root');
  const head = h('div', { class: 'lvhead', style: { userSelect: 'none', webkitUserSelect: 'none' } });
  const rankLine = h('div', { class: 'lvrank' });
  const badgeHost = h('span', { class: 'lvbadgehost' });
  badgeHost.addEventListener('click', () => { if (progress.level >= MAX_LEVEL) showCelebration(); });   // Lv 30: chạm huy hiệu để xem lại màn chúc mừng
  const top = h('div', { class: 'lvbadgerow' }, badgeHost, h('div', { class: 'lvbadgetext' }, head, rankLine));
  const expLine = h('div', { class: 'lvline' });
  const bar = h('span', { class: 'lvbar big' }, h('i'));
  const next = h('div', { class: 'lvline muted' });

  // mốc mở khoá chức năng + danh hiệu Lv 22–30 (Lv 30 là món quà bí mật, chỉ lộ khi đã đạt)
  const items = [...UNLOCKS.map(([req, k]) => ({ req, text: unlockText(k) })), ...RANKS.map((r) => ({ req: r.lv, rank: r }))].sort((a, b) => a.req - b.req);
  const rows = items.map((it) => {
    const slot = h('span', { class: 'rowbadge' });
    const title = h('span', { class: 'steptitle' }, it.text || '');
    const state = h('span', { class: 'ustate' });
    if (it.rank && it.req < RANK_LAST) { slot.append(badge(it.req, 26)); title.textContent = t(it.rank.key); }
    const el = h('div', { class: 'unlockrow' + (it.rank ? ' rankrow' : '') }, h('span', { class: 'stepidx wide' }, t('lv.short', { n: it.req })), it.rank ? slot : null, title, state);
    return { ...it, el, slot, title, state, secret: it.req === RANK_LAST };
  });

  const adLabel = h('span');
  const ruleLine = h('div', { class: 'lvline muted' });
  const adBtn = h('button', { type: 'button', class: 'action primary adbtn', onClick: watchRewardedAd }, icon('gift', 18), adLabel);
  const shopBtn = h('button', { type: 'button', class: 'action shopbtn', onClick: openShopSheet }, icon('star', 18), h('span', {}, t('shop.menu')));
  const sheet = h('div', { class: 'sheet', role: 'dialog' }, h('div', { class: 'sheet-title' }, t('lv.title')), top, bar, expLine, next, adBtn, shopBtn,
    ruleLine, h('div', { class: 'section' }, t('lv.unlocks')), h('div', { class: 'steplist' }, rows.map((r) => r.el)));

  let shownLv = -1, shownGift = null;
  const refresh = () => {
    const lv = progress.level;
    if (lv !== shownLv) {                         // huy hiệu to + danh hiệu: chỉ dựng lại khi đổi cấp
      shownLv = lv;
      const r = rankOf(lv);
      clear(badgeHost);
      if (r) badgeHost.append(badge(lv, 68));
      badgeHost.style.display = r ? '' : 'none';
      badgeHost.classList.toggle('tap', lv >= MAX_LEVEL);
      rankLine.textContent = r ? t(r.key) : '';
    }
    head.textContent = t('lv.short', { n: lv });
    bar.firstChild.style.width = `${(progress.fraction() * 100).toFixed(1)}%`;
    expLine.textContent = t('lv.exp', { e: fmtNum(progress.exp) });
    next.textContent = lv >= MAX_LEVEL ? t('lv.max')
      : t('lv.next', { n: lv + 1, e: fmtNum(levelExp(lv + 1)), t: fmtDuration(progress.expToNext() / progress.rate) });
    const maxed = lv >= MAX_LEVEL;
    adLabel.textContent = maxed ? t('ads.support') : t('ads.watch', { n: REWARD_EXP });
    ruleLine.textContent = t('lv.rule', { n: fmtNum(progress.rate) });
    ruleLine.style.display = maxed ? 'none' : '';
    for (const r of rows) {
      const ok = lv >= r.req;
      r.el.classList.toggle('done', ok);
      r.state.textContent = ok ? '✓' : '🔒';
      if (r.secret && shownGift !== ok) {         // dòng Lv 30: chưa đạt thì chỉ ghi "một món quà đặc biệt"
        clear(r.slot);
        if (ok) { r.slot.append(badge(r.req, 26)); r.title.textContent = `${t(r.rank.key)} · ${t('menu.gold')}`; }
        else r.title.textContent = `🎁 ${t('gift.hidden')}`;
      }
    }
    shownGift = lv >= RANK_LAST;
  };
  refresh();
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
  const off = progress.on('change', () => { if (!document.body.contains(sheet)) off(); else refresh(); });
  const offRate = progress.on('rate', () => { if (!document.body.contains(sheet)) offRate(); else refresh(); });
}
