// Góp ý: người dùng nhập mô tả → bấm Gửi → gửi tới Google Apps Script của nhà phát triển, script đó gửi email (xem config.js)
import { h, clear } from './dom.js';
import { t, language } from './i18n.js';
import { icon } from './icons.js';
import { sheetHead } from './sheetui.js';
import { progress } from './progress.js';
import { FEEDBACK_ENDPOINT, FEEDBACK_MIN, FEEDBACK_MAX, FEEDBACK_COOLDOWN_MS } from './config.js';

const LAST = 'rubik_studio_fb_last';

async function send(message) {
  if (!FEEDBACK_ENDPOINT) return false;                           // chưa cấu hình URL Apps Script (config.js)
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    // text/plain = "simple request": Apps Script không cần xử lý preflight CORS
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST', signal: ctl.signal, redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ message, language: language(), level: progress.level, platform: native ? 'android' : 'web', _honey: '' }),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok && j.ok === true;
  } catch { return false; } finally { clearTimeout(timer); }
}

export function openFeedbackSheet() {
  const root = document.getElementById('modal-root');
  const area = h('textarea', { class: 'fbarea', rows: 6, maxlength: FEEDBACK_MAX, placeholder: t('fb.placeholder'), 'aria-label': t('fb.title') });
  const count = h('span', { class: 'fbcount' }, `0 / ${FEEDBACK_MAX}`);
  const msg = h('div', { class: 'fbmsg', role: 'status' });
  const btn = h('button', { type: 'button', class: 'action primary fbsend' }, t('fb.send'));
  const form = h('div', { class: 'fbform' }, h('div', { class: 'fbintro' }, t('fb.intro')), area, h('div', { class: 'fbrow' }, msg, count), btn);
  const sheet = h('div', { class: 'sheet fbsheet', role: 'dialog', 'aria-label': t('fb.title') }, sheetHead('mail', t('fb.title')), form);

  const say = (text, kind = '') => { msg.textContent = text; msg.dataset.kind = kind; };
  area.addEventListener('input', () => { count.textContent = `${area.value.length} / ${FEEDBACK_MAX}`; if (msg.dataset.kind === 'err') say(''); });
  btn.addEventListener('click', async () => {
    const text = area.value.trim();
    if (text.length < FEEDBACK_MIN) { say(t('fb.short'), 'err'); area.focus(); return; }
    const last = Number(localStorage.getItem(LAST) || 0);
    if (Date.now() - last < FEEDBACK_COOLDOWN_MS) { say(t('fb.wait'), 'err'); return; }
    btn.disabled = true; area.disabled = true; say(t('fb.sending'), 'info');
    const ok = await send(text);
    if (ok) {
      try { localStorage.setItem(LAST, String(Date.now())); } catch { /* bỏ qua */ }
      clear(form);
      form.append(h('div', { class: 'fbdone' }, h('span', { class: 'fbcheck' }, icon('star', 26)), h('div', { class: 'fbthanks' }, t('fb.thanks')), h('div', { class: 'fbintro' }, t('fb.thanks2')),
        h('button', { type: 'button', class: 'action', onClick: () => clear(root) }, '✕')));
    } else {
      btn.disabled = false; area.disabled = false; say(t('fb.error'), 'err');
    }
  });
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
  setTimeout(() => area.focus(), 250);
}
