// Đối chiếu engine JS với bản Python gốc.  node tools/test_engine.mjs [golden.json]
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getPuzzle, PUZZLES } from '../www/js/registry.js';
import { randomScramble } from '../www/js/scramble.js';

const golden = JSON.parse(fs.readFileSync(process.argv[2] || 'tools/golden.json', 'utf8'));
const h = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
let fail = 0, total = 0;
const bad = (m) => { if (fail++ < 15) console.log('  ✗', m); };

for (const [key] of PUZZLES) {
  const p = getPuzzle(key), g = golden.geom[key];
  total++;
  let sumV = 0, sumAbs = 0;
  for (const x of p.V0) { sumV += x; sumAbs += Math.abs(x); }
  if (p.P !== g.P || p.nV !== g.nV || p.nF !== g.nF || p.nS !== g.nS) bad(`${key} đếm hình học ${p.P}/${p.nV}/${p.nF}/${p.nS} ≠ ${g.P}/${g.nV}/${g.nF}/${g.nS}`);
  else if (Math.abs(sumV - g.sumV) > 1e-6 || Math.abs(sumAbs - g.sumAbs) > 1e-6 || Math.abs(p.radius - g.radius) > 1e-9) bad(`${key} toạ độ đỉnh lệch (${sumV} vs ${g.sumV})`);
  else if (h(Array.from(p.fColor).join(',')) !== g.colors) bad(`${key} màu mặt lệch`);
  let n = 0;
  for (const [alg, setup, inv, s1, s2, solved, s3] of golden.algs[key]) {
    n++; total++;
    const sg = (q) => h(q.signature());
    const q = getPuzzle(key); q.applyAlg(alg);
    if (sg(q) !== s1) { bad(`${key} sig sau "${alg}"`); continue; }
    const q2 = getPuzzle(key);
    if (q2.invertAlg(alg) !== inv) bad(`${key} invertAlg "${alg}" → "${q2.invertAlg(alg)}" ≠ "${inv}"`);
    q2.applyAlg(setup || q2.invertAlg(alg));
    if (sg(q2) !== s2) { bad(`${key} sig setup "${alg}"`); continue; }
    q2.applyAlg(alg);
    if (q2.isSolved() !== solved || sg(q2) !== s3) bad(`${key} sau setup+alg "${alg}" solved=${q2.isSolved()} (py ${solved})`);
  }
  console.log(`${key}: ${n} công thức đã đối chiếu`);
}
// scramble + undo phải trở về trạng thái đã giải
for (const [key] of PUZZLES) {
  total++;
  const p = getPuzzle(key);
  const mv = randomScramble(p);
  const solvedAfter = p.isSolved();
  for (const ms of mv.reverse()) for (const m of ms.reverse()) p.apply(m.inv());
  if (!p.isSolved()) bad(`${key} undo scramble không về trạng thái đã giải`);
  if (solvedAfter && mv.length > 5) bad(`${key} scramble ra khối đã giải`);
}
console.log(fail ? `\nTHẤT BẠI: ${fail}/${total}` : `\nTẤT CẢ ĐẠT: ${total} kiểm tra`);
process.exit(fail ? 1 : 0);
