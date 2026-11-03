import { Move } from './puzzle.js';

const DEFAULT_LEN = { '2x2': 12, '3x3': 25, '4x4': 40, '5x5': 55, pyraminx: 18, skewb: 12 };
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// Trộn ngẫu nhiên hợp lệ (áp dụng ngay vào puzzle); trả về danh sách [Move]
export function randomScramble(puzzle, length = null, rng = Math.random) {
  const key = puzzle.key;
  let turns = puzzle._turns;
  if (key === '2x2' || key === '3x3') {
    const n = puzzle.n;
    turns = turns.filter((t) => t.lo < -(n / 2 - 1) || t.hi > n / 2 - 1);
  }
  length = length || DEFAULT_LEN[key] || 20;
  const out = [];
  let last = null;
  for (let i = 0; i < length; i++) {
    let t;
    for (;;) {
      t = pick(turns, rng);
      if (last === null || !same(t.axis, last.axis) || t.lo !== last.lo) break;
    }
    const k = rng() < 0.5 ? 1 : -1;
    const mv = new Move(t.axis, t.lo, t.hi, t.angle * k);
    puzzle.apply(mv);
    out.push([mv]);
    last = t;
  }
  if (key === 'pyraminx') {   // tip ngẫu nhiên
    puzzle._turns.filter((_, i) => i % 2 === 1).forEach((t) => {
      const k = pick([0, 1, -1], rng);
      if (k) {
        const mv = new Move(t.axis, t.lo, t.hi, t.angle * k);
        puzzle.apply(mv); out.push([mv]);
      }
    });
  }
  return out;
}
