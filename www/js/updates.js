// Google Play In-App Updates – chế độ FLEXIBLE: tải bản mới ở nền, tải xong hiện thanh "Khởi động lại" để cài
// Cầu nối native: android/.../InAppUpdatePlugin.java. Chạy ngoài Android (trình duyệt) thì bỏ qua.
import { h } from './dom.js';
import { t } from './i18n.js';

let bar = null;

function showReadyBar(plugin) {
  if (bar && bar.isConnected) return;
  bar = h('div', { id: 'updatebar', role: 'status' },
    h('span', { class: 'ubtxt' }, '⬇️  ' + t('update.ready')),
    h('button', { type: 'button', class: 'ubbtn', onClick: () => plugin.completeUpdate().catch(() => {}) }, t('update.restart')),
    h('button', { type: 'button', class: 'ubx', 'aria-label': '✕', onClick: () => bar.remove() }, '✕'));
  document.body.append(bar);
}

export async function initInAppUpdate() {
  const Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  const plugin = Cap.registerPlugin('InAppUpdate');
  try {
    await plugin.addListener('downloaded', () => showReadyBar(plugin));
    await plugin.startFlexibleUpdate();          // có bản mới → Play hiện hộp thoại xin tải nền; không có thì trả về ngay
  } catch { /* Play Store không khả dụng / bản cài ngoài Play → bỏ qua */ }
}
