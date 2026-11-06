// Hướng dẫn sử dụng: nút (?) cạnh nút âm thanh → bảng tóm tắt cách dùng app
import { h, clear } from './dom.js';
import { t } from './i18n.js';
import { icon } from './icons.js';

const SECTIONS = 7;

export function HelpButton() {
  return h('button', { type: 'button', class: 'iconbtn helpbtn', 'aria-haspopup': 'dialog', 'aria-label': t('help.title'), title: t('help.title'), onClick: openHelpSheet }, icon('help'));
}

export function openHelpSheet() {
  const root = document.getElementById('modal-root');
  const items = [];
  for (let i = 1; i <= SECTIONS; i++) {
    items.push(h('div', { class: 'helpitem' }, h('div', { class: 'helptitle' }, t(`help.s${i}t`)), h('div', { class: 'helpbody' }, t(`help.s${i}b`))));
  }
  const sheet = h('div', { class: 'sheet helpsheet', role: 'dialog', 'aria-label': t('help.title') },
    h('div', { class: 'sheet-title' }, t('help.title')), h('div', { class: 'helplist' }, items));
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
}
