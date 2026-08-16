"""從楓之谷經典版客戶端抽取「點裝」清單，並存下當期商城上架快照。

用法：
    pip install UnityPy
    python tools/extract-cash-items.py

輸出兩份：
  1. reference-data/cash-items.json
        { "meta": {...}, "items": { "<itemId>": {
              slot,        # 部位（取自 container 子目錄，不是猜 ID 前綴）
              islot, vslot,# 穿戴欄位 / 遮蔽碼（renderer 要）
              gender,      # 0=男限 1=女限 2=共用 -1=不明
              onSale       # 只有當期商城有上架才會出現（=1）
          } } }
  2. reference-data/commodity-history/<YYYY-MM-DD>.json
        當期 Etc/TW/Commodity.json 的完整快照。

為什麼要存快照：Commodity.json 是「商城此刻賣什麼」的即時清單，沒有任何日期
欄位（994 筆全部沒有 TermStart/TermEnd）。商城換檔後，下架的時裝會從檔案裡
完全消失，混回「分不出是絕版還是台服從沒實裝」的那堆裡。累積多期快照取聯集，
是唯一能長出「曾經上架過」清單的辦法——今天不存，之後永遠補不回來。

部位判定：用 container path 的子目錄（Assets/WzAssets/Json/Character/<子類>/），
不要用 ID 前綴猜——ID 前綴規則對 4xxxx/5xxxx 段的延伸髮型臉型會漏掉兩百多件。

性別判定：客戶端沒有直接欄位（Commodity 的 Gender 描述的是「誰可以購買」，
994 筆裡 980 筆都是 2，對穿著無意義），只能靠 ID 慣例：
  7 碼裝備 → 第 4 碼：0=男 1=女 2=共用
  5 碼髮型/臉型 → 第 2 碼：0=男 1=女（由 Etc/MakeCharInfo.json 的男女預設值反推）
4xxxx/5xxxx 延伸段沿用同規則，未經逐件驗證，故另記 genderGuess 供日後查核。

遊戲更新後重跑即可（用 container path 掃描定位，不依賴 bundle 檔名）。
"""

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

import UnityPy

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "reference-data", "cash-items.json")
SNAP_DIR = os.path.join(PROJECT, "reference-data", "commodity-history")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402

CHAR_RE = re.compile(r"/Json/Character/([^/]+)/(\d{8})\.wzjson$")
COMMODITY_PATH = "Assets/WzAssets/Json/Etc/TW/Commodity.json"

# container 子目錄 → 網站用的部位代號。列在這裡的才收；
# PetEquip / TamingMob / Dragon / Afterimage 蓄意不收（不是時裝）。
SLOTS = {
    "Cap": "cap",
    "Coat": "coat",
    "Longcoat": "longcoat",
    "Pants": "pants",
    "Shoes": "shoes",
    "Glove": "glove",
    "Cape": "cape",
    "Shield": "shield",
    "Accessory": "accessory",
    "Ring": "ring",
    "Hair": "hair",
    "Face": "face",
    "Weapon": "weapon",
}


def guess_gender(item_id: int) -> int:
    """0=男限 1=女限 2=共用 -1=不明。見模組 docstring 的慣例說明。"""
    s = str(item_id)
    digit = s[3] if len(s) == 7 else (s[1] if len(s) == 5 else None)
    if digit == "0":
        return 0
    if digit == "1":
        return 1
    if digit == "2" and len(s) == 7:
        return 2
    return -1


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


def snapshot_commodity():
    """存下當期商城上架表，回傳 {itemId: 上架筆數} 供標記 onSale。"""
    fname, env = scan_bundles(lambda p: p == COMMODITY_PATH)
    readers = {r.path_id: r for r in env.objects}
    script = readers[env.container[COMMODITY_PATH].path_id].read().m_Script
    table = json.loads(str(script).lstrip("\ufeff"))

    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
    os.makedirs(SNAP_DIR, exist_ok=True)
    snap_path = os.path.join(SNAP_DIR, f"{today}.json")
    with open(snap_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {"source": f"{fname} -> {COMMODITY_PATH}", "capturedAt": today, "rows": len(table)},
                "commodity": table,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )

    on_sale = {}
    for row in table.values():
        item_id = row.get("ItemId")
        if isinstance(item_id, int):
            on_sale[item_id] = on_sale.get(item_id, 0) + 1
    print(f"商城快照：{fname} -> {snap_path}（{len(table)} 筆上架，去重 {len(on_sale)} 個道具）")
    return on_sale


def main():
    on_sale = snapshot_commodity()

    fname, env = scan_bundles(lambda p: CHAR_RE.search(p) is not None)
    readers = {r.path_id: r for r in env.objects}
    items = {}
    skipped_slot = {}
    non_cash = 0
    for cpath, pptr in env.container.items():
        m = CHAR_RE.search(cpath)
        if not m:
            continue
        sub, raw_id = m.group(1), m.group(2)
        slot = SLOTS.get(sub)
        if slot is None:
            skipped_slot[sub] = skipped_slot.get(sub, 0) + 1
            continue
        _, tree = wzjs_decode(bytes(readers[pptr.path_id].get_raw_data()))
        info = tree.get("info")
        if not isinstance(info, dict) or not info.get("cash"):
            non_cash += 1
            continue
        item_id = int(raw_id)
        entry = {
            "slot": slot,
            "islot": info.get("islot", ""),
            "vslot": info.get("vslot", ""),
            "gender": guess_gender(item_id),
        }
        if item_id in on_sale:
            entry["onSale"] = 1
        items[str(item_id)] = entry

    print(f"Character 包 = {fname}：點裝 {len(items)} 件（非 cash 略過 {non_cash}）")
    print(f"不收的子類：{skipped_slot}")

    by_slot = {}
    for e in items.values():
        by_slot[e["slot"]] = by_slot.get(e["slot"], 0) + 1
    print("部位分布：", dict(sorted(by_slot.items(), key=lambda kv: -kv[1])))
    print("現售：", sum(1 for e in items.values() if e.get("onSale")))
    print("性別不明：", sum(1 for e in items.values() if e["gender"] == -1))

    # 抽樣驗證（已知值：1000000 帽子 islot=Cp 遮蔽 CpH1H5；30000 髮型 islot=Hr）
    cap = items.get("1000000", {})
    assert cap.get("islot") == "Cp" and cap.get("vslot") == "CpH1H5", f"帽子欄位異常: {cap}"
    assert items.get("30000", {}).get("islot") == "Hr", "髮型欄位異常"
    print("抽樣：1000000 =", cap)

    out = {
        "meta": {
            "source": f"{fname} -> Assets/WzAssets/Json/Character/*/*.wzjson (info.cash=1)",
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "items": len(items),
            "onSale": sum(1 for e in items.values() if e.get("onSale")),
        },
        "items": dict(sorted(items.items(), key=lambda kv: int(kv[0]))),
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("已寫入", OUT_PATH)


if __name__ == "__main__":
    sys.exit(main())
