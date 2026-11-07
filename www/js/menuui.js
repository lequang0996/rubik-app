// Nút menu (☰) ở góc phải thanh trên: bấm hiện dropdown "icon – chữ" gồm Âm thanh · Hướng dẫn sử dụng · Giao diện · Ngôn ngữ
import { h, clear } from './dom.js';
import { t, LANGS, language } from './i18n.js';
import { icon } from './icons.js';
import * as theme from './theme.js';
import { sound } from './audio.js';
import { openSoundSheet } from './soundui.js';
import { openHelpSheet } from './helpui.js';

export function MenuButton({ openLanguage }) {
  const btn = h('button', { type: 'button', class: 'iconbtn menubtn', 'aria-haspopup': 'menu', 'aria-label': t('menu.title'), title: t('menu.title') }, icon('menu'));
  btn.addEventListener('click', () => openMenu(btn, openLanguage));
  return btn;
}

function openMenu(anchor, openLanguage) {
  const root = document.getElementById('modal-root');
  clear(root);
  const dark = theme.mode() === 'dark';
  const lang = LANGS.find((l) => l[0] === language());
  const item = (ic, label, trail, fn) => h('button', { type: 'button', role: 'menuitem', class: 'popitem', onClick: () => { clear(root); fn(); } },
    h('span', { class: 'popic' }, icon(ic, 19)), h('span', { class: 'poptxt' }, label), trail);
  const menu = h('div', { class: 'popmenu', role: 'menu' },
    item('music', t('snd.title'), h('span', { class: 'popdot' + (sound.on ? ' on' : '') }), openSoundSheet),
    item('help', t('help.title'), null, openHelpSheet),
    item(dark ? 'moon' : 'sun', t('theme.title'), h('span', { class: 'poptrail' }, t(dark ? 'theme.dark' : 'theme.light')), () => theme.toggle()),
    item('globe', t('sidebar.language'), h('span', { class: 'poptrail' }, `${lang[2]} ${lang[1]}`), openLanguage));
  root.append(h('div', { class: 'popback', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, menu));
  const r = anchor.getBoundingClientRect(), w = menu.offsetWidth;
  menu.style.left = `${Math.max(10, Math.min(r.right - w, window.innerWidth - w - 10))}px`;
  menu.style.top = `${r.bottom + 8}px`;
}
