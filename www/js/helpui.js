// Hướng dẫn sử dụng: mở từ menu ☰ → bảng thẻ tóm tắt cách dùng app
import { h, clear } from './dom.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import { sheetHead } from './sheetui.js';

const ICONS = ['cube', 'guide', 'practice', 'play', 'star', 'palette', 'menu'];

export function openHelpSheet() {
  const root = document.getElementById('modal-root');
  const items = ICONS.map((ic, i) => h('div', { class: 'helpitem' },
    h('span', { class: 'helpic' }, icon(ic, 20)),
    h('div', { class: 'helptext' }, h('div', { class: 'helptitle' }, t(`help.s${i + 1}t`)), h('div', { class: 'helpbody' }, t(`help.s${i + 1}b`)))));
  const sheet = h('div', { class: 'sheet helpsheet', role: 'dialog', 'aria-label': t('help.title') },
    sheetHead('help', t('help.title')), h('div', { class: 'helplist' }, items));
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
}
