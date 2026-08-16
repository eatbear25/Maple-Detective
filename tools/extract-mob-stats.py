"""從楓之谷經典版客戶端抽取全部怪物數值（Mob/*.wzjson 的 info 節點）。

用法：
    pip install UnityPy
    python tools/extract-mob-stats.py

輸出 reference-data/mob-stats.json，結構：
    { "meta": {...}, "mobs": { "<mobId>": { level, maxHP, maxMP, exp,
        PADamage, MADamage, PDDamage, MDDamage, acc, eva, speed, boss, undead, ... } } }

原理同 extract-monster-book.py：Mob 包（掃描時是 json_27ed12...，4MB、1232 檔）
的 container path 是 Assets/WzAssets/Json/Mob/<7碼補零ID>.wzjson，
raw bytes 直接用 wzjs.decode 解，取 info 子樹的純量欄位（略過 null/巢狀）。
遊戲更新後重跑即可（用 container path 掃描定位，不依賴 bundle 檔名）。
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta

import UnityPy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "reference-data", "mob-stats.json")

MOB_DIR = "/Json/Mob/"


def find_mob_bundle():
    """掃 json_*.bundle 找 container path 含 /Json/Mob/ 的那包（檔名 hash 會變，不能寫死）。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        if any(MOB_DIR in p for p in env.container):
            return fname, env
    raise SystemExit(f"在 {AA_W} 的 json_*.bundle 裡找不到 {MOB_DIR}")


def main():
    fname, env = find_mob_bundle()
    readers = {r.path_id: r for r in env.objects}
    mobs = {}
    skipped = []
    for cpath, pptr in env.container.items():
        if MOB_DIR not in cpath or not cpath.endswith(".wzjson"):
            continue
        root_name, tree = wzjs_decode(bytes(readers[pptr.path_id].get_raw_data()))
        mob_id = str(int(root_name))  # 7 碼補零 → 純數字
        info = tree.get("info")
        if not isinstance(info, dict):
            skipped.append(mob_id)
            continue
        # 只留純量（int/str），略過 null（fs 之類）與巢狀（ban/skill/...）
        mobs[mob_id] = {k: v for k, v in info.items() if isinstance(v, (int, str))}

    print(f"Mob 包 = {fname}，共 {len(mobs)} 隻（無 info 節點 {len(skipped)}：{skipped[:5]}）")
    sample = mobs.get("100100", {})
    assert sample.get("level") == 1 and sample.get("maxHP") == 8, "嫩寶數值異常，抽取結果可疑"
    print("抽樣：嫩寶 =", {k: sample[k] for k in ("level", "maxHP", "exp", "acc") if k in sample})

    out = {
        "meta": {
            "source": f"{fname} -> Assets/WzAssets/Json/Mob/*.wzjson (info 節點)",
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "mobs": len(mobs),
        },
        "mobs": mobs,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("已寫入", OUT_PATH)


if __name__ == "__main__":
    sys.exit(main())
