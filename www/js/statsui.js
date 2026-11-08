// Bảng Thống kê: thời gian dùng cho 6 puzzle; bấm vào một puzzle để xem chi tiết từng mục (Cross, F2L, OLL, PLL…)
import { h, clear } from './dom.js';
import { t, td } from './i18n.js';
import { icon } from './icons.js';
import { sheetHead } from './sheetui.js';
import { stats } from './stats.js';
import { loadPuzzleData } from './data.js';
import { cleanTitle, thumb } from './components.js';
import { levelList } from './guide.js';

// 7500 → "2 giờ 5 phút", 90 → "1 phút 30 giây", 45 → "45 giây" (hai đơn vị lớn nhất)
export function fmtLocal(sec) {
  sec = Math.max(0, Math.round(sec));
  const D = 86400, H = 3600, M = 60;
  const parts = [[Math.floor(sec / D), 'dur.d'], [Math.floor((sec % D) / H), 'dur.h'], [Math.floor((sec % H) / M), 'dur.m'], [sec % M, 'dur.s']];
  const i = parts.findIndex(([n]) => n > 0);
  if (i < 0) return `0${t('dur.s')}`;
  return parts.slice(i, i + 2).filter(([n], k) => n > 0 || k === 0).map(([n, k]) => `${n}${t(k)}`).join(' ');
}

// tên hiển thị của một mục thời gian
function bucketLabel(bucket, data) {
  if (bucket === 'play') return { name: t('mode.play'), sub: '' };
  const [lid, cid] = bucket.split('/');
  if (cid === '__all__') return { name: t('stats.mixed'), sub: '' };
  const cats = data && data.levels[lid];
  const c = cats && cats.find((x) => x.id === cid);
  if (!c) return { name: t('stats.other'), sub: '' };
  const lv = levelList(data).find((l) => l[0] === lid);
  return { name: cleanTitle(td(c.title), c.cases.length).replace(/^\d+\s*[·.\-–]\s*/, ''), sub: lv && levelList(data).length > 1 ? lv[1] : '' };
}

export async function openStatsSheet({ puzzles, puzzleIcon }) {
  const root = document.getElementById('modal-root');
  const datas = await Promise.all(puzzles.map(([k]) => loadPuzzleData(k).catch(() => null)));
  const grand = stats.grand();
  const max = Math.max(1, ...puzzles.map(([k]) => stats.total(k)));
  const open = new Set();

  const body = h('div', { class: 'statlist' });
  const render = () => {
    clear(body);
    puzzles.forEach(([key, title], i) => {
      const total = stats.total(key), isOpen = open.has(key);
      const rows = [];
      if (isOpen) {
        const bs = stats.buckets(key);
        if (!bs.length) rows.push(h('div', { class: 'statempty' }, t('stats.empty')));
        for (const [b, sec] of bs) {
          const { name, sub } = bucketLabel(b, datas[i]);
          rows.push(h('div', { class: 'statrow' },
            h('div', { class: 'statrowtop' }, h('span', { class: 'statname' }, name, sub ? h('small', {}, sub) : null), h('span', { class: 'stattime' }, fmtLocal(sec))),
            h('span', { class: 'statbar' }, h('i', { style: `width:${Math.max(3, (sec / total) * 100).toFixed(1)}%` }))));
        }
      }
      body.append(h('div', { class: 'statitem' + (isOpen ? ' open' : '') },
        h('button', { type: 'button', class: 'statpuz', 'aria-expanded': String(isOpen), onClick: () => { if (open.has(key)) open.delete(key); else open.add(key); render(); } },
          thumb(puzzleIcon(key), 40),
          h('span', { class: 'statmain' },
            h('span', { class: 'statname' }, title),
            h('span', { class: 'statbar big' }, h('i', { style: `width:${total ? Math.max(3, (total / max) * 100).toFixed(1) : 0}%` }))),
          h('span', { class: 'stattime strong' }, fmtLocal(total)),
          h('span', { class: 'statchev' }, icon('chev', 16))),
        isOpen ? h('div', { class: 'statdetail' }, rows) : null));
    });
  };
  render();
  const sheet = h('div', { class: 'sheet statsheet', role: 'dialog', 'aria-label': t('stats.title') },
    sheetHead('chart', t('stats.title')),
    h('div', { class: 'stattotal' }, h('span', { class: 'statlabel' }, t('stats.total')), h('span', { class: 'statbig' }, fmtLocal(grand))),
    body, h('div', { class: 'statnote' }, t('stats.note')));
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
}
