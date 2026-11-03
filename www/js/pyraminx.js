// Pyraminx: tứ diện, 4 trục, mỗi trục có lớp và đỉnh (tip) (port từ core/pyraminx.py)
import { Puzzle, Move, Step, INF } from './puzzle.js';
import { cutPolyhedron, mul, norm } from './geometry.js';

export const PYRA_COLORS = ['#F7D21E', '#1FA84F', '#D7263D', '#1E5BD8'];
const R0 = 1.25;
const VERT = {
  U: mul([0, 1, 0], R0),
  L: mul([-0.8165, -1 / 3, 0.4714], R0),
  R: mul([0.8165, -1 / 3, 0.4714], R0),
  B: mul([0, -1 / 3, -0.9428], R0),
};
// mặt đối diện mỗi đỉnh → màu (thứ tự khớp bản Python)
export const PYRA_OPP = [['U', 0], ['B', 1], ['R', 2], ['L', 3]];
const TOK = /^([ULRBulrb])(')?$/;

export class Pyraminx extends Puzzle {
  constructor() {
    super();
    this.key = 'pyraminx'; this.title = 'Pyraminx'; this.colors = PYRA_COLORS; this.unit = 0.5;
    const names = ['U', 'L', 'R', 'B'];
    const base = PYRA_OPP.map(([opp, col]) => [names.filter((n) => n !== opp).map((n) => VERT[n]), col]);
    this.axes = {};
    for (const n of names) this.axes[n] = mul(VERT[n], 1 / norm(VERT[n]));
    const planes = [];
    for (const n of names) planes.push([this.axes[n], 5 / 9 * R0], [this.axes[n], 1 / 9 * R0]);
    const cells = cutPolyhedron(base, planes);
    if (cells.length !== 15) throw new Error('pyraminx: ' + cells.length);
    this.finalize(cells);
    this._turns = [];
    for (const n of names) {
      this._turns.push(new Move(this.axes[n], 1 / 9 * R0, INF, 2 * Math.PI / 3));
      this._turns.push(new Move(this.axes[n], 5 / 9 * R0, INF, 2 * Math.PI / 3));
    }
  }

  parse(alg) {
    const steps = [];
    for (const tok of alg.split(/\s+/).filter(Boolean)) {
      const m = TOK.exec(tok);
      if (!m) throw new Error(`Ký hiệu Pyraminx không hợp lệ: ${tok}`);
      const ch = m[1], pr = m[2];
      const lower = ch === ch.toLowerCase();
      const lo = lower ? 5 / 9 * R0 : 1 / 9 * R0;
      const ang = -2 * Math.PI / 3 * (pr ? -1 : 1);
      steps.push(new Step(tok, [new Move(this.axes[ch.toUpperCase()], lo, INF, ang, tok)]));
    }
    return steps;
  }
}
