import { palette as themePalette } from './theme.js';
// Bộ vẽ 3D bằng Canvas 2D: thuật toán painter + khử mặt khuất + đổ bóng (port từ gui/render3d.py)
const BODY = [22, 24, 32];
const INNER = [12, 13, 18];
const GOLD = [255, 200, 60];                    // khung khối khi mở "Khối Rubik vàng" (Lv 30)
const unit3 = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const LIGHT = unit3([-0.2, 0.72, 0.66]);
const HALF = unit3([LIGHT[0], LIGHT[1], LIGHT[2] + 1.0]);

export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function camMatrix(yaw, pitch) {
  const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]];
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) M[i][j] += Rx[i][k] * Ry[k][j];
  return M;
}

// Kết quả một lần vẽ, dùng cho picking
export class Frame {
  constructor() { this.hits = []; this.rc = null; this.cx = this.cy = this.f = this.D = 0; }
  project(p) {
    const r = this.rc;
    const vz = r[2][0] * p[0] + r[2][1] * p[1] + r[2][2] * p[2];
    const vx = r[0][0] * p[0] + r[0][1] * p[1] + r[0][2] * p[2];
    const vy = r[1][0] * p[0] + r[1][1] * p[1] + r[1][2] * p[2];
    const s = this.f / (this.D - vz);
    return [this.cx + vx * s, this.cy - vy * s];
  }
}

const paletteCache = new Map();
const palette = (cols) => {
  const k = cols.join();
  if (!paletteCache.has(k)) paletteCache.set(k, cols.map(hexRgb));
  return paletteCache.get(k);
};

// anims: [[indices[], Float64Array(9) matrix]]
export function render(ctx, w, h, P, yaw = -35, pitch = 28, anims = [], zoom = 1.0, shadow = true, offsetY = 0, gold = false) {
  let Rall = P.R;
  if (anims.length) {
    Rall = P.R.slice();
    const tmp = new Float64Array(9);
    for (const [idx, M] of anims) for (const p of idx) {
      const b = p * 9;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        tmp[i * 3 + j] = M[i * 3] * Rall[b + j] + M[i * 3 + 1] * Rall[b + 3 + j] + M[i * 3 + 2] * Rall[b + 6 + j];
      }
      Rall.set(tmp, b);
    }
  }
  const animating = anims.length > 0;
  const nV = P.nV, nF = P.nF;
  const rc = camMatrix(yaw, pitch);
  const V = new Float64Array(nV * 3), Vv = new Float64Array(nV * 3);
  for (let m = 0; m < nV; m++) {
    const b = P.vpiece[m] * 9, i3 = m * 3;
    const x = P.V0[i3], y = P.V0[i3 + 1], z = P.V0[i3 + 2];
    const wx = Rall[b] * x + Rall[b + 1] * y + Rall[b + 2] * z;
    const wy = Rall[b + 3] * x + Rall[b + 4] * y + Rall[b + 5] * z;
    const wz = Rall[b + 6] * x + Rall[b + 7] * y + Rall[b + 8] * z;
    V[i3] = wx; V[i3 + 1] = wy; V[i3 + 2] = wz;
    Vv[i3] = rc[0][0] * wx + rc[0][1] * wy + rc[0][2] * wz;
    Vv[i3 + 1] = rc[1][0] * wx + rc[1][1] * wy + rc[1][2] * wz;
    Vv[i3 + 2] = rc[2][0] * wx + rc[2][1] * wy + rc[2][2] * wz;
  }
  const NW = new Float64Array(nF * 3), Nv = new Float64Array(nF * 3);
  for (let f = 0; f < nF; f++) {
    const b = P.fPiece[f] * 9, i3 = f * 3;
    const x = P.fN0[i3], y = P.fN0[i3 + 1], z = P.fN0[i3 + 2];
    const wx = Rall[b] * x + Rall[b + 1] * y + Rall[b + 2] * z;
    const wy = Rall[b + 3] * x + Rall[b + 4] * y + Rall[b + 5] * z;
    const wz = Rall[b + 6] * x + Rall[b + 7] * y + Rall[b + 8] * z;
    NW[i3] = wx; NW[i3 + 1] = wy; NW[i3 + 2] = wz;
    Nv[i3] = rc[0][0] * wx + rc[0][1] * wy + rc[0][2] * wz;
    Nv[i3 + 1] = rc[1][0] * wx + rc[1][1] * wy + rc[1][2] * wz;
    Nv[i3 + 2] = rc[2][0] * wx + rc[2][1] * wy + rc[2][2] * wz;
  }
  const rad = P.radius, D = 5.0 * rad;
  const f = 0.41 * Math.min(w, h) * D / rad * zoom;
  const cx = w / 2, cy = h / 2 + offsetY;
  const sx = new Float64Array(nV), sy = new Float64Array(nV);
  for (let m = 0; m < nV; m++) {
    const s = f / (D - Vv[m * 3 + 2]);
    sx[m] = cx + Vv[m * 3] * s; sy[m] = cy - Vv[m * 3 + 1] * s;
  }
  const depth = new Float64Array(nF), vis = new Uint8Array(nF);
  for (let fi = 0; fi < nF; fi++) {
    const a = P.fStart[fi], c = P.fCnt[fi], q = a * 3;
    const dd = Nv[fi * 3] * (0 - Vv[q]) + Nv[fi * 3 + 1] * (0 - Vv[q + 1]) + Nv[fi * 3 + 2] * (D - Vv[q + 2]);
    vis[fi] = dd > 0 && (animating || !P.fInternal[fi]) ? 1 : 0;
    let z = 0;
    for (let k = 0; k < c; k++) z += Vv[(a + k) * 3 + 2];
    depth[fi] = z / c;
  }
  for (let s = 0; s < P.nS; s++) { const fi = P.stIdx[s]; depth[fi] = depth[fi - 1] + 1e-4 * rad; }
  const order = [];
  for (let fi = 0; fi < nF; fi++) if (vis[fi]) order.push(fi);
  order.sort((a, b) => depth[a] - depth[b]);

  if (shadow) {
    ctx.save();
    const ry = rad * 0.13 * f / D, rx = rad * 0.95 * f / D;
    const yy = cy + rad * 1.18 * f / D * (0.55 + 0.45 * Math.cos(pitch * Math.PI / 180));
    const g = ctx.createRadialGradient(cx, yy, 0, cx, yy, rx);
    g.addColorStop(0, `rgba(0,0,0,${themePalette.floor})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.translate(cx, yy); ctx.scale(1, ry / rx); ctx.translate(-cx, -yy);
    ctx.beginPath(); ctx.arc(cx, yy, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (gold) {                                    // vầng sáng vàng sau khối
    const gr = rad * 1.55 * f / D;
    const g2 = ctx.createRadialGradient(cx, cy, gr * 0.15, cx, cy, gr);
    g2.addColorStop(0, 'rgba(255,210,90,0.62)'); g2.addColorStop(0.5, 'rgba(255,195,70,0.26)'); g2.addColorStop(1, 'rgba(255,180,50,0)');
    ctx.save(); ctx.fillStyle = g2; ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2); ctx.restore();
  }
  const pal = palette(P.colors);
  const fr = new Frame();
  fr.rc = rc; fr.cx = cx; fr.cy = cy; fr.f = f; fr.D = D;
  ctx.lineWidth = 1.0; ctx.lineJoin = 'round';
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.trunc(v));
  for (const fi of order) {
    const a = P.fStart[fi], c = P.fCnt[fi], i3 = fi * 3;
    const nl = Nv[i3] * LIGHT[0] + Nv[i3 + 1] * LIGHT[1] + Nv[i3 + 2] * LIGHT[2];
    const diff = nl < 0 ? 0 : nl > 1 ? 1 : nl;
    const nh = Nv[i3] * HALF[0] + Nv[i3 + 1] * HALF[1] + Nv[i3 + 2] * HALF[2];
    const spec = (nh < 0 ? 0 : nh > 1 ? 1 : nh) ** 28;
    let rgb;
    const sticker = P.fSticker[fi];
    if (sticker) {
      const base = pal[P.fColor[fi]], shade = 0.66 + 0.40 * diff;
      rgb = base.map((v) => clamp(v * shade + 255 * spec * (gold ? 0.36 : 0.22)));
    } else if (gold && !P.fInternal[fi]) {         // khung vàng ánh kim: mặt hướng lên phản chiếu sáng hơn + điểm bóng gắt
      const k = 0.7 + 0.45 * diff + 0.3 * (0.5 + 0.5 * Nv[i3 + 1]);
      rgb = GOLD.map((v, j) => clamp(v * k + (j === 2 ? 170 : 255) * spec * 0.8));
    } else {
      const base = P.fInternal[fi] ? INNER : BODY;
      rgb = base.map((v) => clamp(v * (0.8 + 0.5 * diff) + 40 * spec * 0.2));
    }
    const col = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.beginPath();
    ctx.moveTo(sx[a], sy[a]);
    for (let k = 1; k < c; k++) ctx.lineTo(sx[a + k], sy[a + k]);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    if (!sticker) { ctx.strokeStyle = col; ctx.stroke(); }
    else {
      const pts = [];
      let mx = 0, my = 0, mz = 0;
      for (let k = 0; k < c; k++) {
        pts.push([sx[a + k], sy[a + k]]);
        mx += V[(a + k) * 3]; my += V[(a + k) * 3 + 1]; mz += V[(a + k) * 3 + 2];
      }
      fr.hits.push([pts, fi, [mx / c, my / c, mz / c], [NW[i3], NW[i3 + 1], NW[i3 + 2]], P.fPiece[fi]]);
    }
  }
  fr.hits.reverse();   // gần camera trước
  return fr;
}

// Vẽ puzzle vào một canvas riêng (dùng làm ảnh thu nhỏ)
export function renderImage(P, size, yaw = -35, pitch = 28, zoom = 1.0, anims = [], shadow = false, gold = false) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  render(cv.getContext('2d'), size, size, P, yaw, pitch, anims, zoom, shadow, 0, gold);
  return cv;
}
