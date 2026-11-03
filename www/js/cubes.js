// Khối lập phương NxN (2x2 … 5x5) + ký hiệu WCA (port từ core/cubes.py)
import { Puzzle, Move, Step, INF } from './puzzle.js';

// U vàng, D trắng, F xanh lá, B xanh dương, R cam, L đỏ
export const CUBE_COLORS = ['#F7D21E', '#F4F6FA', '#1FA84F', '#1E5BD8', '#FF7A1A', '#D7263D'];
export const U = 0, D = 1, F = 2, B = 3, R = 4, L = 5;
// thứ tự khớp với dict của bản Python: R, L, U, D, F, B
export const FACE_DIRS = [[R, [1, 0, 0]], [L, [-1, 0, 0]], [U, [0, 1, 0]], [D, [0, -1, 0]], [F, [0, 0, 1]], [B, [0, 0, -1]]];
const AXIS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const TOK = /^(\d*)([RUFLDBrufldbMESxyz])(w?)(2'|2|3'|3|')?$/;

export class Cube extends Puzzle {
  constructor(n) {
    super();
    this.n = n; this.key = `${n}x${n}`; this.title = this.key;
    this.snap = true; this.colors = CUBE_COLORS; this.unit = 1.0;
    const h = 0.5, pieces = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const idx = [i, j, k];
      if (n > 2 && idx.every((q) => q > 0 && q < n - 1)) continue;
      const c = idx.map((q) => q - (n - 1) / 2);
      const faces = [];
      for (const [f, d] of FACE_DIRS) {
        const ax = d.findIndex((x) => x !== 0);
        const outer = (idx[ax] === n - 1 && d[ax] > 0) || (idx[ax] === 0 && d[ax] < 0);
        const u = [0, 0, 0]; u[(ax + 1) % 3] = h;
        const w = [0, 0, 0]; w[(ax + 2) % 3] = h;
        const ctr = c.map((x, q) => x + d[q] * h);
        const p = (su, sw) => ctr.map((x, q) => x + su * u[q] + sw * w[q]);
        faces.push([[p(1, 1), p(-1, 1), p(-1, -1), p(1, -1)], outer ? f : -1]);
      }
      pieces.push(faces);
    }
    this.finalize(pieces);
    this._turns = [];
    for (const ax of Object.values(AXIS)) {
      for (let m = 0; m < n; m++) {
        const cm = m - (n - 1) / 2;
        this._turns.push(new Move(ax, cm - 0.5, cm + 0.5, Math.PI / 2));
      }
    }
  }

  // lớp a..a+k-1 tính từ mặt `side` (+1/-1) → (lo, hi) theo toạ độ trục
  _layerRange(side, a, k) {
    const n = this.n;
    if (side > 0) return [n / 2 - (a + k - 1), n / 2 - (a - 1)];
    return [-(n / 2 - (a - 1)), -(n / 2 - (a + k - 1))];
  }

  parse(alg) {
    const steps = [];
    for (const tok of alg.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean)) {
      const m = TOK.exec(tok);
      if (!m) throw new Error(`Ký hiệu không hợp lệ cho ${this.key}: ${tok}`);
      const num = m[1] ? parseInt(m[1], 10) : 0, ch = m[2], w = m[3], suf = m[4];
      const lower = ch === ch.toLowerCase() && 'xyz'.indexOf(ch) < 0;
      const L_ = ch.toUpperCase();
      const mult = suf === '2' || suf === "2'" ? 2 : 1;
      const sign = suf === "'" || suf === "2'" || suf === '3' ? -1 : 1;
      let mv;
      if ('xyz'.includes(ch)) {
        mv = new Move(AXIS[ch], -INF, INF, sign * mult * -Math.PI / 2, tok);
      } else if ('MES'.includes(L_)) {
        const ax = { M: AXIS.x, E: AXIS.y, S: AXIS.z }[L_];
        const base = { M: Math.PI / 2, E: Math.PI / 2, S: -Math.PI / 2 }[L_];
        mv = new Move(ax, -0.5, 0.5, sign * mult * base, tok);
      } else {
        const side = { R: 1, U: 1, F: 1, L: -1, D: -1, B: -1 }[L_];
        const ax = { R: AXIS.x, L: AXIS.x, U: AXIS.y, D: AXIS.y, F: AXIS.z, B: AXIS.z }[L_];
        const wide = w === 'w' || lower;
        const [a, k] = wide ? [1, num || 2] : [num || 1, 1];
        const [lo, hi] = this._layerRange(side, a, k);
        mv = new Move(ax, lo, hi, sign * mult * (-Math.PI / 2 * side), tok);
      }
      steps.push(new Step(tok, [mv]));
    }
    return steps;
  }
}
