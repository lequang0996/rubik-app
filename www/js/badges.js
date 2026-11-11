// Huy hiệu & danh hiệu Lv 22–30: khiên kim loại chứa mặt Rubik 3×3, mỗi cấp sáng thêm 1 ô (Lv 22 = 1 ô … Lv 30 = đủ 9 ô)
import { h } from './dom.js';
import { t } from './i18n.js';

export const RANK_FIRST = 22, RANK_LAST = 30;

// [sáng, giữa, tối] theo chất liệu: đồng · bạc · vàng · bạch kim · lục bảo · hồng ngọc · lam ngọc · kim cương · vàng rực
const MATS = [
  ['#F3C79A', '#C8864B', '#7C4624'],
  ['#FFFFFF', '#BAC2CE', '#7A8493'],
  ['#FFF0A0', '#E6B422', '#9A6F08'],
  ['#F6FBFF', '#CBDDEE', '#8AA3BE'],
  ['#9BF7CC', '#25BC80', '#0B6745'],
  ['#FFA3B1', '#DD2748', '#7A0C25'],
  ['#A5D2FF', '#3A7BE6', '#14398A'],
  ['#F0FFFF', '#8EE4FF', '#B49CFF'],
  ['#FFF7B8', '#FFC933', '#E08800'],
];

// Danh sách danh hiệu: tên nằm trong locales (rank.<Lv>)
export const RANKS = MATS.map((_, i) => ({ lv: RANK_FIRST + i, key: `rank.${RANK_FIRST + i}`, tier: i + 1 }));
export const rankOf = (level) => (level < RANK_FIRST ? null : RANKS[Math.min(level, RANK_LAST) - RANK_FIRST]);

const OUTER = 'M24 2 L44 9 V28 C44 42 35 51 24 54 C13 51 4 42 4 28 V9 Z';
const INNER = 'M24 6.5 L40 12 V28 C40 39.5 33 47 24 49.8 C15 47 8 39.5 8 28 V12 Z';
const STAR = 'M0 -3.2 L.9 -.9 L3.2 0 L.9 .9 L0 3.2 L-.9 .9 L-3.2 0 L-.9 -.9Z';
let uid = 0;

// Trả về phần tử huy hiệu (hoặc null nếu chưa tới Lv 22). size = chiều cao px
export function badge(level, size = 40) {
  const r = rankOf(level);
  if (!r) return null;
  const [c1, c2, c3] = MATS[r.tier - 1], id = `bd${++uid}`;
  const top = r.lv === RANK_LAST;
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const x = 13.5 + (i % 3) * 7.5, y = 16.5 + Math.floor(i / 3) * 7.5, lit = i < r.tier;
    cells.push(`<rect x="${x}" y="${y}" width="6" height="6" rx="1.4" fill="${lit ? `url(#${id}c)` : 'rgba(255,255,255,.11)'}"${top && i === 4 ? ' class="bd-core"' : ''}/>`);
  }
  const crown = top ? `<path d="M13 5 L15.5 -4.5 L20.5 .5 L24 -6.5 L27.5 .5 L32.5 -4.5 L35 5 Z" fill="url(#${id}r)" stroke="${c3}" stroke-width=".6" stroke-linejoin="round"/>`
    + '<circle cx="15.5" cy="-4.5" r="1.3" fill="#fff"/><circle cx="24" cy="-6.5" r="1.5" fill="#fff"/><circle cx="32.5" cy="-4.5" r="1.3" fill="#fff"/>' : '';
  const sparks = r.lv >= 29 ? [[5, 14, 0], [43, 20, .6], [40, 47, 1.2], [8, 44, 1.8]]
    .map(([x, y, d]) => `<g transform="translate(${x} ${y})"><path class="bd-spark" d="${STAR}" fill="#fff" style="animation-delay:${d}s"/></g>`).join('') : '';
  const svg = `<svg viewBox="0 -8 48 64" width="${(size * 48 / 64).toFixed(1)}" height="${size}" aria-hidden="true">`
    + `<defs><linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>`
    + `<linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`
    + `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A3045"/><stop offset="1" stop-color="#0F121B"/></linearGradient></defs>`
    + `<path d="${OUTER}" fill="url(#${id}r)"/><path d="${INNER}" fill="url(#${id}f)" stroke="${c1}" stroke-opacity=".45" stroke-width=".8"/>`
    + cells.join('') + crown + sparks + '</svg>';
  return h('span', { class: `badge b${r.lv}`, role: 'img', 'aria-label': t(r.key), html: svg });
}
