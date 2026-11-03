// Đọc dữ liệu công thức (data/algs/<puzzle>.json)
const cache = {};
export async function loadPuzzleData(key) {
  if (key in cache) return cache[key];
  try {
    const r = await fetch(`data/algs/${key}.json`);
    cache[key] = r.ok ? await r.json() : null;
  } catch { cache[key] = null; }
  return cache[key];
}

export function moveCount(alg) {
  let n = 0;
  for (const t of alg.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean)) {
    if ('xyz'.includes(t[0]) || t === '/') { if (t === '/') n++; continue; }
    n++;
  }
  return n;
}
