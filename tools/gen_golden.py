"""Sinh dữ liệu đối chiếu từ bản Python gốc (core/) để kiểm tra engine JS.
Chạy:  python tools/gen_golden.py <thư_mục_rubik_tool> <file_ra.json>"""
import hashlib, json, sys, os
src, out = sys.argv[1], sys.argv[2]
sys.path.insert(0, src)
import numpy as np
from core.registry import PUZZLES, get_puzzle

def h(s): return hashlib.sha1(s.encode()).hexdigest()[:16]
def sig(p):
    return h(";".join(",".join(map(str, r)) for r in p.signature()))

res = {"geom": {}, "algs": {}}
for key, _, _ in PUZZLES:
    p = get_puzzle(key)
    res["geom"][key] = {"P": p.P, "nV": len(p.V0), "nF": len(p.f_start), "nS": len(p.st_idx),
                        "radius": p.radius, "sumV": float(p.V0.sum()), "sumAbs": float(np.abs(p.V0).sum()),
                        "colors": h(",".join(map(str, p.f_color.tolist())))}
    items = []
    with open(os.path.join(src, "data/algs", key + ".json"), encoding="utf-8") as f:
        d = json.load(f)
    for lid, cats in d["levels"].items():
        for c in cats:
            for cs in c["cases"]:
                setup = cs.get("setup")
                for a in cs["algs"]:
                    q = get_puzzle(key)
                    q.apply_alg(a)
                    s1 = sig(q)
                    q2 = get_puzzle(key)
                    st = setup or q2.invert_alg(a)
                    q2.apply_alg(st)
                    s2 = sig(q2)
                    q2.apply_alg(a)
                    items.append([a, setup or "", p.invert_alg(a), s1, s2, bool(q2.is_solved()), sig(q2)])
    res["algs"][key] = items
json.dump(res, open(out, "w"))
print({k: len(v) for k, v in res["algs"].items()})
