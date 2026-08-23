"""把 quest.json + npc-map.json + 名稱表組裝成任務查詢頁用的資料檔。

用法：python tools/build-quest-data.py
輸入：reference-data/quest.json（tools/extract-quest.py）、npc-map.json（同上）、
      name-tables/{Item,Npc,Map}.json、equip-info.json、worldmap.json
輸出：src/data/generated/quests.json
    {
      "quests":   [ { id, name, series?, lv, npc?, npcId?, npcMap?, released,
                      need, rewards, exp?, money?, cost?, pop?, skill?,
                      scripted?, sup?, prereq, c? } ],
                  // scripted = 完成處理交給伺服器端腳本（獎勵客戶端查不到）
                  // sup      = 有吃到 quest-supplement.json 的人工補充
                  // 依 lv 排序；need/rewards = [{ id, n }]；c = chains 索引
      "chains":   [ [questId...] ],   // 任務鏈，已排好順序
      "items":    { itemId: { name, desc?, eq? } },   // 任務用到的全部道具
      "maps":     { mapId: { street, name, region?, wm? } },  // NPC 所在地
      "worldmap": { sheet: { title, w, h, spots: [[x,y]...] } }
    }

## 實裝判斷

任務的 NPC 有沒有站在「客戶端 Map.json 有名字」的地圖上。
released = 至少一個 NPC 查得到具名地圖。實測分佈：全部實裝 296、部分 28、
完全沒有 166 —— 定案是「296+28 算現行版本，只有 166 掛未實裝徽章」，
所以這裡用 any() 而不是 all()。

## 任務鏈

「系列」有兩個來源：QuestData 的 Info.parent（241 個任務有）與前後關聯
（410 個任務有）。定案是**用關聯圖遍歷**，parent 只拿來當鏈的標題，
這樣那 169 個「有前後關係但沒有系列名」的任務也看得到整條線。

邊：Check["0"].quest 的每個 id → 本任務（前置）、Act 的 nextQuest（後續）。
先用 union-find 分連通元件，元件內再做拓撲排序（同層用 id 小的優先），
排好的順序存進 chains，任務只帶索引 c，避免 JSON 重複膨脹。

## 道具資料

任務道具**不在** monster-drops.json / item-info.json 裡（那兩份是從怪物掉落建的，
實測 36 種任務道具只有 13 種查得到）。所以這裡自己輸出一份 name/desc/eq，
來源與 build-site-data.py 相同：Item.json 的 name+desc ＋ equip-info.json。
少了這份，任務頁的道具 hover 彈窗會顯示 #4031003。

## 獎勵

Act 的 item 有 391 筆是負數（系統收回任務道具），一律丟掉，只留正數。
money 也有 4 筆是負數，但那是「任務要向玩家收費」（例：#6000 流浪煉金術師的新技術
收 100 萬楓幣），對攻略是重要資訊不能丟，所以拆成 money（得到）與 cost（花費）。

**客戶端只有 15 個任務帶 money**（11 正 4 負），84 個任務的 Act 完全是空的。
原因查明：`Check` 裡有 66 個任務帶 `startscript`/`endscript`，代表接受/完成處理交給
**伺服器端腳本**，獎勵不走 Act（例：#2156 可以許願的彩虹鍋牛殼有 `endscript: q2156e`，
實際會給 3 萬楓幣，客戶端一個欄位都沒有）。其中 52 個是「有 script 且 Act 全空」，
獎勵一定查不到（含全部轉職任務）。掃過 Act 全部欄位、任務說明文字、
ScriptString 的 quest0/quest1，客戶端都沒有腳本內容——跟掉落機率一樣只能靠玩家回報。

人工補充走 `reference-data/quest-supplement.json`，格式
`{ questId: { exp?, money?, cost?, pop?, items?: [{id,n}] } }`，會覆蓋客戶端資料。
"""

import json
import os
from collections import defaultdict

from worldmap_spots import build_wm_lookup

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT = os.path.join(PROJECT, "src", "data", "generated", "quests.json")


def load(*parts):
    path = os.path.join(REF, *parts)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def items_of(node):
    """wz 的 item 子樹 → [{id, n}]，只留正數（負數是系統收回）。"""
    out = []
    for entry in (node or {}).values():
        if not isinstance(entry, dict):
            continue
        iid, n = entry.get("id"), entry.get("count", 1)
        if isinstance(iid, int) and isinstance(n, int) and n > 0:
            out.append({"id": iid, "n": n})
    return out


def build_chains(quests):
    """用前置/後續關聯把任務分組並排序，回傳 [[questId...]]（長度 >1 的才留）。

    分組鍵：**有系列名的就用系列名本身**，沒有的才用關聯連通元件（且只走
    「兩端都沒系列名」的邊）。這是因為遊戲的任務關聯會跨系列相連——
    「泰實夫的秘密之書」最後一步的後續就是「妖精羅雯和詛咒的娃娃」第一步——
    純靠連通元件會把三條線併成一條 14 步，標題只顯示其中一個系列名、
    「第 N / M 步」也是錯的；而且這種串接還會透過中間沒系列名的任務間接發生，
    所以光是「跳過跨系列的邊」擋不住，必須直接用系列名當分界。
    無系列名的任務（例如 21 步的勇士之村主線）維持靠關聯相連，那本來就是同一條。

    排序用拓撲排序（同層取 id 小的先，任務 id 大致就是流程順序），
    邊只在同組內生效。
    """
    ids = {q["id"] for q in quests}
    series_of = {q["id"]: q.get("series") for q in quests}

    edges = set()
    for q in quests:
        for p in q["prereq"]:
            if p in ids:
                edges.add((p, q["id"]))
        for n in q["next"]:
            if n in ids:
                edges.add((q["id"], n))

    # 無系列名任務之間的連通元件
    parent = {i: i for i in ids if not series_of.get(i)}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        if a in parent and b in parent:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

    groups = defaultdict(list)
    for i in ids:
        key = series_of.get(i) or ("\0comp", find(i))
        groups[key].append(i)

    chains = []
    for members in groups.values():
        if len(members) < 2:
            continue
        member_set = set(members)
        succ = defaultdict(set)
        indeg = {m: 0 for m in members}
        for a, b in edges:
            if a in member_set and b in member_set and b not in succ[a]:
                succ[a].add(b)
                indeg[b] += 1
        deg = dict(indeg)
        ready = sorted((m for m in members if deg[m] == 0), key=int)
        order = []
        while ready:
            cur = ready.pop(0)
            order.append(cur)
            for nxt in sorted(succ.get(cur, ()), key=int):
                deg[nxt] -= 1
                if deg[nxt] == 0:
                    ready.append(nxt)
            ready.sort(key=int)
        # 有環（資料異常）時把剩下的接在後面，不要整條鏈消失
        order += sorted(member_set - set(order), key=int)
        chains.append(order)
    chains.sort(key=lambda c: int(c[0]))
    return chains


def main():
    raw = load("quest.json")
    if not raw:
        raise SystemExit("找不到 reference-data/quest.json，請先跑 tools/extract-quest.py")
    info_tbl, check_tbl, act_tbl = raw["info"], raw["check"], raw["act"]
    strings = raw["strings"]

    npc_map = load("npc-map.json")
    item_tbl = load("name-tables", "Item.json")
    npc_tbl = load("name-tables", "Npc.json")
    map_tbl = load("name-tables", "Map.json")
    equips = load("equip-info.json").get("equips", {})
    supplement = {k: v for k, v in load("quest-supplement.json").items() if not k.startswith("_")}
    wm_of = build_wm_lookup(load("worldmap.json").get("sheets", {}))

    # 地區分類：給任務頁的地區篩選用。粒度要「維多利亞港/墮落城市」這種大地區，
    # 不是每張小地圖。試過三種都不行：
    #   - streetName 單用：維多利亞島整座大陸共用「維多利亞」一個名字，172 個任務全擠在一組
    #   - 世界地圖點位：粒度對但太碎（42 組，混了「魔法森林北部」這種子區域）
    #   - 純 ID 主城代碼：粒度對但標籤歪（楓之島會變成「菇菇村訓練所入口」）
    # 定案：用 streetName 分組，但某個 streetName 底下有 ≥3 個主城代碼時
    # （＝它其實是一整座大陸的名字），才再依主城代碼拆開、用主城地圖名當標籤。
    # 這樣楓之島/鯨魚號/迷霧森林維持整塊，維多利亞則拆成弓箭手村/魔法森林/墮落城市…
    street_codes = defaultdict(set)
    for mid, entry in map_tbl.items():
        if not mid.isdigit() or not (entry.get("mapName") or "").strip():
            continue
        street = (entry.get("streetName") or "").strip()
        if street:
            street_codes[street].add(int(mid) // 1000000)
    split_streets = {s for s, codes in street_codes.items() if len(codes) >= 3}

    def region_of(map_id):
        entry = map_tbl.get(str(map_id)) or {}
        street = (entry.get("streetName") or "").strip()
        if not street:
            return None
        if street in split_streets:
            town = map_tbl.get(str((map_id // 1000000) * 1000000)) or {}
            return (town.get("mapName") or "").strip() or street
        return street

    def named_map_of(npc_id):
        """該 NPC 第一張在客戶端有中文名的出沒地圖 id（沒有就 None）。"""
        for mp in npc_map.get(str(npc_id), []):
            if (map_tbl.get(str(mp)) or {}).get("mapName"):
                return int(mp)
        return None

    quests = []
    used_items, used_maps = set(), set()
    full = partial = none = 0

    for qid in sorted(check_tbl, key=int):
        check = check_tbl[qid]
        act = act_tbl.get(qid, {})
        meta = strings.get(qid, {})
        start = check.get("0") or {}
        end = check.get("1") or {}

        npc_ids = [
            b["npc"]
            for b in check.values()
            if isinstance(b, dict) and isinstance(b.get("npc"), int)
        ]
        located = [n for n in npc_ids if named_map_of(n) is not None]
        released = bool(located)
        if npc_ids and len(located) == len(npc_ids):
            full += 1
        elif located:
            partial += 1
        else:
            none += 1

        # 顯示用 NPC：優先接任務的那位，其次交任務的
        npc_id = start.get("npc") if isinstance(start.get("npc"), int) else None
        if npc_id is None:
            npc_id = end.get("npc") if isinstance(end.get("npc"), int) else None
        npc_map_id = named_map_of(npc_id) if npc_id is not None else None

        rewards, exp, money, pop, skill = [], 0, 0, 0, 0
        for stage in act.values():
            if not isinstance(stage, dict):
                continue
            rewards += items_of(stage.get("item"))
            exp = exp or stage.get("exp", 0) or 0
            money = money or stage.get("money", 0) or 0
            pop = pop or stage.get("pop", 0) or 0
            if "skill" in stage:
                skill = 1

        # 完成/接受處理交給伺服器端腳本的任務，獎勵在客戶端完全沒有記錄
        scripted = any(
            isinstance(b, dict) and (b.get("startscript") or b.get("endscript"))
            for b in check.values()
        )

        need = items_of(end.get("item"))
        prereq = [
            str(e["id"])
            for e in (start.get("quest") or {}).values()
            if isinstance(e, dict) and "id" in e
        ]
        nxt = [
            str(stage["nextQuest"])
            for stage in act.values()
            if isinstance(stage, dict) and isinstance(stage.get("nextQuest"), int)
        ]

        used_items.update(i["id"] for i in need + rewards)
        if npc_map_id is not None:
            used_maps.add(npc_map_id)

        entry = {
            "id": qid,
            "name": (meta.get("name") or f"#{qid}").strip(),
            "lv": start.get("lvmin") or 0,
            "released": released,
            "need": need,
            "rewards": rewards,
            "prereq": prereq,
            "next": nxt,
        }
        series = (meta.get("Info") or {}).get("parent")
        if series:
            entry["series"] = series.strip()
        if npc_id is not None:
            entry["npcId"] = npc_id
            entry["npc"] = ((npc_tbl.get(str(npc_id)) or {}).get("name") or f"#{npc_id}").strip()
        if npc_map_id is not None:
            entry["npcMap"] = npc_map_id
        # money 有 4 筆是負數＝這個任務要向你收費（例：#6000 流浪煉金術師收 100 萬），
        # 那不是獎勵，分成 money(得到) 與 cost(花費) 兩個欄位，前端才不會印成獎勵。
        cost = -money if money < 0 else 0

        # 人工補充（quest-supplement.json）覆蓋客戶端資料
        sup = supplement.get(qid) or {}
        exp = sup.get("exp", exp)
        pop = sup.get("pop", pop)
        cost = sup.get("cost", cost)
        if "money" in sup:
            money = sup["money"]
        if sup.get("items"):
            rewards += [{"id": i["id"], "n": i.get("n", 1)} for i in sup["items"]]
        for key, val in (
            ("exp", exp),
            ("money", max(money, 0)),
            ("cost", cost),
            ("pop", pop),
            ("skill", skill),
            ("scripted", 1 if scripted else 0),
        ):
            if val:
                entry[key] = val
        if sup:
            entry["sup"] = 1
        quests.append(entry)

    chains = build_chains(quests)
    chain_of = {qid: idx for idx, chain in enumerate(chains) for qid in chain}
    for q in quests:
        if q["id"] in chain_of:
            q["c"] = chain_of[q["id"]]
        del q["next"]  # 只是建鏈用的中間欄位，前端拿 chains 就好

    quests.sort(key=lambda q: (q["lv"], int(q["id"])))

    items = {}
    for iid in sorted(used_items):
        tbl = item_tbl.get(str(iid)) or {}
        entry = {"name": (tbl.get("name") or f"#{iid}").strip()}
        desc = tbl.get("desc")
        if desc:
            entry["desc"] = desc.replace("\\n", "\n").replace("\\r", "")
        eq = equips.get(str(iid))
        if eq:
            entry["eq"] = eq
        items[str(iid)] = entry

    maps = {}
    for mp in sorted(used_maps):
        tbl = map_tbl.get(str(mp)) or {}
        wm = wm_of(mp)
        region = region_of(mp)
        maps[str(mp)] = {
            "street": (tbl.get("streetName") or "").strip(),
            "name": (tbl.get("mapName") or f"#{mp}").strip(),
            **({"region": region} if region else {}),
            **({"wm": wm} if wm else {}),
        }

    used_sheets = {m["wm"]["s"] for m in maps.values() if "wm" in m}
    sheets = load("worldmap.json").get("sheets", {})
    worldmap = {
        sname: {
            "title": sheets[sname]["title"],
            "w": sheets[sname]["size"][0],
            "h": sheets[sname]["size"][1],
            "spots": [[sp["x"], sp["y"]] for sp in sheets[sname]["spots"]],
        }
        for sname in sorted(used_sheets)
    }

    out = {
        "quests": quests,
        "chains": chains,
        "items": items,
        "maps": maps,
        "worldmap": worldmap,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    named_items = sum(1 for v in items.values() if not v["name"].startswith("#"))
    print(f"任務 {len(quests)}：NPC 全實裝 {full}、部分 {partial}、無 {none}")
    print(f"  → released {sum(1 for q in quests if q['released'])} / 未實裝 {sum(1 for q in quests if not q['released'])}")
    print(f"任務鏈 {len(chains)} 條（最長 {max((len(c) for c in chains), default=0)} 步）、"
          f"入鏈任務 {len(chain_of)}")
    print(f"道具 {len(items)} 種（有中文名 {named_items}、有說明 {sum(1 for v in items.values() if 'desc' in v)}）")
    regions = {m["region"] for m in maps.values() if "region" in m}
    print(f"NPC 所在地圖 {len(maps)} 張、世界地圖 {len(worldmap)} 張、地區 {len(regions)} 個")
    print(f"已寫入 {OUT}（{os.path.getsize(OUT) // 1024} KB）")


if __name__ == "__main__":
    main()
