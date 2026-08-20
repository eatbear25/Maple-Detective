"""把點裝清單 join 成網站用的時裝 catalog。

用法：
    python tools/extract-cash-items.py   # 先跑這兩個
    python tools/extract-effects.py
    python tools/build-fashion-data.py

輸入 reference-data/cash-items.json + effects.json + name-tables/Item.json
（+ name-supplement 補漏）
輸出 src/data/generated/fashion-catalog.json：
    { "meta": {...},
      "items":   [ { "i": id, "n": 名稱, "s": 部位, "g": 性別 }, ... ],
      "effects": [ { "i": id, "n": 名稱, "k": 類型, "z": 前後,
                     "t": 跟隨隊列, "zo": z 例外 }, ... ] }

不輸出商城「現售」旗標：Commodity.json 快照跟實際商城對不上（2026-08-16 確認
不準），網站只承諾「客戶端有的點裝」，不承諾商城買不買得到。

欄位縮寫是為了體積：5000 多筆若用完整鍵名會多出快一倍。

不收戒指：經典版紙娃娃根本不畫戒指（抽樣 14 件戒指打 maplestory.io，
frameBooks 命中 0/14），列進去只會讓使用者點了發現沒反應。

性別 g：0=男限 1=女限 2=共用 -1=不明。判定規則見 extract-cash-items.py，
延伸髮型臉型（4xxxx/5xxxx）推不出來，前端要有第三種顯示狀態。

特效沒有部位也沒有性別限制（誰都能開），所以不混進 items，另放一個陣列。
欄位語意見 extract-effects.py。
"""

import json
import os
from datetime import datetime, timezone, timedelta

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "fashion-catalog.json")

# 紙娃娃畫不出來的部位，不進 catalog
EXCLUDE_SLOTS = {"ring"}


def load(path, default=None):
    if not os.path.exists(path):
        if default is None:
            raise SystemExit(f"缺少 {path}")
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    cash = load(os.path.join(REF, "cash-items.json"))["items"]
    effects_raw = load(os.path.join(REF, "effects.json"))["effects"]
    names = load(os.path.join(REF, "name-tables", "Item.json"))
    supp = load(os.path.join(REF, "name-supplement.json"), {})
    supp_names = supp.get("items", supp) if isinstance(supp, dict) else {}

    def name_of(item_id: str) -> str:
        entry = names.get(item_id)
        if isinstance(entry, dict) and entry.get("name"):
            return entry["name"]
        alt = supp_names.get(item_id)
        if isinstance(alt, dict):
            return alt.get("name") or f"#{item_id}"
        if isinstance(alt, str):
            return alt
        return f"#{item_id}"

    items = []
    unnamed = 0
    for item_id, entry in cash.items():
        slot = entry["slot"]
        if slot in EXCLUDE_SLOTS:
            continue
        name = name_of(item_id)
        if name.startswith("#"):
            unnamed += 1
        row = {"i": int(item_id), "n": name, "s": slot, "g": entry.get("gender", -1)}
        items.append(row)

    items.sort(key=lambda r: (r["s"], r["i"]))

    effects = []
    for effect_id, entry in sorted(effects_raw.items(), key=lambda kv: int(kv[0])):
        row = {"i": int(effect_id), "n": name_of(effect_id), "k": entry["kind"], "z": entry["z"]}
        if entry.get("trail"):
            row["t"] = entry["trail"]
        if entry.get("zOverride"):
            row["zo"] = entry["zOverride"]
        effects.append(row)

    by_slot = {}
    for r in items:
        by_slot[r["s"]] = by_slot.get(r["s"], 0) + 1
    print(f"時裝 catalog：{len(items)} 件（無中文名 {unnamed} 件）＋特效 {len(effects)} 件")
    print("部位分布：", dict(sorted(by_slot.items(), key=lambda kv: -kv[1])))
    print("性別不明：", sum(1 for r in items if r["g"] == -1))

    out = {
        "meta": {
            "source": "reference-data/cash-items.json + effects.json + name-tables/Item.json",
            "builtAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "items": len(items),
            "effects": len(effects),
        },
        "items": items,
        "effects": effects,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"已寫入 {OUT_PATH}（{os.path.getsize(OUT_PATH) // 1024} KB）")


if __name__ == "__main__":
    main()
