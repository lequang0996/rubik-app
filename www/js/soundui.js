// Bảng âm thanh: bật/tắt nhạc nền, tiếng xoay và chọn bài (mở từ menu ☰)
import { h, clear } from './dom.js';
import { t } from './i18n.js';
import { sound, TRACKS } from './audio.js';
import { sheetHead } from './sheetui.js';

export function openSoundSheet() {
  const root = document.getElementById('modal-root');
  const sheet = h('div', { class: 'sheet', role: 'dialog' });
  const row = (label, on, fn) => h('button', { type: 'button', class: 'switchrow', role: 'switch', 'aria-checked': String(on), onClick: fn },
    h('span', { class: 'steptitle' }, label), h('span', { class: 'sw' + (on ? ' on' : '') }, h('i')));
  const render = () => {
    clear(sheet);
    sheet.append(
      sheetHead('music', t('snd.title')),
      h('div', { class: 'langlist' },
        row('🎶  ' + t('snd.music'), sound.music, () => sound.setMusic(!sound.music)),
        row('🧊  ' + t('snd.sfx'), sound.sfx, () => sound.setSfx(!sound.sfx))),
      h('div', { class: 'section' }, t('snd.track')),
      h('div', { class: 'langlist' }, TRACKS.map(([id]) =>
        h('button', { type: 'button', class: 'langbtn trackbtn' + (sound.track === id ? ' on' : ''), onClick: () => sound.setTrack(id) },
          h('span', { class: 'trkname' }, h('b', {}, t('snd.t.' + id)), h('small', {}, t('snd.d.' + id))),
          sound.track === id ? h('span', {}, sound.music ? '♪' : '✓') : null))));
  };
  render();
  const off = sound.onChange(() => { if (!sheet.isConnected) off(); else render(); });
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
}
