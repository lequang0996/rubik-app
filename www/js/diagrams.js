// Ảnh minh hoạ trường hợp: sơ đồ nhìn từ trên (OLL/PLL) hoặc ảnh 3D nhỏ (port từ gui/diagrams.py)
import { getPuzzle } from './registry.js';
import { renderImage } from './render3d.js';
import { VIEWS } from './viewport.js';

const cache = new Map();

function roundRect(q, x, y, w, h, r) {
  q.beginPath();
  q.roundRect(x, y, w, h, r);
  q.fill();
}

function topDiagram(p, mode, size) {
  const n = p.n;
  const { c, n: nr, col } = p.stickers();
  const cols = p.colors;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const q = cv.getContext('2d');
  const margin = size * 0.06, t = size * 0.075;
  const cs = (size - 2 * margin - 2 * t - 2 * 3) / n;
  const ox = margin + t + 3, off = (n - 1) / 2;
  const fill = (ci) => (mode === 'orient' ? (ci === 0 ? '#FFD23F' : '#3B4160') : cols[ci]);
  q.fillStyle = '#151927';
  roundRect(q, 0, 0, size, size, size * 0.12);
  const gap = Math.max(1.5, cs * 0.06);
  for (let i = 0; i < col.length; i++) {
    const x = c[i * 3], y = c[i * 3 + 1], z = c[i * 3 + 2];
    const nx = nr[i * 3], ny = nr[i * 3 + 1], nz = nr[i * 3 + 2];
    if (ny > 0.9) {
      q.fillStyle = fill(col[i]);
      roundRect(q, ox + (x + off) * cs + gap, ox + (z + off) * cs + gap, cs - 2 * gap, cs - 2 * gap, cs * 0.14);
    } else if (Math.abs(ny) < 0.1 && y > off - 0.1) {
      const ux = x + off, uz = z + off;
      let r;
      if (nz > 0.9) r = [ox + ux * cs + gap, ox + n * cs + 3, cs - 2 * gap, t];
      else if (nz < -0.9) r = [ox + ux * cs + gap, ox - 3 - t, cs - 2 * gap, t];
      else if (nx > 0.9) r = [ox + n * cs + 3, ox + uz * cs + gap, t, cs - 2 * gap];
      else r = [ox - 3 - t, ox + uz * cs + gap, t, cs - 2 * gap];
      q.fillStyle = fill(col[i]);
      roundRect(q, r[0], r[1], r[2], r[3], 2.5);
    }
  }
  return cv;
}

// Trả về canvas kích thước size*2 (đã cache)
export function caseImage(key, setupAlg, diagram = '3d', mode = 'orient', size = 96) {
  const k = [key, setupAlg, diagram, mode, size].join('|');
  if (cache.has(k)) return cache.get(k);
  const p = getPuzzle(key);
  if (setupAlg) p.applyAlg(setupAlg);
  let img;
  if (diagram === 'top' && (key === '2x2' || key === '3x3')) img = topDiagram(p, mode, size * 2);
  else {
    const [y0, p0] = VIEWS[key] || [-35, 28];
    img = renderImage(p, size * 2, y0, p0, 1.0, [], false);
  }
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  cache.set(k, img);
  return img;
}
