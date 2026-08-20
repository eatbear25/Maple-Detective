"""從客戶端 WZJS 直接讀 canvas 節點的 origin/delay（現行解碼器會漏掉這層）。"""
import os, sys, struct
import UnityPy
AA = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
B = "json_4f0192b4db49dca312b7c5d0d6d30555.bundle"
env = UnityPy.load(os.path.join(AA,B))
readers = {r.path_id: r for r in env.objects}
raw = next(bytes(readers[p.path_id].get_raw_data()) for c,p in env.container.items() if c.endswith("Cash/0501.wzjson"))
wz = raw.find(b"WZJS"); h = struct.unpack_from("<36I", raw, wz-144); a=lambda o: wz+o
def strings(count,pool,tab):
    offs=struct.unpack_from(f"<{count+1}I",raw,tab)
    return [raw[pool+offs[i]:pool+offs[i+1]].decode("utf-8") for i in range(count)]
names=strings(h[26],a(h[27]),a(h[28]))
ints=struct.unpack_from(f"<{h[10]}i",raw,a(h[11])) if h[10] else ()
vecs_i=struct.unpack_from(f"<{h[16]*2}i",raw,a(h[17])) if h[16] else ()
vecs_f=struct.unpack_from(f"<{h[16]*2}f",raw,a(h[17])) if h[16] else ()
nodes=[struct.unpack_from("<8I",raw,a(h[1])+i*32) for i in range(h[0])]
def path_of(i):
    parts=[]
    while True:
        t,ni,vi,fi,cn,pa,*_=nodes[i]; parts.append(names[ni])
        if i==0: break
        i=pa
    return "/".join(reversed(parts))
target = sys.argv[1] if len(sys.argv)>1 else "05010068"
book = sys.argv[2] if len(sys.argv)>2 else "stand1"
pref = f"0501/{target}/effect/{book}/"
rows={}
for i,(t,ni,vi,fi,cn,pa,*_) in enumerate(nodes):
    p=path_of(i)
    if not p.startswith(pref): continue
    if names[ni]=="origin" and t==14:
        rows.setdefault(path_of(pa),{})['origin']=(vecs_f[vi*2],vecs_f[vi*2+1],vecs_i[vi*2],vecs_i[vi*2+1])
    if names[ni]=="delay" and t==6:
        rows.setdefault(path_of(pa),{})['delay']=ints[vi]
for k in sorted(rows, key=lambda s:(len(s),s)):
    print(k, rows[k])
