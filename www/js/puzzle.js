// Lõi mô phỏng puzzle: mảnh (piece) + phép quay quanh trục theo lớp cắt (port từ core/puzzle.py)
import { polyNormal, insetConvex, roundCorners, mean, sub } from './geometry.js';

export const INF = 1e9;

export function rotMatrix(axis, ang) {
  const l = Math.hypot(axis[0], axis[1], axis[2]);
  const a = [axis[0] / l, axis[1] / l, axis[2] / l];
  const K = [[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]];
  const s = Math.sin(ang), c1 = 1 - Math.cos(ang);
  const M = new Float64Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let kk = 0;
    for (let k = 0; k < 3; k++) kk += K[i][k] * K[k][j];
    M[i * 3 + j] = (i === j ? 1 : 0) + s * K[i][j] + c1 * kk;
  }
  return M;
}

export class Move {
  constructor(axis, lo, hi, angle, name = '') {
    this.axis = axis; this.lo = lo; this.hi = hi; this.angle = angle; this.name = name;
  }
  inv() { return new Move(this.axis, this.lo, this.hi, -this.angle, this.name); }
}

export class Step {
  constructor(label, moves) { this.label = label; this.moves = moves; }
}

export class Puzzle {
  constructor() {
    this.key = ''; this.title = '';
    this.snap = false; this.pickExcludeParallel = true;
    this.unit = 1.0; this.colors = []; this._turns = [];
  }

  // pieces: Array< Array<[verts, color]> >
  finalize(pieces) {
    const P = pieces.length;
    this.P = P;
    this.R = new Float64Array(P * 9);
    this.reset();
    this.c0 = new Float64Array(P * 3);
    const vs = [], vp = [];
    const fs = [], fcnt = [], fp = [], fn = [], fcol = [], fint = [], fst = [];
    let pos = 0;
    const inset = this.unit * 0.075, rad = this.unit * 0.11;
    pieces.forEach((faces, pi) => {
      const allv = faces.flatMap((f) => f[0]);
      const cen = mean(allv);
      this.c0.set(cen, pi * 3);
      for (const [verts, color] of faces) {
        let n = polyNormal(verts);
        const m0 = mean(verts);
        if (n[0] * (m0[0] - cen[0]) + n[1] * (m0[1] - cen[1]) + n[2] * (m0[2] - cen[2]) < 0) n = n.map((x) => -x);
        const polys = [[verts, color < 0, false, -1]];
        if (color >= 0) {
          let sv = insetConvex(verts, inset);
          if (sv === null) {
            const c = mean(verts);
            sv = verts.map((p) => [0, 1, 2].map((j) => c[j] + (p[j] - c[j]) * 0.7));
          } else sv = roundCorners(sv, rad);
          const off = this.unit * 0.006;
          polys.push([sv.map((p) => [p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off]), false, true, color]);
        }
        for (const [pv, internal, sticker, col] of polys) {
          fs.push(pos); fcnt.push(pv.length); fp.push(pi); fn.push(n);
          fcol.push(col); fint.push(internal); fst.push(sticker);
          for (const p of pv) vs.push(p);
          for (let k = 0; k < pv.length; k++) vp.push(pi);
          pos += pv.length;
        }
      }
    });
    this.V0 = new Float64Array(vs.length * 3);
    vs.forEach((v, i) => this.V0.set(v, i * 3));
    this.nV = vs.length;
    this.vpiece = Int32Array.from(vp);
    this.fStart = Int32Array.from(fs);
    this.fCnt = Int32Array.from(fcnt);
    this.fPiece = Int32Array.from(fp);
    this.nF = fs.length;
    this.fN0 = new Float64Array(this.nF * 3);
    fn.forEach((n, i) => this.fN0.set(n, i * 3));
    this.fColor = Int32Array.from(fcol);
    this.fInternal = Uint8Array.from(fint.map(Number));
    this.fSticker = Uint8Array.from(fst.map(Number));
    this.fC0 = new Float64Array(this.nF * 3);
    for (let f = 0; f < this.nF; f++) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < fcnt[f]; k++) {
        const i = (fs[f] + k) * 3;
        x += this.V0[i]; y += this.V0[i + 1]; z += this.V0[i + 2];
      }
      this.fC0.set([x / fcnt[f], y / fcnt[f], z / fcnt[f]], f * 3);
    }
    let r2 = 0;
    for (let i = 0; i < this.nV; i++) {
      const q = this.V0[i * 3] ** 2 + this.V0[i * 3 + 1] ** 2 + this.V0[i * 3 + 2] ** 2;
      if (q > r2) r2 = q;
    }
    this.radius = Math.sqrt(r2);
    const st = [];
    for (let f = 0; f < this.nF; f++) if (this.fSticker[f]) st.push(f);
    this.stIdx = Int32Array.from(st);
    this.nS = st.length;
    this.stPiece = Int32Array.from(st.map((f) => this.fPiece[f]));
    this.stN0 = new Float64Array(this.nS * 3);
    this.stC0 = new Float64Array(this.nS * 3);
    this.stColor = Int32Array.from(st.map((f) => this.fColor[f]));
    st.forEach((f, i) => {
      this.stN0.set(this.fN0.subarray(f * 3, f * 3 + 3), i * 3);
      this.stC0.set(this.fC0.subarray(f * 3, f * 3 + 3), i * 3);
    });
  }

  reset() {
    this.R.fill(0);
    for (let p = 0; p < this.P; p++) { const b = p * 9; this.R[b] = this.R[b + 4] = this.R[b + 8] = 1; }
  }

  clone() {
    const c = Object.create(Object.getPrototypeOf(this));
    Object.assign(c, this);
    c.R = this.R.slice();
    return c;
  }

  centroidAxisProj(p, axis) {
    const R = this.R, b = p * 9, c = p * 3, c0 = this.c0;
    let v = 0;
    for (let i = 0; i < 3; i++) v += axis[i] * (R[b + i * 3] * c0[c] + R[b + i * 3 + 1] * c0[c + 1] + R[b + i * 3 + 2] * c0[c + 2]);
    return v;
  }

  select(mv) {
    const out = [];
    for (let p = 0; p < this.P; p++) {
      const v = this.centroidAxisProj(p, mv.axis);
      if (v > mv.lo && v <= mv.hi) out.push(p);
    }
    return out;
  }

  valid() { return true; }

  apply(mv) {
    if (!this.valid(mv)) return false;
    const idx = this.select(mv);
    const M = rotMatrix(mv.axis, mv.angle);
    const R = this.R, tmp = new Float64Array(9);
    for (const p of idx) {
      const b = p * 9;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        tmp[i * 3 + j] = M[i * 3] * R[b + j] + M[i * 3 + 1] * R[b + 3 + j] + M[i * 3 + 2] * R[b + 6 + j];
      }
      R.set(tmp, b);
    }
    if (this.snap) for (let i = 0; i < R.length; i++) R[i] = Math.round(R[i]) + 0;
    return true;
  }

  applyStep(step) {
    let ok = true;
    for (const m of step.moves) ok = this.apply(m) && ok;
    return ok;
  }

  applyAlg(alg) { for (const st of this.parse(alg)) this.applyStep(st); }

  // vị trí, pháp tuyến, màu hiện tại của mọi sticker
  stickers() {
    const n = this.nS, c = new Float64Array(n * 3), nr = new Float64Array(n * 3);
    for (let s = 0; s < n; s++) {
      const b = this.stPiece[s] * 9, i3 = s * 3, R = this.R;
      for (let i = 0; i < 3; i++) {
        c[i3 + i] = R[b + i * 3] * this.stC0[i3] + R[b + i * 3 + 1] * this.stC0[i3 + 1] + R[b + i * 3 + 2] * this.stC0[i3 + 2];
        nr[i3 + i] = R[b + i * 3] * this.stN0[i3] + R[b + i * 3 + 1] * this.stN0[i3 + 1] + R[b + i * 3 + 2] * this.stN0[i3 + 2];
      }
    }
    return { c, n: nr, col: this.stColor };
  }

  isSolved() {
    const { n, col } = this.stickers();
    const seen = new Map();
    for (let s = 0; s < this.nS; s++) {
      const k = `${Math.round(n[s * 3] * 100)},${Math.round(n[s * 3 + 1] * 100)},${Math.round(n[s * 3 + 2] * 100)}`;
      const prev = seen.get(k);
      if (prev === undefined) seen.set(k, col[s]);
      else if (prev !== col[s]) return false;
    }
    return true;
  }

  // dùng cho kiểm thử đối chiếu với bản Python
  signature() {
    const { c, col } = this.stickers();
    const rows = [];
    for (let s = 0; s < this.nS; s++) {
      rows.push([Math.round(c[s * 3] * 50) + 0, Math.round(c[s * 3 + 1] * 50) + 0, Math.round(c[s * 3 + 2] * 50) + 0, col[s]]);
    }
    rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    return rows.map((r) => r.join(',')).join(';');
  }

  parse() { throw new Error('not implemented'); }

  invertAlg(alg) {
    return alg.split(/\s+/).filter(Boolean).reverse().map(Puzzle.invToken).join(' ');
  }

  static invToken(t) {
    if (t.endsWith("2'") || t.endsWith('2')) return t.endsWith("2'") ? t.slice(0, -1) : t;
    return t.endsWith("'") ? t.slice(0, -1) : t + "'";
  }

  pickCandidates(piece) {
    return this._turns.filter((t) => this.select(t).includes(piece));
  }
}
