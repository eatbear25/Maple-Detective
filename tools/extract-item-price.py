"""從客戶端抽取消耗／其他／裝飾類道具「賣給商店的價錢」（道具彈窗與道具頁用）。

用法：
    pip install UnityPy
    python tools/extract-item-price.py

輸出 reference-data/item-price.json：
    { "meta": {...}, "items": { "<itemId>": { price?, notSale? } } }
    price   = 賣給 NPC 商店拿到的楓幣（1 個的價錢；0 或沒寫的不收）
    notSale = 1 代表不能賣給商店（客戶端 info.notSale）
兩者都沒有的道具不收。裝備的賣價在 Character/ 包，由 extract-equip-info.py 一起抽。

原理：Item/<類別>/<4 碼前綴>.wzjson 是舊 wz 的 Item.wz img，每個道具底下的
info 節點就是舊 wz 的 info（price、slotMax、notSale…）。2026-11-08 掃的時候
消耗 2125 件裡 1663 件有 price、其他 1966 件裡 1926 件有。
飛鏢／子彈（207、233 開頭）另有 unitPrice（重新填充的單價），賣掉一整組
拿到的是 price，所以這裡只留 price。

遊戲更新後重跑即可（用 container path 掃描定位，不依賴 bundle 檔名）。
"""

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

import UnityPy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "reference-data", "item-price.json")

# Cash（點數商品）不能賣給商店、Pet 是寵物，都不收
PATH_RE = re.compile(r"/Json/Item/(Consume|Etc|Install|Special)/\d{4}\.wzjson$")


def main():
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )
    items = {}
    src_bundles = []
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        hits = [(c, p) for c, p in env.container.items() if PATH_RE.search(c)]
        if not hits:
            continue
        readers = {r.path_id: r for r in env.objects}
        for _, pptr in hits:
            _, tree = decode(bytes(readers[pptr.path_id].get_raw_data()))
            for raw_id, node in tree.items():
                info = node.get("info") if isinstance(node, dict) else None
                if not isinstance(info, dict):
                    continue
                entry = {}
                price = info.get("price")
                if isinstance(price, int) and price > 0:
                    entry["price"] = price
                if info.get("notSale"):
                    entry["notSale"] = 1
                if entry:
                    items[str(int(raw_id))] = entry
        print(f"{fname}: {len(hits)} 個 img")
        src_bundles.append(fname)

    if not items:
        raise SystemExit(f"在 {AA_W} 找不到任何 Item/ 道具資料")

    # 抽樣驗證（舊 wz 已知數值：紅色藥水 25）
    assert items["2000000"].get("price") == 25, f"紅色藥水賣價異常: {items['2000000']}"
    print("抽樣：紅色藥水 =", items["2000000"], "／嫩寶殼 =", items.get("4000019"))

    out = {
        "meta": {
            "source": [f"{b} -> Assets/WzAssets/Json/Item/" for b in src_bundles],
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "items": len(items),
        },
        "items": dict(sorted(items.items(), key=lambda kv: int(kv[0]))),
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"已寫入 {OUT_PATH}（{len(items)} 件，{os.path.getsize(OUT_PATH) // 1024} KB）")


if __name__ == "__main__":
    main()
