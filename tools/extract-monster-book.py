"""從楓之谷經典版客戶端抽取 MonsterBook（怪物掉落物 + 出沒地圖）。

用法：
    pip install UnityPy
    python tools/extract-monster-book.py

輸出 reference-data/monster-book.json，結構：
    { "meta": {...}, "mobs": { "<mobId>": { "maps": [mapId...], "rewards": [itemId...] } } }

原理：客戶端把舊 wz 轉出的 json（*.wzjson）序列化成自訂二進位（WZJS 版本 5，
    版面見 tools/wzjs.py）塞進 MonoBehaviour。IL2CPP 欄位名雖被 SHA256 混淆，
    但資產的 container path（Assets/WzAssets/Json/...）和資料本身都沒混淆。
    樹狀結構即舊 wz 的 MonsterBook.img：
    MonsterBook → <mobId> → { episode(字串), map → [mapId...], reward → [itemId...] }
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
OUT_PATH = os.path.join(PROJECT, "reference-data", "monster-book.json")
NAME_TABLES = os.path.join(PROJECT, "reference-data", "name-tables")

TARGET = "/MonsterBook.wzjson"


def find_monsterbook():
    """掃描 json_*.bundle 找 MonsterBook.wzjson（hash 檔名每次更新都變，不能寫死）。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),  # 小的先掃，目標包目前 <1MB
    )
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        for cpath, pptr in env.container.items():
            if cpath.endswith(TARGET):
                for reader in env.objects:
                    if reader.path_id == pptr.path_id:
                        return fname, bytes(reader.get_raw_data())
    raise SystemExit(f"在 {AA_W} 的 json_*.bundle 裡找不到 {TARGET}")


def decode(raw):
    root_name, tree = wzjs_decode(raw)
    assert root_name == "MonsterBook", f"根節點異常: {root_name}"
    mobs = {}
    for mob_id, entry in tree.items():
        mobs[mob_id] = {
            "maps": list(entry.get("map", {}).values()),
            "rewards": list(entry.get("reward", {}).values()),
        }
    return mobs


def validate(mobs):
    with open(os.path.join(NAME_TABLES, "Mob.json"), encoding="utf-8") as f:
        mob_names = json.load(f)
    with open(os.path.join(NAME_TABLES, "Item.json"), encoding="utf-8") as f:
        item_names = json.load(f)

    known_mobs = sum(1 for k in mobs if k in mob_names)
    reward_ids = {str(i) for v in mobs.values() for i in v["rewards"]}
    known_items = sum(1 for i in reward_ids if i in item_names)
    rows = sum(len(v["rewards"]) for v in mobs.values())

    print(f"怪物 {len(mobs)} 隻（{known_mobs} 隻在 Mob.json 有名字）")
    print(f"掉落 {rows} 筆，不重複道具 {len(reward_ids)} 種（{known_items} 種在 Item.json 有名字）")
    assert known_mobs / len(mobs) > 0.9, "怪物 ID 與名稱表對不上，抽取結果可疑"

    snail = mobs.get("100100")
    assert snail and 4000019 in snail["rewards"], "嫩寶沒掉嫩寶殼，抽取結果可疑"
    print("抽樣：嫩寶掉落 =", [item_names.get(str(i), {}).get("name", f"?{i}") for i in snail["rewards"]])


def main():
    bundle, raw = find_monsterbook()
    print(f"MonsterBook.wzjson 位於 {bundle}（{len(raw)} bytes）")
    mobs = decode(raw)
    validate(mobs)
    out = {
        "meta": {
            "source": f"{bundle} -> Assets/WzAssets/Json/MonsterBook.wzjson",
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "mobs": len(mobs),
            "rewardRows": sum(len(v["rewards"]) for v in mobs.values()),
        },
        "mobs": mobs,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("已寫入", OUT_PATH)


if __name__ == "__main__":
    sys.exit(main())
