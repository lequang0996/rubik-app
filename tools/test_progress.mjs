// Kiểm thử logic cấp độ, mốc mở khoá, gói trả phí và chuỗi dịch.  node tools/test_progress.mjs
import fs from 'node:fs';
import path from 'node:path';
import { levelExp, levelOf, levelReq, stepCost, UNLOCKS, MAX_LEVEL, MODE_REQ, REQ_STATS, REQ_FEEDBACK, progress } from '../www/js/progress.js';
import { SUBS, PACKS, BASE_RATE, bestPlan, claimsFor, monthKey, packExp, subById } from '../www/js/plans.js';

let fail = 0, total = 0;
const eq = (a, b, m) => { total++; if (a !== b) { fail++; console.log(`  ✗ ${m}: nhận ${a}, mong ${b}`); } };
const ok = (c, m) => { total++; if (!c) { fail++; console.log(`  ✗ ${m}`); } };

// ---- công thức cấp độ
eq(levelExp(1), 0, 'Lv1 = 0 exp');
for (let n = 2; n <= 10; n++) eq(stepCost(n), 512, `lên Lv${n} cần 512`);
eq(levelExp(10), 9 * 512, 'tổng tới Lv10');
for (let n = 11; n <= 30; n++) eq(stepCost(n), 2 ** (n - 1), `lên Lv${n} cần 2^${n - 1}`);
eq(levelExp(11), 9 * 512 + 1024, 'tổng tới Lv11');
let sum = 0; for (let n = 2; n <= 30; n++) sum += stepCost(n);
eq(levelExp(30), sum, 'tổng tới Lv30');
eq(levelOf(0), 1, 'exp 0 → Lv1');
eq(levelOf(511), 1, '511 → Lv1');
eq(levelOf(512), 2, '512 → Lv2');
eq(levelOf(levelExp(10) - 1), 9, 'sát Lv10');
eq(levelOf(levelExp(10)), 10, 'đúng Lv10');
eq(levelOf(levelExp(11) - 1), 10, 'sát Lv11');
eq(levelOf(levelExp(11)), 11, 'đúng Lv11');
eq(levelOf(levelExp(30) - 1), 29, 'sát Lv30');
eq(levelOf(levelExp(30)), 30, 'đúng Lv30');
eq(levelOf(1e15), MAX_LEVEL, 'vượt Lv30 vẫn là 30');
for (let n = 2; n <= 30; n++) ok(levelExp(n) > levelExp(n - 1), `mốc Lv${n} tăng dần`);

// ---- mốc mở khoá đúng yêu cầu
eq(MODE_REQ.join(','), '0,0,0', 'Hướng dẫn / Luyện tập / Chơi mở sẵn (bỏ khoá Lv10)');
eq(REQ_STATS, 18, 'Thống kê Lv18'); eq(REQ_FEEDBACK, 25, 'Góp ý Lv25');
eq(levelReq('2x2', 'advanced'), 19, '2x2 nâng cao Lv19');
eq(levelReq('4x4', 'advanced'), 20, '4x4 nâng cao Lv20');
eq(levelReq('5x5', 'advanced'), 21, '5x5 nâng cao Lv21');
eq(levelReq('3x3', 'l3'), 22, '3x3 Tối ưu Lv22');
eq(levelReq('3x3', 'l4'), 23, '3x3 Roux Lv23');
eq(levelReq('3x3', 'l5'), 24, '3x3 Tối thượng Lv24');
eq(levelReq('3x3', 'basic'), 0, '3x3 cơ bản mở sẵn');
eq(levelReq('pyraminx', 'advanced'), 19, 'Pyraminx nâng cao Lv19');
eq(levelReq('skewb', 'advanced'), 19, 'Skewb nâng cao Lv19');
eq(UNLOCKS.map(([n]) => n).join(','), '18,19,20,21,22,23,24,25', 'danh sách mốc hiển thị (không còn Lv10)');
ok(UNLOCKS.every(([n], i) => i === 0 || n > UNLOCKS[i - 1][0]), 'mốc tăng dần');

// ---- tốc độ exp + cộng thưởng
eq(progress.rate, BASE_RATE, 'tốc độ mặc định');
progress.setRate(300); eq(progress.rate, 300, 'đặt tốc độ 300');
progress.setRate(0); eq(progress.rate, BASE_RATE, 'tốc độ không thấp hơn mặc định');
progress.setRate(NaN); eq(progress.rate, BASE_RATE, 'tốc độ NaN → mặc định');
let ups = 0; progress.on('levelup', () => ups++);
progress.grant(levelExp(30) + 5);
eq(progress.level, 30, 'grant vượt mọi cấp'); eq(ups, 1, 'chỉ một sự kiện levelup');
const before = progress.exp; progress.add(100); eq(progress.exp, before, 'đủ Lv30: tick dừng cộng');
progress.grant(1000); eq(progress.exp, before + 1000, 'grant vẫn cộng khi đã Lv30 (mua exp)');

// ---- bảng gói
eq(SUBS.map((p) => p.rate).join(','), '10,50,150,300', 'tốc độ các gói');
eq(SUBS.map((p) => p.first).join(','), '0,5000,15000,30000', 'thưởng lần đầu');
eq(SUBS.map((p) => p.monthly).join(','), '0,5000,15000,30000', 'thưởng đầu tháng');
eq(PACKS.map((p) => p.exp).join(','), '1000,10000,100000', 'gói mua lẻ (đã bỏ $1000)');
eq(packExp('exp_pack_100'), 100000, 'packExp'); eq(packExp('xyz'), 0, 'packExp lạ');
eq(bestPlan(['cube_sub_5', 'cube_sub_15', 'cube_sub_1']).id, 'cube_sub_15', 'gói cao nhất');
eq(bestPlan([]), null, 'không có gói'); eq(bestPlan(['abc']), null, 'ID lạ');
eq(monthKey(new Date(2026, 0, 31)), '2026-01', 'monthKey');

// ---- thưởng lần đầu / đầu tháng
const p5 = subById('cube_sub_5');
let s = { first: {}, month: '' };
let r = claimsFor(s, p5, new Date(2026, 10, 13));
eq(r.first, 5000, 'đăng ký lần đầu nhận thưởng'); eq(r.monthly, 0, 'tháng mua không nhận thêm thưởng tháng');
s = r.state;
r = claimsFor(s, p5, new Date(2026, 10, 30)); eq(r.first + r.monthly, 0, 'cùng tháng không nhận lại');
r = claimsFor(s, p5, new Date(2026, 11, 1)); eq(r.monthly, 5000, 'sang tháng nhận 5000'); eq(r.first, 0, 'không nhận lần đầu lại');
s = r.state;
r = claimsFor(s, p5, new Date(2026, 11, 2)); eq(r.monthly, 0, 'không nhận 2 lần trong tháng');
r = claimsFor(s, p5, new Date(2027, 5, 9)); eq(r.monthly, 5000, 'bỏ lỡ nhiều tháng chỉ nhận một lần');
// nâng gói: gói mới có thưởng lần đầu riêng
r = claimsFor(s, subById('cube_sub_15'), new Date(2026, 11, 15)); eq(r.first, 30000, 'nâng lên gói $15 nhận thưởng lần đầu của $15'); eq(r.monthly, 0, 'nâng gói không cộng thưởng tháng thêm');
r = claimsFor(r.state, subById('cube_sub_15'), new Date(2027, 0, 1)); eq(r.monthly, 30000, 'gói $15 thưởng tháng 30000');
r = claimsFor({ first: {}, month: '' }, subById('cube_sub_1'), new Date(2026, 3, 1)); eq(r.first + r.monthly, 0, 'gói $1 không có thưởng exp');
r = claimsFor({ first: {}, month: '' }, null, new Date()); eq(r.first + r.monthly, 0, 'không có gói → không thưởng');
const frozen = { first: { cube_sub_5: true }, month: '2026-10' }; claimsFor(frozen, p5, new Date(2026, 11, 1));
eq(JSON.stringify(frozen), '{"first":{"cube_sub_5":true},"month":"2026-10"}', 'claimsFor không sửa state vào');

// ---- chuỗi dịch: mọi khoá dùng trong JS đều có ở cả 8 ngôn ngữ + không còn cheat
const root = path.resolve('www');
const langs = fs.readdirSync(path.join(root, 'locales')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const dict = Object.fromEntries(langs.map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, 'locales', `${l}.json`), 'utf8'))]));
eq(langs.length, 8, '8 ngôn ngữ');
const used = new Set();
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js'));
for (const f of jsFiles) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/\bt[dm]?\(\s*'([a-z0-9_.]+)'/g)) used.add(m[1]);
  if (f === 'levelui.js') ok(!/devTap|DEV_CHEAT|DEV_TAPS/.test(src), 'đã bỏ cheat chạm 30 lần');
}
for (const [, k] of UNLOCKS) if (k !== 'u10') used.add(k);
for (const k of ['shop.btn.sub', 'shop.btn.up', 'shop.btn.down']) used.add(k);
// khoá ghép động (t('color.' + x)…) hoặc tuỳ chọn có sẵn từ trước (bar.play có kiểm tra thiếu khoá)
const dynamic = /^(t\.|ph\.|lang\.|rank\.|snd\.[td]\.|color\.|face\.|help\.keys\.|bar\.play$)/;
for (const k of used) {
  if (dynamic.test(k)) continue;
  for (const l of langs) ok(k in dict[l], `thiếu khoá "${k}" trong ${l}.json`);
}
const keySets = langs.map((l) => Object.keys(dict[l]).sort().join('|'));
ok(keySets.every((x) => x === keySets[0]), 'các ngôn ngữ có cùng tập khoá');
for (const l of langs) {
  for (const old of ['lv.u15', 'lv.u20', 'lv.u21', 'lv.u22', 'lv.u23']) ok(!(old in dict[l]), `khoá cũ ${old} còn trong ${l}.json`);
  ok(dict[l]['lv.rule'].includes('{n}'), `lv.rule của ${l} thiếu {n}`);
  for (const k of ['shop.f.rate', 'shop.f.first', 'shop.f.monthly', 'shop.bonus.first', 'shop.bonus.month', 'shop.ok.pack', 'shop.packname']) ok(/\{[ne]\}/.test(dict[l][k]), `${k} của ${l} thiếu tham số`);
  ok(dict[l]['shop.plan'].includes('{n}'), `shop.plan của ${l} thiếu {n}`);
  ok(dict[l]['shop.current'].includes('{p}') && dict[l]['shop.ok.sub'].includes('{p}'), `shop.current/ok.sub của ${l} thiếu {p}`);
  for (const k of ['shop.btn.sub', 'shop.btn.up', 'shop.btn.down']) ok(dict[l][k].includes('{p}'), `${k} của ${l} thiếu {p}`);
}

// ---- giữ exp / cấp khi cập nhật hoặc đổi công thức (chạy trong tiến trình con để mỗi lần có localStorage riêng)
import { spawnSync } from 'node:child_process';
const probe = (saved) => {
  const code = `
    const store = new Map(Object.entries(${JSON.stringify(saved)}));
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    const m = await import('${path.resolve('www/js/progress.js').replace(/\\/g, '/')}');
    console.log(JSON.stringify({ exp: m.progress.exp, level: m.progress.level, saved: JSON.parse(store.get('rubik_studio_progress') || 'null') }));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const legacy = (exp) => ({ rubik_studio_progress: JSON.stringify({ exp, celebrated: false }) });   // định dạng bản cũ: không có v / lv
let g = probe(legacy(300));                                   // cũ: 300 exp = Lv 9 (2^8=256 ≤ 300)
eq(g.level, 9, 'dữ liệu cũ 300 exp vẫn giữ Lv 9 (công thức mới sẽ cho Lv 1)'); eq(g.exp, levelExp(9), 'exp được nâng lên đúng mốc Lv 9');
eq(g.saved.v, 2, 'ghi lại định dạng mới'); eq(g.saved.lv, 9, 'lưu cấp đã đạt');
g = probe(legacy(0)); eq(g.level, 1, 'người mới: Lv 1'); eq(g.exp, 0, 'người mới: 0 exp');
g = probe(legacy(100000000)); eq(g.level, 27, 'dữ liệu cũ 100 triệu exp (Lv 27 theo công thức cũ) không bị hạ cấp'); ok(g.exp >= 100000000, 'exp không bao giờ bị giảm');
g = probe({ rubik_studio_progress: JSON.stringify({ v: 2, exp: 1000, lv: 5, celebrated: false }) });
eq(g.level, 5, 'đã lưu Lv 5 mà công thức mới tính thấp hơn → vẫn giữ Lv 5'); eq(g.exp, levelExp(5), 'exp nâng lên mốc Lv 5');
g = probe({ rubik_studio_progress: JSON.stringify({ v: 2, exp: 9000, lv: 10, celebrated: false }) });
eq(g.exp, 9000, 'exp đã cao hơn mốc cấp đã lưu: giữ nguyên'); eq(g.level, levelOf(9000), 'cấp theo công thức hiện hành');
g = probe({ rubik_studio_progress: '{hỏng', rubik_studio_progress_bak: JSON.stringify({ v: 2, exp: 7000, lv: 11 }) });
eq(g.exp, 7000, 'khoá chính hỏng → khôi phục từ bản sao dự phòng');

console.log(fail ? `\nTHẤT BẠI: ${fail}/${total}` : `\nTẤT CẢ ĐẠT: ${total} kiểm tra (cấp độ · mở khoá · gói · dịch)`);
process.exit(fail ? 1 : 0);
