"""從客戶端抽取「點裝特效」清單（時裝搭配的特效分頁用）。

用法：
    pip install UnityPy
    python tools/extract-effects.py

輸出 reference-data/effects.json：
    { "meta": {...}, "effects": { "<itemId>": {
          kind,       # follow=跟在身後的隊列 / action=依動作換圖 / simple=單一循環
          z,          # 多數 book 的 z：負數畫在角色後方、正數畫在前方
          zOverride,  # 少數 book 的 z 不同時才有（例：翅膀爬梯時改畫在身前）
          trail,      # kind=follow 才有：每一隻落後角色幾 px（loose）
          books,      # 客戶端有哪些 book（動作名或 default），只作對照用
          frames,     # 代表幀數（給 UI 顯示，實際幀由 maplestory.io 決定）
          fixed,      # 客戶端有 fixed 旗標（語意未確認，renderer 目前沒用）
      } } }

**圖不在這裡**：跟時裝一樣執行期向 maplestory.io 抓（`effect.framebooks`）。
逐幀比對過客戶端與 maplestory.io 的 origin，完全一致，所以借圖不會跑位。
客戶端的圖鎖在 .wzspritesheet 裡（圖集矩形順序解不出來，見 tools/wzsheet.py）。

只有客戶端知道、maplestory.io 給不了的是：**有哪些特效**（46 件）、**z**（畫在
角色前面還是後面）、以及 **loose**（跟隨隊列每一隻落後多少 px）——沒有 loose，
玩具小鴨家族那類特效會五隻疊在同一點。

註：canvas 節點的 origin/delay 也在客戶端（要 wzjs.decode(expand_canvas=True)
才讀得到），但既然跟 maplestory.io 一致、渲染時本來就會拿到，這裡不重複存。

遊戲更新後重跑即可（用 container path 掃描定位，不依賴 bundle 檔名）。
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta

import UnityPy

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "reference-data", "effects.json")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402

# 0501 = 特效道具（0500 是寵物、0502 之後是其他點裝類別）
EFFECT_PATH = "Assets/WzAssets/Json/Item/Cash/0501.wzjson"


def scan_bundles(needle):
    """掃 json_*.bundle 找 container path 命中 needle 的那包（檔名 hash 每次更新會變）。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        if any(needle(p) for p in env.container):
            return fname, env
    raise SystemExit(f"在 {AA_W} 的 json_*.bundle 裡找不到目標 container")


def parse_effect(node: dict) -> dict | None:
    """把一件道具的 effect 節點正規化。回傳 None 代表沒有可畫的圖。"""
    top_flags = {k: v for k, v in node.items() if not isinstance(v, dict)}
    books = {k: v for k, v in node.items() if isinstance(v, dict)}

    # book 底下的數字子節點＝幀；其餘（z/pos/loose/fixed）是旗標
    def frames_of(book: dict) -> int:
        return sum(1 for k in book if k.isdigit())

    numeric_books = sorted((k for k in books if k.isdigit()), key=int)
    if top_flags.get("follow") and numeric_books:
        # 跟隨隊列：每個數字 book 是隊列裡的一隻，loose = 落後幾 px
        subs = [books[k] for k in numeric_books]
        entry = {
            "kind": "follow",
            "z": subs[0].get("z", -1),
            "trail": [s.get("loose", 0) for s in subs],
            "books": numeric_books,
            "frames": max(frames_of(s) for s in subs),
        }
    else:
        named = {k: v for k, v in books.items() if frames_of(v) > 0}
        if not named:
            return None
        # 多數 book 的 z 當代表值，少數不同的另外記
        counts: dict[int, int] = {}
        for book in named.values():
            z = book.get("z", -1)
            counts[z] = counts.get(z, 0) + 1
        main_z = max(counts, key=lambda z: counts[z])
        override = {k: v["z"] for k, v in named.items() if v.get("z", -1) != main_z}
        entry = {
            "kind": "action" if top_flags.get("action") else "simple",
            "z": main_z,
            "books": sorted(named),
            "frames": frames_of(named.get("default") or next(iter(named.values()))),
        }
        if override:
            entry["zOverride"] = override

    if any(b.get("fixed") for b in books.values()):
        entry["fixed"] = 1
    return entry


def main():
    fname, env = scan_bundles(lambda p: p == EFFECT_PATH)
    readers = {r.path_id: r for r in env.objects}
    raw = bytes(readers[env.container[EFFECT_PATH].path_id].get_raw_data())
    _, tree = wzjs_decode(raw, expand_canvas=True)

    effects = {}
    skipped = []
    for raw_id, item in sorted(tree.items()):
        node = item.get("effect") if isinstance(item, dict) else None
        if not isinstance(node, dict):
            skipped.append((raw_id, "沒有 effect 節點"))
            continue
        entry = parse_effect(node)
        if entry is None:
            skipped.append((raw_id, "沒有任何幀"))
            continue
        effects[str(int(raw_id))] = entry

    by_kind = {}
    for e in effects.values():
        by_kind[e["kind"]] = by_kind.get(e["kind"], 0) + 1
    print(f"特效包 = {fname}：{len(effects)} 件（{by_kind}）")
    print("略過：", skipped)

    # 抽樣驗證（已知值：玩具小鴨家族 5 隻、落後 10/27/45/66/87 px、畫在角色後方）
    duck = effects.get("5010024", {})
    assert duck.get("trail") == [10, 27, 45, 66, 87], f"玩具小鴨家族的隊列異常：{duck}"
    assert duck.get("z") == -1, f"玩具小鴨家族應該畫在角色後方：{duck}"
    # 天使羽翼：129 個動作 book，爬梯／爬繩／趴下改畫在身前
    wings = effects.get("5010068", {})
    assert wings.get("kind") == "action" and wings.get("z") == -1, f"天使羽翼異常：{wings}"
    assert set(wings.get("zOverride", {})) == {
        "ladder",
        "ladder2",
        "rope",
        "rope2",
        "prone",
        "proneStab",
    }, f"天使羽翼的 z 例外異常：{wings.get('zOverride')}"
    print("抽樣：5010024 =", duck)

    out = {
        "meta": {
            "source": f"{fname} -> {EFFECT_PATH}",
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "effects": len(effects),
        },
        "effects": effects,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("已寫入", OUT_PATH)


if __name__ == "__main__":
    sys.exit(main())
