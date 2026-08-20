"""把轉蛋機率表快照 join 成網站用的資料。

用法：
    python tools/fetch-gacha-odds.py <活動網址>   # 先跑這個
    python tools/build-gacha-data.py

輸入：
    reference-data/gacha-history/*.json      機率表快照（fetch-gacha-odds.py 產出）
    reference-data/name-tables/Item.json     名稱 → itemId 反查
    reference-data/commodity-history/*.json  轉蛋券價格（取最新一份）
    reference-data/gacha-id-overrides.json   （選用）人工指定 itemId
    reference-data/gacha-icon-alias.json     缺圖獎品的替代圖示來源
輸出：
    src/data/generated/gacha.json

## 圖示替代（gacha-icon-alias.json）

101 個獎品裡有 61 個在 maplestory.io 沒有自己的圖示（台服經典版專屬）。
與其顯示文字色塊，不如顯示**它實際代表的東西**：

- 表情／特效交換券 → 它換到的本體道具（`5160xxx` 表情、`5010xxx` 特效）
- 欄位擴充券／瞬移之石／雕像 → 同名的舊版道具 ID
- 重配卷軸交換券 → `5050xxx` 重配捲軸本體
- 變身藥水 → **它變成的那隻怪**（名稱裡就寫了，比通用藥水瓶有辨識度）

表情那組的對應是靠位置：券 `2832892+k` ↔ 表情 `5160000+k`，
中間有親親／眨眼／閃閃發亮／吐舌頭四個同名定錨點（位在第 3、4、8、14 位）確認對位——
券名與道具名是同一個表情的兩種翻譯（例：`頭暈目眩交換券` ↔ `嘔吐`）。

## 名稱 → itemId 的消歧

官方機率表只給中文名稱，而 Item.json 裡 31 筆名稱撞 ID（同名多個 ID，通常是
舊版原件 vs 活動用的新號段）。判定規則：

1. 只有一個候選 → 直接用
2. 多個候選 → **連號叢集分數**：同機率組的其他獎品，有幾個的候選 ID 落在
   本候選 ±CLUSTER_WINDOW 之內。分數最高者勝，且必須 >= MIN_CLUSTER_SCORE
   才算有效證據。
3. 分數不足或平手 → 取**較小 ID**（原始號段）

為什麼不能只用「較小 ID」：0.50% 那組的正確答案是 2832887~2832891
（跟 0.67% 的 2832885/2832886 和 1.48% 表情券的 2832892 起頭完全接續），
較小 ID 會選到 2430768~2430771 這組舊版道具。雕像同理（2210287/2210288
落在 2210283~2210293 的活動連號區塊內，2210000/2210001 是舊版原件）。

為什麼叢集分數要設下限：椅子那組（1.00%）只有零星一兩個 ID 偶然相鄰，
單一鄰居不足以推翻「原始號段」的預設，所以要求至少 2 個鄰居。

判定結果會逐筆印出，人工覆核後若有錯就寫進 gacha-id-overrides.json
（`{"道具名稱": itemId}`），**不要改死在程式裡**。
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
HIST = os.path.join(REF, "gacha-history")
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "gacha.json")

TW = timezone(timedelta(hours=8))

CLUSTER_WINDOW = 50
MIN_CLUSTER_SCORE = 2

TICKET_ITEM_ID = 5222222  # 轉蛋券

# 機率值 → 稀有度分層。這是分類不是機率計算。
# expect 是該層應有的獎品數，對不上代表官方換了獎池，要人看。
TIERS = [
    (1.48, "emote", 42),
    (1.00, "chair", 4),
    (0.94, "bag", 1),
    (0.90, "morph", 11),
    (0.67, "reset", 3),
    (0.58, "scroll", 27),
    (0.50, "slot", 5),
    (0.35, "rare", 8),
]

# 神秘任務：6 種怪物橡皮擦 + (六角水晶項鍊 OR 水女神的衣料)
# groups 是 AND of OR-groups，自訂目標共用同一個結構
MYSTERY_GOAL = {
    "id": "mystery",
    "label": "神秘任務",
    "reward": None,  # 客戶端 Quest 包未挖，前端顯示「未公開」
    "groups": [
        {"any": [4001009], "count": 1},  # 木妖橡皮擦
        {"any": [4001010], "count": 1},  # 蘑菇王橡皮擦
        {"any": [4001011], "count": 1},  # 猴子橡皮擦
        {"any": [4001012], "count": 1},  # 大幽靈橡皮擦
        {"any": [4001013], "count": 1},  # 綠水靈橡皮擦
        {"any": [4001014], "count": 1},  # 三眼章魚橡皮擦
        {"any": [4001116, 4001115], "count": 1},  # 六角水晶項鍊 OR 水女神的衣料
    ],
}


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_name_index():
    """名稱 → 排序過的候選 itemId 清單。"""
    names = load(os.path.join(REF, "name-tables", "Item.json"), {})
    rev = defaultdict(list)
    for k, v in names.items():
        name = v.get("name") if isinstance(v, dict) else v
        if name:
            rev[name].append(int(k))
    return {k: sorted(v) for k, v in rev.items()}


def latest_ticket_price():
    """從最新的商城快照取轉蛋券單抽/十連價（樂豆點，與新台幣 1:1）。"""
    snaps = sorted(
        f for f in os.listdir(os.path.join(REF, "commodity-history")) if f.endswith(".json")
    )
    if not snaps:
        return None
    rows = load(os.path.join(REF, "commodity-history", snaps[-1]), {}).get("commodity", {})
    prices = {}
    for row in rows.values():
        if row.get("ItemId") == TICKET_ITEM_ID and "Price" in row:
            prices[row.get("Count", 1)] = row["Price"]
    if not prices:
        return None
    return {
        "itemId": TICKET_ITEM_ID,
        "single": prices.get(1),
        "bundle10": prices.get(10),
        "source": snaps[-1],
    }


def tier_of(rate):
    for value, name, _ in TIERS:
        if abs(rate - value) < 1e-9:
            return name
    return None


def resolve_ids(prizes, name_index, overrides):
    """把 prizes 的名稱解析成 itemId，回傳 (解析結果, 報告列)。"""
    by_rate = defaultdict(list)
    for p in prizes:
        by_rate[p["rate"]].append(p["name"])

    # 同機率組裡每個名稱的候選 ID，用來算連號叢集分數
    candidates = {name: name_index.get(name, []) for p in prizes for name in [p["name"]]}

    resolved, report = {}, []
    for p in prizes:
        name = p["name"]
        cands = candidates[name]

        if name in overrides:
            resolved[name] = overrides[name]
            report.append((name, overrides[name], cands, "override"))
            continue
        if not cands:
            resolved[name] = None
            report.append((name, None, [], "MISSING"))
            continue
        if len(cands) == 1:
            resolved[name] = cands[0]
            continue

        peers = [n for n in by_rate[p["rate"]] if n != name]
        best, best_score = cands[0], -1
        for c in cands:
            score = sum(
                1
                for peer in peers
                if any(abs(pc - c) <= CLUSTER_WINDOW for pc in candidates[peer])
            )
            if score > best_score:
                best, best_score = c, score

        if best_score >= MIN_CLUSTER_SCORE and best != cands[0]:
            resolved[name] = best
            report.append((name, best, cands, f"cluster({best_score})"))
        else:
            resolved[name] = cands[0]
            report.append((name, cands[0], cands, f"smallest(cluster={max(best_score, 0)})"))

    return resolved, report


def build_pool(snapshot, name_index, overrides, ticket, icon_alias):
    meta = snapshot["meta"]
    prizes = snapshot["prizes"]
    resolved, report = resolve_ids(prizes, name_index, overrides)

    out_prizes = []
    for p in prizes:
        tier = tier_of(p["rate"])
        if tier is None:
            raise SystemExit(
                f"機率 {p['rate']}%（{p['name']}）不在已知分層表裡——官方可能換了獎池，請人工檢查 TIERS"
            )
        item_id = resolved[p["name"]]
        # 圖示：預設用自己的 itemId，缺圖的走替代表
        spec = icon_alias.get(p["name"])
        if isinstance(spec, dict) and "mob" in spec:
            icon = {"kind": "mob", "id": spec["mob"]}
        elif isinstance(spec, dict) and "item" in spec:
            icon = {"kind": "item", "id": spec["item"]}
        elif item_id is not None:
            icon = {"kind": "item", "id": item_id}
        else:
            icon = None
        out_prizes.append(
            {
                "itemId": item_id,
                "name": p["name"],
                "rate": p["rate"],
                "tier": tier,
                "icon": icon,
            }
        )

    counts = defaultdict(int)
    for p in out_prizes:
        counts[p["tier"]] += 1
    for _, tier, expect in TIERS:
        if counts[tier] != expect:
            print(f"⚠️  分層 {tier} 預期 {expect} 筆，實得 {counts[tier]} 筆——獎池可能變了")

    pool = {
        "eventAdId": meta["eventAdId"],
        "title": meta["title"],
        "startDate": meta["startDate"],
        "endDate": meta["endDate"],
        "capturedAt": meta["capturedAt"],
        "ticket": ticket,
        "prizes": out_prizes,
        "goals": [MYSTERY_GOAL],
    }
    return pool, report


def main():
    name_index = build_name_index()
    overrides = load(os.path.join(REF, "gacha-id-overrides.json"), {})
    icon_alias = load(os.path.join(REF, "gacha-icon-alias.json"), {})
    ticket = latest_ticket_price()
    if not ticket or not ticket.get("single"):
        raise SystemExit(
            "在 commodity-history 找不到轉蛋券價格——先跑 tools/extract-cash-items.py 抓當期商城快照"
        )

    snaps = sorted(f for f in os.listdir(HIST) if f.endswith(".json"))
    if not snaps:
        raise SystemExit(f"{HIST} 是空的——先跑 tools/fetch-gacha-odds.py <活動網址>")

    pools = []
    for fname in snaps:
        snapshot = load(os.path.join(HIST, fname))
        pool, report = build_pool(snapshot, name_index, overrides, ticket, icon_alias)
        pools.append(pool)

        print(f"\n=== {pool['title']} ({pool['eventAdId']}) ===")
        print(f"{pool['startDate']} ~ {pool['endDate']}｜獎品 {len(pool['prizes'])} 筆")
        if report:
            print(f"-- 需覆核的 itemId 判定 {len(report)} 筆 --")
            for name, chosen, cands, why in report:
                print(f"   {name} → {chosen}  候選 {cands}  [{why}]")
        missing = [p["name"] for p in pool["prizes"] if p["itemId"] is None]
        if missing:
            print(f"⚠️  {len(missing)} 筆查不到 itemId：{missing}")
        aliased = sum(1 for p in pool["prizes"] if p["name"] in icon_alias)
        no_icon = [p["name"] for p in pool["prizes"] if p["icon"] is None]
        print(f"圖示：{len(pool['prizes']) - aliased} 筆用自己的圖、{aliased} 筆用替代圖"
              f"、{len(no_icon)} 筆無圖 {no_icon}")

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
    print(f"\n已寫入 {OUT_PATH}（{len(pools)} 期）")


if __name__ == "__main__":
    main()
