"""把神秘商人的機率表快照 join 成網站用的資料。

用法：
    python tools/fetch-gacha-odds.py <活動網址>   # 先跑這個（活動結束前）
    python tools/build-merchant-data.py
    python tools/download-icons.py                # 補抓新商品的圖示

輸入：
    reference-data/gacha-history/*.json        官方機率表快照，只取標題含「神秘商人」的
    reference-data/name-tables/Item.json       名稱 → itemId 反查
    reference-data/cash-items.json             哪些 ID 是點裝（同名撞 ID 時優先）
    reference-data/commodity-history/*.json    刷新券價格（取最新一份）
    reference-data/merchant-id-overrides.json  （選用）人工指定 itemId，{"道具名稱": itemId}
輸出：
    src/data/generated/merchant.json

## 神秘商人是什麼（2026-10-29 起取代轉蛋）

每一批貨架上 6 個商品，每 6 小時自動換一批、每天 1 次免費刷新，其他時候要用
「神秘商人刷新券」（5066103）立刻換一批。官方公布的機率是「每一格出現各商品的機率」
（261 筆加起來 100.06%，進位誤差）。上架的商品可能是免費、打折或原價，**售價與
免費／打折的機率都是伺服器決定的、官方沒公布**，所以網站只模擬「刷新幾次才看到」，
花費只算刷新券。

## 名稱 → itemId

官方表只給中文名稱。三個坑：

1. **Item.json 的名稱有尾巴空白**（「柴郡貓耳 」、「邪惡綿羊帽　」全形），比對前要 strip。
2. **「高效能喇叭*20」是道具＋數量**，拆成 name / qty。同一個道具會以不同數量出現好幾次
   （橙色藥丸*50 與 *100），所以前端一律用 `key`（在表裡的序號）當識別，不用 itemId。
3. **21 筆同名撞 ID**，判定順序：
   a. 只留點裝（在 cash-items.json，或 5xxxxxx 現金道具）——神秘商人賣的都是商城貨，
      青龍偃月刀 1442025（遊戲武器）vs 1702034（點裝武器）這種就分開了。
   b. 還分不出來 → **連號叢集分數**：表裡其他商品有幾個的候選 ID 落在 ±CLUSTER_WINDOW 內，
      分數高的勝、平手取小 ID。例：吐舌頭 1012074（臉飾）vs 5160014（表情），
      表裡 汗／哇塞／沉思… 是 5160001~5160013，所以是表情；藥丸那批 20015xx 彼此連號，
      不是 2000008 那組舊藥水。
   判定會逐筆印出；錯了寫進 merchant-id-overrides.json，不要改死在程式裡。

## 分類

依 itemId 號段分（不是猜名字），見 category_of()。號段外的 ID 直接擋下來要人看。

## 圖示

`icon` = "fashion" 用時裝搭配頁烤好的縮圖（public/icons/fashion/，fetch-fashion-assets.py
驗過指紋、跟經典版一致），沒有才用 "item"（public/icons/item/，download-icons.py 從
maplestory.io 抓）。2026-10-29 那期：196 件時裝裡 25 件 maplestory.io 沒有圖（森林／黑夜
護者整套、Andras Hat 那批），全靠時裝縮圖；反過來 6 個名牌／聊天戒指只有 item 圖。
所以時裝管線要排在這支前面跑。
"""

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
HIST = os.path.join(REF, "gacha-history")
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "merchant.json")
FASHION_ICONS = os.path.join(PROJECT, "public", "icons", "fashion")

TW = timezone(timedelta(hours=8))

CLUSTER_WINDOW = 50
TICKET_ITEM_ID = 5066103  # 神秘商人刷新券
SLOTS = 6  # 每一批上架幾個商品（官方說明第 5 點）

QTY_RE = re.compile(r"(.+?)\s*\*\s*(\d+)")


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def norm(name):
    # str.strip() 不帶參數就會去掉全形空白
    return name.strip()


def build_name_index():
    """正規化名稱 → 排序過的候選 itemId 清單。"""
    names = load(os.path.join(REF, "name-tables", "Item.json"), {})
    rev = defaultdict(set)
    for k, v in names.items():
        name = v.get("name") if isinstance(v, dict) else v
        if name:
            rev[norm(name)].add(int(k))
    return {k: sorted(v) for k, v in rev.items()}


def category_of(item_id):
    """itemId 號段 → 分類。號段外的回 None（呼叫端會擋下來）。"""
    if 1_000_000 <= item_id < 2_000_000:
        return "outfit"
    if 2_000_000 <= item_id < 3_000_000:
        return "potion"
    if 5_010_000 <= item_id < 5_020_000:
        return "effect"
    if 5_020_000 <= item_id < 5_030_000:
        return "throw"
    if 5_070_000 <= item_id < 5_080_000 or 5_390_000 <= item_id < 5_400_000:
        return "megaphone"
    if 5_120_000 <= item_id < 5_130_000:
        return "weather"
    if 5_160_000 <= item_id < 5_170_000:
        return "emote"
    if 5_000_000 <= item_id < 6_000_000:
        return "utility"  # 護身符、原地復活術、瞬移之石
    return None


def latest_ticket_price():
    """從最新的商城快照取刷新券價格（樂豆點，與新台幣 1:1）。

    商城有三筆：30／270（原價 300）／2700（原價 3000），但 Count 欄位三筆都是 1、
    CashPackage.json 也沒有這幾個 SN，張數只能從價格推：原價 ÷ 單張價。
    """
    snaps = sorted(
        f for f in os.listdir(os.path.join(REF, "commodity-history")) if f.endswith(".json")
    )
    if not snaps:
        return None
    rows = load(os.path.join(REF, "commodity-history", snaps[-1]), {}).get("commodity", {})
    rows = [r for r in rows.values() if r.get("ItemId") == TICKET_ITEM_ID and "Price" in r]
    plain = [r["Price"] for r in rows if not r.get("discount")]
    if not plain:
        return None
    single = min(plain)
    packs = {}
    for r in rows:
        count = round(r.get("originalPrice", r["Price"]) / single)
        packs[count] = min(packs.get(count, r["Price"]), r["Price"])
    return {
        "itemId": TICKET_ITEM_ID,
        "single": single,
        "bundle10": packs.get(10, single * 10),
        "source": snaps[-1],
    }


def resolve_ids(entries, name_index, cash_ids, overrides):
    """entries 的 name → itemId。回傳 (dict, 需覆核的報告列)。"""
    cands = {e["name"]: name_index.get(e["name"], []) for e in entries}

    def cash_like(i):
        return str(i) in cash_ids or 5_000_000 <= i < 6_000_000

    resolved, report = {}, []
    for name, cs in cands.items():
        if name in overrides:
            resolved[name] = overrides[name]
            report.append((name, overrides[name], cs, "override"))
            continue
        if not cs:
            resolved[name] = None
            report.append((name, None, [], "MISSING"))
            continue
        if len(cs) == 1:
            resolved[name] = cs[0]
            continue

        pool = [c for c in cs if cash_like(c)] or cs
        if len(pool) == 1:
            resolved[name] = pool[0]
            report.append((name, pool[0], cs, "cash"))
            continue

        def score(c):
            return sum(
                1
                for other, ocs in cands.items()
                if other != name and any(abs(o - c) <= CLUSTER_WINDOW for o in ocs)
            )

        best = max(pool, key=lambda c: (score(c), -c))
        resolved[name] = best
        report.append((name, best, cs, f"cluster({score(best)} vs {[score(c) for c in pool]})"))
    return resolved, report


def build_pool(snapshot, name_index, cash_ids, overrides, ticket):
    meta = snapshot["meta"]
    entries = []
    for p in snapshot["prizes"]:
        raw = norm(p["name"])
        m = QTY_RE.fullmatch(raw)
        name, qty = (norm(m.group(1)), int(m.group(2))) if m else (raw, 1)
        entries.append({"name": name, "qty": qty, "rate": p["rate"]})

    resolved, report = resolve_ids(entries, name_index, cash_ids, overrides)

    prizes = []
    for key, e in enumerate(entries):
        item_id = resolved[e["name"]]
        if item_id is None:
            raise SystemExit(f"「{e['name']}」在 Item.json 查不到——先重跑 extract-name-tables.py，"
                             "還是不行就寫進 merchant-id-overrides.json")
        cat = category_of(item_id)
        if cat is None:
            raise SystemExit(f"「{e['name']}」{item_id} 不在已知號段，請在 category_of() 補分類")
        prizes.append({
            "key": key,
            "itemId": item_id,
            "name": e["name"],
            "qty": e["qty"],
            "rate": e["rate"],
            "category": cat,
            "icon": "fashion" if os.path.exists(os.path.join(FASHION_ICONS, f"{item_id}.png")) else "item",
        })

    pool = {
        "eventAdId": meta["eventAdId"],
        "title": meta["title"],
        "startDate": meta["startDate"],
        "endDate": meta["endDate"],
        "capturedAt": meta["capturedAt"],
        "slots": SLOTS,
        "ticket": ticket,
        "prizes": prizes,
    }
    return pool, report


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    name_index = build_name_index()
    cash_ids = set(load(os.path.join(REF, "cash-items.json"), {}).get("items", {}))
    overrides = load(os.path.join(REF, "merchant-id-overrides.json"), {})
    ticket = latest_ticket_price()
    if not ticket:
        raise SystemExit(
            "在 commodity-history 找不到神秘商人刷新券的價格——先跑 tools/extract-cash-items.py 抓當期商城快照"
        )

    snaps = []
    for fname in sorted(os.listdir(HIST)):
        if fname.endswith(".json"):
            snap = load(os.path.join(HIST, fname))
            if "神秘商人" in snap["meta"]["title"]:
                snaps.append(snap)
    if not snaps:
        raise SystemExit(f"{HIST} 裡沒有神秘商人的快照——先跑 tools/fetch-gacha-odds.py <活動網址>")

    pools = []
    for snapshot in snaps:
        pool, report = build_pool(snapshot, name_index, cash_ids, overrides, ticket)
        pools.append(pool)

        print(f"\n=== {pool['title']} ({pool['eventAdId']}) ===")
        print(f"{pool['startDate']} ~ {pool['endDate']}｜商品 {len(pool['prizes'])} 筆"
              f"｜機率總和 {round(sum(p['rate'] for p in pool['prizes']), 4)}%")
        cats = defaultdict(int)
        for p in pool["prizes"]:
            cats[p["category"]] += 1
        print("分類：" + "、".join(f"{k} {v}" for k, v in sorted(cats.items(), key=lambda x: -x[1])))
        if report:
            print(f"-- 需覆核的 itemId 判定 {len(report)} 筆 --")
            for name, chosen, cands, why in report:
                print(f"   {name} → {chosen}  候選 {cands}  [{why}]")
        n_fashion = sum(1 for p in pool["prizes"] if p["icon"] == "fashion")
        print(f"圖示：時裝縮圖 {n_fashion}、道具圖 {len(pool['prizes']) - n_fashion}")
    print(f"\n刷新券：單張 {ticket['single']}、10 張 {ticket['bundle10']}（{ticket['source']}）")

    # 依 endDate 由新到舊，前端取第一筆當「當期」
    pools.sort(key=lambda p: p["endDate"], reverse=True)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "builtAt": datetime.now(TW).strftime("%Y-%m-%d"),
                    "poolCount": len(pools),
                },
                "pools": pools,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
    print(f"已寫入 {OUT_PATH}（{len(pools)} 期）")


if __name__ == "__main__":
    main()
