import os, sys, json
import UnityPy
sys.path.insert(0, "tools")
from wzjs import decode as wzjs_decode
AA = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
B = "json_4f0192b4db49dca312b7c5d0d6d30555.bundle"
env = UnityPy.load(os.path.join(AA,B))
readers = {r.path_id: r for r in env.objects}
for cpath in sorted(env.container):
    print(cpath)
print("---- 0501 ----")
for cpath, pptr in env.container.items():
    if cpath.endswith("Cash/0501.wzjson"):
        _, tree = wzjs_decode(bytes(readers[pptr.path_id].get_raw_data()))
        json.dump(tree, open(".scratch/effects/Cash0501.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
        print("keys:", len(tree), list(tree)[:20])
        print(json.dumps(tree.get("05010024"), ensure_ascii=False)[:2000])
