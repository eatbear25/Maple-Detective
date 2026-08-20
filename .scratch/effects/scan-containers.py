import os, sys, json, collections
import UnityPy
AA = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
out = {}
files = sorted((f for f in os.listdir(AA) if f.startswith("json_") and f.endswith(".bundle")),
               key=lambda f: os.path.getsize(os.path.join(AA,f)))
for f in files:
    size = os.path.getsize(os.path.join(AA,f))
    if size > 20*1024*1024:  # 大包另外處理
        continue
    env = UnityPy.load(os.path.join(AA,f))
    c = collections.Counter()
    for p in env.container:
        parts = p.split("/")
        c["/".join(parts[:5])] += 1
    out[f] = {"size": size, "prefixes": dict(c.most_common(30))}
    print(f, size)
    for k,v in c.most_common(30):
        print("   ", v, k)
json.dump(out, open(".scratch/effects/containers-small.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
