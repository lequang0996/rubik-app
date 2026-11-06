// Nút đổi giao diện sáng / tối (hiện icon của chế độ sẽ chuyển sang)
import { h } from './dom.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import * as theme from './theme.js';

export function ThemeButton() {
  const dark = theme.mode() === 'dark';
  const label = t(dark ? 'theme.toLight' : 'theme.toDark');
  const b = h('button', { type: 'button', class: 'iconbtn themebtn', 'aria-label': label, title: label, onClick: () => { theme.toggle(); } }, icon(dark ? 'sun' : 'moon'));
  theme.onChange(() => {               // đổi theme: cập nhật icon/nhãn tại chỗ, không dựng lại giao diện
    if (!b.isConnected) return;
    const d = theme.mode() === 'dark', l = t(d ? 'theme.toLight' : 'theme.toDark');
    b.setAttribute('aria-label', l); b.title = l; b.replaceChildren(icon(d ? 'sun' : 'moon'));
  });
  return b;
}
