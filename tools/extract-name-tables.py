"""從客戶端重抽 ID → 中文名稱對照表（reference-data/name-tables/）。

用法：
    pip install UnityPy
    python tools/extract-name-tables.py              # 六份全部重抽
    python tools/extract-name-tables.py Item         # 只抽指定的
    python tools/extract-name-tables.py --check      # 只印差異，不寫檔

來源是 `Assets/WzAssets/Json/String/TW/<表名>.json`——未混淆的純 JSON TextAsset，
跟 ScriptString（NPC 對話）同一包。用 container path 掃描定位，不依賴 bundle 檔名
（檔名裡的 hash 每次更新都會變）。

遊戲出新內容（新點裝、新地圖、新怪）後這份要先重抽，其他 build-*.py 才查得到名字：
2026-10-13 重掃點裝時多了 2147 件，舊名稱表只認得其中 21 件。

**注意 Map.json / Mob.json 有名字與否是其他頁面的「實裝判斷」依據**（見
build-site-data.py、build-quest-data.py），重抽這兩份之後要連那幾條管線一起重跑，
不然 reference-data 會跑在 generated 前面。
"""

import json
import os
import sys

import UnityPy

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT, "reference-data", "name-tables")

BASE = "Assets/WzAssets/Json/String/TW/"
TABLES = ("Item", "Map", "Mob", "MonsterBook", "Npc", "Skill")


def find_bundle():
    """掃 json_*.bundle 找裝名稱表的那包（小的先掃，那包只有 2MB 左右）。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        if f"{BASE}Item.json" in env.container:
            return fname, env
    raise SystemExit(f"在 {AA_W} 的 json_*.bundle 裡找不到 {BASE}Item.json")


def read_table(env, readers, name):
    script = readers[env.container[f"{BASE}{name}.json"].path_id].read().m_Script
    # TextAsset 是 UTF-8；UnityPy 解不動的位元組會留成 surrogate，轉回去再解一次
    text = str(script).encode("utf-8", "surrogateescape").decode("utf-8")
    return json.loads(text.lstrip("\ufeff"))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_only = "--check" in sys.argv
    wanted = args or list(TABLES)
    unknown = [t for t in wanted if t not in TABLES]
    if unknown:
        raise SystemExit(f"不認得的表名：{unknown}（可用：{', '.join(TABLES)}）")

    fname, env = find_bundle()
    readers = {r.path_id: r for r in env.objects}
    print(f"名稱表包 = {fname}")

    for name in wanted:
        table = read_table(env, readers, name)
        out_path = os.path.join(OUT_DIR, f"{name}.json")
        old = {}
        if os.path.exists(out_path):
            with open(out_path, encoding="utf-8") as f:
                old = json.load(f)
        added = [k for k in table if k not in old]
        removed = [k for k in old if k not in table]
        changed = [k for k in table if k in old and table[k] != old[k]]
        print(
            f"{name}: {len(old)} → {len(table)} 筆"
            f"（新增 {len(added)}、移除 {len(removed)}、內容變更 {len(changed)}）"
        )
        if check_only:
            continue
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(table, f, ensure_ascii=False, indent=2)

    if check_only:
        print("（--check：沒有寫檔）")


if __name__ == "__main__":
    sys.exit(main())
