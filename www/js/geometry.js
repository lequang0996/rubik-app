// Hình học: cắt đa diện lồi bằng mặt phẳng, bo góc sticker (port từ core/geometry.py)
export const EPS = 1e-7;
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => Math.hypot(a[0], a[1], a[2]);
export const mean = (vs) => {
  const s = [0, 0, 0];
  for (const v of vs) { s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; }
  return [s[0] / vs.length, s[1] / vs.length, s[2] / vs.length];
};

export function polyNormal(v) {
  const n = [0, 0, 0];
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const ln = norm(n);
  return ln > 0 ? mul(n, 1 / ln) : n;
}

export function polyArea(v) {
  let n = [0, 0, 0];
  for (let i = 0; i < v.length; i++) n = add(n, cross(v[i], v[(i + 1) % v.length]));
  return 0.5 * norm(n);
}

function clipPoly(verts, n, d) {
  const out = [], cut = [];
  const m = verts.length;
  for (let i = 0; i < m; i++) {
    const a = verts[i], b = verts[(i + 1) % m];
    const da = dot(a, n) - d, db = dot(b, n) - d;
    if (da >= -EPS) out.push(a);
    if (Math.abs(da) <= EPS) cut.push(a);
    else if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const p = add(a, mul(sub(b, a), da / (da - db)));
      out.push(p); cut.push(p);
    }
  }
  return [out, cut];
}

// faces = [[verts, color]]; giữ phần n·p >= d của đa diện lồi
function clipCell(faces, n, d) {
  let mn = Infinity, mx = -Infinity;
  for (const [vs] of faces) for (const v of vs) { const s = dot(v, n) - d; if (s < mn) mn = s; if (s > mx) mx = s; }
  if (mn >= -EPS) return faces;
  if (mx <= EPS) return null;
  const nw = [], pts = [];
  for (const [verts, color] of faces) {
    const [res, cut] = clipPoly(verts, n, d);
    for (const c of cut) pts.push(c);
    if (res.length >= 3 && polyArea(res) > 1e-9) nw.push([res, color]);
  }
  const uniq = [];
  for (const p of pts) if (!uniq.some((q) => norm(sub(p, q)) < 1e-6)) uniq.push(p);
  if (uniq.length >= 3) {
    const c = mean(uniq);
    let u = sub(uniq[0], c); u = mul(u, 1 / norm(u));
    const w = cross(n, u);
    const ang = uniq.map((p) => Math.atan2(dot(sub(p, c), w), dot(sub(p, c), u)));
    const order = ang.map((_, i) => i).sort((i, j) => ang[i] - ang[j]);
    const cap = order.map((i) => uniq[i]);
    if (polyArea(cap) > 1e-9) nw.push([cap, -1]);
  }
  return nw.length >= 4 ? nw : null;
}

export function cutPolyhedron(faces, planes) {
  let cells = [faces];
  for (const [n0, d] of planes) {
    const n = Array.from(n0);
    const nn = n.map((x) => -x);
    const nxt = [];
    for (const c of cells) {
      const a = clipCell(c, n, d), b = clipCell(c, nn, -d);
      if (a) nxt.push(a);
      if (b) nxt.push(b);
    }
    cells = nxt;
  }
  return cells;
}

export function insetConvex(verts, delta) {
  const v = verts.map((p) => Array.from(p));
  const nrm = polyNormal(v);
  const c = mean(v);
  let cur = v;
  const m = v.length;
  for (let i = 0; i < m; i++) {
    const a = v[i], b = v[(i + 1) % m];
    let e = sub(b, a); e = mul(e, 1 / norm(e));
    let inward = cross(nrm, e);
    if (dot(inward, sub(c, a)) < 0) inward = mul(inward, -1);
    const [res] = clipPoly(cur, inward, dot(inward, a) + delta);
    if (res.length < 3) return null;
    cur = res;
  }
  return cur;
}

export function roundCorners(verts, radius, seg = 3) {
  const m = verts.length, out = [];
  for (let i = 0; i < m; i++) {
    const p = verts[i], a = verts[(i - 1 + m) % m], b = verts[(i + 1) % m];
    const la = norm(sub(a, p)), lb = norm(sub(b, p));
    const ta = Math.min(radius / la, 0.45), tb = Math.min(radius / lb, 0.45);
    const s = add(p, mul(sub(a, p), ta)), e = add(p, mul(sub(b, p), tb));
    for (let k = 0; k <= seg; k++) {
      const u = k / seg;
      out.push([0, 1, 2].map((j) => (1 - u) ** 2 * s[j] + 2 * u * (1 - u) * p[j] + u * u * e[j]));
    }
  }
  return out;
}
