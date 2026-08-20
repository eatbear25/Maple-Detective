"""看各包裡 type=14 vector 池到底是 int32 還是 float32。"""
import os, sys, struct, collections
import UnityPy
AA = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
def probe(bundle, needle, limit=3):
    env = UnityPy.load(os.path.join(AA, bundle))
    readers = {r.path_id: r for r in env.objects}
    n=0
    for cpath, pptr in env.container.items():
        if needle not in cpath: continue
        raw = bytes(readers[pptr.path_id].get_raw_data())
        wz = raw.find(b"WZJS")
        if wz == -1: continue
        h = struct.unpack_from("<36I", raw, wz-144)
        if not h[16]:
            print(f"  {cpath}: 無 vector"); continue
        a = wz + h[17]
        vi = struct.unpack_from(f"<{min(h[16],4)*2}i", raw, a)
        vf = struct.unpack_from(f"<{min(h[16],4)*2}f", raw, a)
        print(f"  {cpath}: {h[16]} 筆  int={vi[:6]}  float={tuple(round(x,2) for x in vf[:6])}")
        n+=1
        if n>=limit: break
print("Character（裝備）:"); probe("json_c32a59ee3c932de55e86771676afba45.bundle", "/Character/Cap/", 2)
print("Mob:"); probe("json_27ed12ab55c4464e7db01cade1a2e593.bundle", "/Mob/01001", 2)
print("Item/Cash:"); probe("json_4f0192b4db49dca312b7c5d0d6d30555.bundle", "Cash/0501", 1)
