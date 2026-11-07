// Đầu bảng (sheet) dùng chung: ô icon + tiêu đề + nút đóng
import { h, clear } from './dom.js';
import { icon } from './icons.js';

export function sheetHead(iconName, title) {
  return h('div', { class: 'sheethead' },
    h('span', { class: 'sheeticon' }, icon(iconName, 20)),
    h('div', { class: 'sheettitle' }, title),
    h('button', { type: 'button', class: 'sheetclose', 'aria-label': '✕', onClick: () => clear(document.getElementById('modal-root')) }, icon('close', 18)));
}
