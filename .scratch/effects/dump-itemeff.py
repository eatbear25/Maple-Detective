import os, sys, json
import UnityPy
sys.path.insert(0, "tools")
from wzjs import decode as wzjs_decode
AA = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
B = "json_6baa5b91985050c8f406de48a83cad30.bundle"
env = UnityPy.load(os.path.join(AA,B))
readers = {r.path_id: r for r in env.objects}
for cpath, pptr in env.container.items():
    if not cpath.endswith(".wzjson"): continue
    name = cpath.split("/")[-1]
    _, tree = wzjs_decode(bytes(readers[pptr.path_id].get_raw_data()))
    keys = list(tree.keys())
    print(f"=== {name}: {len(keys)} top keys :: {keys[:15]}")
    if name in ("ItemEff.wzjson",):
        json.dump(tree, open(".scratch/effects/ItemEff.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
    if name in ("CharacterEff.wzjson","BasicEff.wzjson","SetEff.wzjson","PetEff.wzjson"):
        json.dump(tree, open(f".scratch/effects/{name[:-7]}.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
