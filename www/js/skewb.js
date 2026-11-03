// Skewb: lập phương cắt qua tâm, 4 trục chéo, xoay 120° (port từ core/skewb.py)
import { Puzzle, Move, Step, INF } from './puzzle.js';
import { cutPolyhedron, mul } from './geometry.js';
import { CUBE_COLORS, FACE_DIRS } from './cubes.js';

export const SKEWB_CORNER = { R: [1, -1, 1], L: [-1, 1, 1], U: [1, 1, -1], B: [-1, -1, -1] };
const TOK = /^([RLUB])(')?$/;

export class Skewb extends Puzzle {
  constructor() {
    super();
    this.key = 'skewb'; this.title = 'Skewb'; this.colors = CUBE_COLORS; this.unit = 1.0;
    const faces = [];
    for (const [f, d] of FACE_DIRS) {
      const ax = d.findIndex((x) => x !== 0);
      const u = [0, 0, 0]; u[(ax + 1) % 3] = 1;
      const w = [0, 0, 0]; w[(ax + 2) % 3] = 1;
      const p = (su, sw) => d.map((x, q) => x + su * u[q] + sw * w[q]);
      faces.push([[p(1, 1), p(-1, 1), p(-1, -1), p(1, -1)], f]);
    }
    this.axes = {};
    for (const [k, v] of Object.entries(SKEWB_CORNER)) this.axes[k] = mul(v, 1 / Math.sqrt(3));
    const planes = Object.values(this.axes).map((a) => [a, 0.0]);
    const cells = cutPolyhedron(faces, planes);
    if (cells.length !== 14) throw new Error('skewb: ' + cells.length);
    this.finalize(cells);
    this._turns = Object.values(this.axes).map((a) => new Move(a, 0.0, INF, 2 * Math.PI / 3));
  }

  parse(alg) {
    const steps = [];
    for (const tok of alg.split(/\s+/).filter(Boolean)) {
      const m = TOK.exec(tok);
      if (!m) throw new Error(`Ký hiệu Skewb không hợp lệ: ${tok}`);
      const ang = -2 * Math.PI / 3 * (m[2] ? -1 : 1);
      steps.push(new Step(tok, [new Move(this.axes[m[1]], 0.0, INF, ang, tok)]));
    }
    return steps;
  }
}
