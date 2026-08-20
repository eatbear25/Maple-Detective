import os, sys, struct, json
import UnityPy
sys.path.insert(0,"tools")
AA = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
B = "json_4f0192b4db49dca312b7c5d0d6d30555.bundle"
env = UnityPy.load(os.path.join(AA,B))
readers = {r.path_id: r for r in env.objects}
raw = None
for cpath,pptr in env.container.items():
    if cpath.endswith("Cash/0501.wzjson"):
        raw = bytes(readers[pptr.path_id].get_raw_data())
wz = raw.find(b"WZJS")
h = struct.unpack_from("<36I", raw, wz-144)
def a(o): return wz+o
def strings(count,pool,tab):
    offs=struct.unpack_from(f"<{count+1}I",raw,tab)
    return [raw[pool+offs[i]:pool+offs[i+1]].decode("utf-8") for i in range(count)]
names=strings(h[26],a(h[27]),a(h[28]))
ints=struct.unpack_from(f"<{h[10]}i",raw,a(h[11])) if h[10] else ()
vecs=struct.unpack_from(f"<{h[16]*2}i",raw,a(h[17])) if h[16] else ()
svals=strings(h[32],a(h[33]),a(h[34]))
nodes=[struct.unpack_from("<8I",raw,a(h[1])+i*32) for i in range(h[0])]
# 找 05010024 節點
def path_of(i):
    parts=[]
    while True:
        t,ni,vi,fi,cn,pa,*_=nodes[i]
        parts.append(names[ni])
        if i==0: break
        i=pa
    return "/".join(reversed(parts))
for i,(t,ni,vi,fi,cn,pa,*_) in enumerate(nodes):
    p = path_of(i)
    if p.startswith("0501/05010024/effect/0/") or p=="0501/05010024/effect/0":
        val = ints[vi] if t==6 else (svals[vi] if t==11 else ([vecs[vi*2],vecs[vi*2+1]] if t==14 else None))
        print(f"type={t:2} child={cn} {p} = {val}")
