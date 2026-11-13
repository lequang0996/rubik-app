// Nút menu (☰) ở góc phải thanh trên: dropdown "icon – chữ"
// Thứ tự: Ngôn ngữ · Giao diện · Âm thanh · Thống kê (Lv 18) · Góp ý (Lv 25) · Gói thành viên · Xem quảng cáo nhận exp · Hướng dẫn sử dụng
import { h, clear } from './dom.js';
import { t, LANGS, language } from './i18n.js';
import { icon } from './icons.js';
import * as theme from './theme.js';
import { sound } from './audio.js';
import { progress, MAX_LEVEL, REQ_STATS, REQ_FEEDBACK, REWARD_EXP } from './progress.js';
import { toast } from './levelui.js';
import { look } from './look.js';
import { openSoundSheet } from './soundui.js';
import { openHelpSheet } from './helpui.js';
import { watchRewardedAd } from './ads.js';
import { openShopSheet } from './shopui.js';

export function MenuButton({ openLanguage, openStats, openFeedback }) {
  const btn = h('button', { type: 'button', class: 'iconbtn menubtn', 'aria-haspopup': 'menu', 'aria-label': t('menu.title'), title: t('menu.title') }, icon('menu'));
  btn.addEventListener('click', () => openMenu(btn, { openLanguage, openStats, openFeedback }));
  return btn;
}

function openMenu(anchor, a) {
  const root = document.getElementById('modal-root');
  clear(root);
  const dark = theme.mode() === 'dark';
  const lang = LANGS.find((l) => l[0] === language());
  // req: số Lv cần để mở; chưa đủ thì hiện ổ khoá + "Lv N" và báo khoá khi bấm
  const item = (ic, label, trail, fn, req = 0) => {
    const locked = req > progress.level;
    return h('button', { type: 'button', role: 'menuitem', class: 'popitem' + (locked ? ' locked' : ''),
      onClick: () => { clear(root); if (locked) toast(t('lv.locked', { n: req }), 'lock'); else fn(); } },
    h('span', { class: 'popic' }, icon(ic, 19)), h('span', { class: 'poptxt' }, label),
    locked ? h('span', { class: 'poptrail lockedtrail' }, icon('lock', 13), t('lv.short', { n: req })) : trail);
  };
  const menu = h('div', { class: 'popmenu', role: 'menu' },
    item('globe', t('sidebar.language'), h('span', { class: 'poptrail' }, `${lang[2]} ${lang[1]}`), a.openLanguage),
    item(dark ? 'moon' : 'sun', t('theme.title'), h('span', { class: 'poptrail' }, t(dark ? 'theme.dark' : 'theme.light')), () => theme.toggle()),
    progress.level >= MAX_LEVEL ? item('star', t('menu.gold'), h('span', { class: 'popdot' + (look.pref ? ' on' : '') }), () => look.toggle()) : null,
    item('music', t('snd.title'), h('span', { class: 'popdot' + (sound.on ? ' on' : '') }), openSoundSheet),
    item('chart', t('stats.title'), null, a.openStats, REQ_STATS),
    item('mail', t('fb.title'), null, a.openFeedback, REQ_FEEDBACK),
    item('star', t('shop.menu'), null, openShopSheet),
    item('gift', progress.level >= MAX_LEVEL ? t('ads.support') : t('ads.menu', { n: REWARD_EXP }), null, watchRewardedAd),
    item('help', t('help.title'), null, openHelpSheet));
  root.append(h('div', { class: 'popback', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, menu));
  const r = anchor.getBoundingClientRect(), w = menu.offsetWidth;
  menu.style.left = `${Math.max(10, Math.min(r.right - w, window.innerWidth - w - 10))}px`;
  menu.style.top = `${r.bottom + 8}px`;
}
