"""把 quest.json + npc-map.json + 名稱表組裝成任務查詢頁用的資料檔。

用法：python tools/build-quest-data.py
輸入：reference-data/quest.json（tools/extract-quest.py）、npc-map.json（同上）、
      name-tables/{Item,Npc,Map}.json、equip-info.json、worldmap.json
輸出：src/data/generated/quests.json
    {
      "quests":   [ { id, name, series?, lv, npc?, npcId?, npcMap?, released,
                      region?, lvMax?, repeat?, need, kill?, have?, jobs?,
                      rewards, give?, exp?, money?, cost?, pop?, skill?,
                      scripted?, sup?, prereq, c? } ],
                  // kill     = 完成條件要打倒的怪 [{id,n}]（79 個任務）
                  // have     = 接任務時身上要先有的道具（87 個）
                  // jobs     = 職業限制（全職業都能接的就不寫）
                  // exclude  = 互斥任務（接過那個就不能接這個）
                  // skills   = 技能獎勵 [{id, job?, m?=上限, lv?=學到幾級}]
                  // lvMax    = 等級上限、repeat = 可重複的間隔（分鐘）
                  // give     = 接任務時 NPC 先給的道具（不是獎勵，見下面「獎勵」；
                  //            資料留著但前端不顯示，玩家反映那是雜訊）
                  // scripted = 完成處理交給伺服器端腳本（獎勵客戶端查不到）
                  // sup      = 有吃到 quest-supplement.json 的人工補充
                  // 依 lv 排序；need/rewards = [{ id, n }]；c = chains 索引
      "chains":   [ [questId...] ],   // 任務鏈，已排好順序
      "items":    { itemId: { name, desc?, eq? } },   // 任務用到的全部道具
      "mobs":     { mobId: 中文名 },   // 完成條件要打的怪
      "skills":   { skillId: 中文名 },  // 技能獎勵
      "maps":     { mapId: { street, name, wm? } },   // NPC 所在地
      "regions":  [ 地區名... ],   // 地區 chips 的順序（TOWNS 宣告順序）
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

**Act 有兩段：`["0"]` 接受任務當下、`["1"]` 完成當下，獎勵只能讀 `["1"]`。**
`["0"]` 的道具是「NPC 先把任務道具塞給你」（63 個任務有），例如 #1034 美味的蘑菇糖果，
妮娜先給 10 顆 4031792 去跑腿，完成時 `["1"]` 再 `-10` 收回、另給 2 顆能吃的 2022253。
兩段混在一起讀就會變成「獎勵 10 顆＋2 顆」（2026-08-23 修掉的 bug，玩家回報）。
先給的那些存成 `give`，前端標「接任務時拿到」，免得玩家跑去打怪找。

Act 的 item 有 391 筆是負數（系統收回任務道具），一律丟掉，只留正數。
money 也有 4 筆是負數，但那是「任務要向玩家收費」（例：#6000 流浪煉金術師的新技術
收 100 萬楓幣），對攻略是重要資訊不能丟，所以拆成 money（得到）與 cost（花費）。
**負數 money 兩段都要看**：#2029 瑪帕的請託是接任務當下就先收 1000。

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
from collections import Counter, defaultdict

from jobs import ALL_FAMILIES, job_labels, mask_families
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


def items_of(node, limits=False):
    """wz 的 item 子樹 → [{id, n}]，只留正數（負數是系統收回）。

    limits=True 時多帶獎勵的發放限制（只有 Act["1"] 的獎勵有）：
    - `job`：職業 bitmask 解出來的職業系列，涵蓋全部五系的就不標（＝沒限制）。
      少了這個，#2001 酋長蓋房子會列出 16 張攻擊卷軸，像是一次全給。
    - `g`：0=只有男生、1=只有女生（2 或沒有 = 不分性別，不標）。
    """
    out = []
    for entry in (node or {}).values():
        if not isinstance(entry, dict):
            continue
        iid, n = entry.get("id"), entry.get("count", 1)
        if not (isinstance(iid, int) and isinstance(n, int) and n > 0):
            continue
        row = {"id": iid, "n": n}
        if limits:
            mask = entry.get("job")
            if isinstance(mask, int):
                fams = mask_families(mask)
                if fams and not all(f in fams for f in ALL_FAMILIES):
                    row["job"] = fams
            gender = entry.get("gender")
            if gender in (0, 1):
                row["g"] = gender
        out.append(row)
    return out


def mobs_of(node):
    """wz 的 mob 子樹 → [{id, n}]（要打倒的怪物）。"""
    return [
        {"id": e["id"], "n": e.get("count", 1)}
        for e in (node or {}).values()
        if isinstance(e, dict) and isinstance(e.get("id"), int)
    ]


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


# 地區分類：給任務頁的地區篩選用。粒度要「弓箭手村 / 墮落城市 / 奇幻村」這種
# 玩家講得出口的大地區，一張小地圖不該自己變成一個 chip。
#
# 走過的路（都不行，別再回頭試）：
#   - streetName 單用：維多利亞島整座大陸共用「維多利亞」一個名字，172 個任務擠成一組
#   - streetName ＋（涵蓋 ≥3 個主城代碼時才依主城代碼拆開）：2026-08-19 的舊做法，
#     維多利亞是拆對了，但 streetName 本身就有一堆「不是大地區」的值，chip 直接歪掉：
#     「迷霧森林」（其實整片都屬奇幻村）、「彩虹之地」（楓之島的楓葉村那半邊）、
#     「戰火之地」（迷宮，入口分別在勇士之村與弓箭手村門口）、「墮落城市地鐵」、
#     還有隱藏地圖被 ID 前綴推去「自由市場入口」（詛咒之林其實在魔法森林）。
#   - 純 ID 主城代碼：粒度對但標籤歪（楓之島會變成「菇菇村訓練所入口」），
#     而且 101030xxx 遺跡發掘地、100050000 魔法森林南郊這種跨區編號會分錯。
#
# 定案（2026-08-23）：**主城清單 + 三段判定**，把地區數壓在十個左右：
#   1. MAP_REGION_OVERRIDE：世界地圖上沒有點位、規則救不了的地圖，人工指定
#   2. 地圖名開頭就是某個主城名（「弓箭手村迷宮入口」「魔法森林南郊」）→ 那個主城
#   3. 世界地圖上離哪個主城的點最近（曼哈頓距離）→ 那個主城
#      底圖優先取**大陸圖**（depth 1）而不是最深的子圖：子圖（例如奇幻村那張）
#      只畫得下一個主城，任何點都會被判給它——迷宮入口就是這樣被吸去奇幻村的。
#      地圖不在任何底圖上時，退回 worldmap_spots 借鄰居的約略點位。
# 判不出來的（NPC 完全不在已實裝地圖上）留 None，前端歸「未實裝」。
TOWNS = {
    # 楓之島兩個村子（菇菇村 / 楓葉村）合成一塊：整座島才 52 個任務，拆開沒有意義
    10000: "楓之島",
    1010000: "楓之島",
    100000000: "弓箭手村",
    101000000: "魔法森林",
    102000000: "勇士之村",
    103000000: "墮落城市",
    104000000: "維多利亞港",
    105040300: "奇幻村",
    110000000: "黃金海岸",
    120000000: "鯨魚號",
    680000000: "結婚小鎮",
}

MAP_REGION_OVERRIDE = {
    # 詛咒之林：惡靈森林任務鏈的其他五步都在魔法森林（潘喜/艾溫/漢斯），
    # 但這張是隱藏地圖、世界地圖上沒有點，ID 前綴 910 又會被推去自由市場入口
    910100000: "魔法森林",
    910100001: "魔法森林",
    # 卡伊琳的訓練場：海盜轉職教官卡伊琳的地方，在鯨魚號上
    912010200: "鯨魚號",
}


def build_region_lookup(wm_sheets, map_tbl):
    """回傳 region_of(mapId) -> 大地區名 | None。規則見上面的 TOWNS 註解。"""

    # 逐張底圖各存一份點位（不像 worldmap_spots 只留最深的那張）：
    # 要在「同一張底圖上」比距離，跨底圖的座標沒有可比性
    per_sheet = {
        name: {mp: (spot["x"], spot["y"]) for spot in sheet["spots"] for mp in spot["maps"]}
        for name, sheet in wm_sheets.items()
    }

    def depth(name):
        d = 0
        while name and wm_sheets.get(name, {}).get("parent"):
            name = wm_sheets[name]["parent"]
            d += 1
        return d

    # depth 0 是世界總圖（整座大陸糊成一團，比距離沒意義），排除
    towns_on = {
        name: [(idx[t], r) for t, r in TOWNS.items() if t in idx]
        for name, idx in per_sheet.items()
        if depth(name) >= 1
    }
    town_names = sorted(
        (((map_tbl.get(str(t)) or {}).get("mapName") or "").strip(), r)
        for t, r in TOWNS.items()
    )

    def nearest(sheet, pos):
        return min(
            (abs(pos[0] - p[0]) + abs(pos[1] - p[1]), r) for p, r in towns_on[sheet]
        )[1]

    wm_of = build_wm_lookup(wm_sheets)

    def region_of(map_id):
        if map_id in MAP_REGION_OVERRIDE:
            return MAP_REGION_OVERRIDE[map_id]

        name = ((map_tbl.get(str(map_id)) or {}).get("mapName") or "").strip()
        for town, region in town_names:
            if town and name.startswith(town):
                return region

        sheets = sorted(
            (depth(s), s) for s, idx in per_sheet.items() if map_id in idx and towns_on.get(s)
        )
        if sheets:
            s = sheets[0][1]
            return nearest(s, per_sheet[s][map_id])

        spot = wm_of(map_id)  # 沒有點位的隱藏圖：借 ID 最接近的鄰居
        if spot and towns_on.get(spot["s"]):
            return nearest(spot["s"], (spot["x"], spot["y"]))
        return None

    return region_of


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
    mob_tbl = load("name-tables", "Mob.json")
    skill_tbl = load("name-tables", "Skill.json")
    equips = load("equip-info.json").get("equips", {})
    supplement = {k: v for k, v in load("quest-supplement.json").items() if not k.startswith("_")}
    wm_sheets = load("worldmap.json").get("sheets", {})
    wm_of = build_wm_lookup(wm_sheets)
    region_of = build_region_lookup(wm_sheets, map_tbl)

    def named_map_of(npc_id):
        """該 NPC 第一張在客戶端有中文名的出沒地圖 id（沒有就 None）。"""
        for mp in npc_map.get(str(npc_id), []):
            if (map_tbl.get(str(mp)) or {}).get("mapName"):
                return int(mp)
        return None

    quests = []
    used_items, used_maps, used_mobs, used_skills = set(), set(), set(), set()
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

        # Act 分兩段：["0"] = 接受任務當下、["1"] = 完成當下。**獎勵只能看 ["1"]**——
        # ["0"] 的道具是「NPC 先把任務道具塞給你」（63 個任務有，例：#1034 美味的蘑菇糖果，
        # 妮娜先給 10 顆去跑腿，完成時 Act["1"] 再 -10 收回、另給 2 顆能吃的），
        # 兩段混在一起會變成「獎勵 10 顆＋2 顆」，跟遊戲裡對不上。
        # 這些先給的道具存成 give，前端標「接任務時拿到」，免得玩家跑去打怪找。
        on_start = act.get("0") if isinstance(act.get("0"), dict) else {}
        on_end = act.get("1") if isinstance(act.get("1"), dict) else {}
        rewards = items_of(on_end.get("item"), limits=True)
        give = items_of(on_start.get("item"))
        exp = on_end.get("exp", 0) or 0
        pop = on_end.get("pop", 0) or 0
        # 技能獎勵：40 個任務給技能（多半是 4 轉的精通書）。skill 只記「有沒有」，
        # 名字要另外查——只寫「技能」等於沒講。masterLevel = 把上限拉到幾級（精通書）。
        # 稱號勳章的獎勵**不在 Act，在 QuestInfo 的 viewMedalItem**（24 個任務）。
        # 少讀這一欄的話，15 個「稱號挑戰」系列會因為 Act 全空而被印成
        # 「獎勵在伺服器端查不到」，但那面勳章其實客戶端寫得好好的。
        # 另外 9 個 Act 已經有同一面勳章了，所以要去重。
        medal = (info_tbl.get(qid) or {}).get("viewMedalItem")
        if isinstance(medal, int) and not any(r["id"] == medal for r in rewards):
            rewards.append({"id": medal, "n": 1})

        # 同一個技能常常有冒險家/騎士團/龍魔導士三份不同 id（#6000 的神匠之魂），
        # 但對玩家是同一個技能，用「名字＋職業」去重，不然會印三次一模一樣的。
        skills, seen_skills = [], set()
        for e in (on_end.get("skill") or {}).values():
            if not isinstance(e, dict) or "id" not in e:
                continue
            row = {"id": e["id"]}
            labels = job_labels((e.get("job") or {}).values())
            if labels:
                row["job"] = labels
            if e.get("masterLevel"):
                row["m"] = e["masterLevel"]
            if e.get("skillLevel"):
                row["lv"] = e["skillLevel"]
            key = ((skill_tbl.get(str(e["id"])) or {}).get("Name"), tuple(labels))
            if key in seen_skills:
                continue
            seen_skills.add(key)
            skills.append(row)
        skill = 1 if skills else 0
        used_skills.update(r["id"] for r in skills)
        # 正數楓幣只出現在完成階段；負數是「任務向玩家收費」，接受階段也收得到
        # （#2029 瑪帕的請託接下去就先付 1000），所以 cost 兩段都要看。
        money_end = on_end.get("money", 0) or 0
        money = max(money_end, 0)
        cost = max(-money_end, 0) + max(-(on_start.get("money", 0) or 0), 0)

        # 完成/接受處理交給伺服器端腳本的任務，獎勵在客戶端完全沒有記錄
        scripted = any(
            isinstance(b, dict) and (b.get("startscript") or b.get("endscript"))
            for b in check.values()
        )

        need = items_of(end.get("item"))
        kill = mobs_of(end.get("mob"))          # 完成條件：打倒 N 隻某怪（79 個任務有）
        have = items_of(start.get("item"))      # 接受條件：身上要先有的道具（87 個）
        jobs = job_labels((start.get("job") or {}).values())
        # Check["0"].quest 的 state 決定它是前置還是互斥，不能全部當前置：
        #   2 = 那個任務要已完成、1 = 要正在進行中 → 真的是前置
        #   0（或沒寫 state）= 那個任務「不能接過」→ **互斥**
        # 五條「XX 之路」轉職任務兩兩互斥（26 筆），全當前置的話會印成
        # 「要先完成盜賊之路才能接戰士之路」，任務鏈還會把五條併成一條 6 步。
        prereq, exclude = [], []
        for e in (start.get("quest") or {}).values():
            if isinstance(e, dict) and "id" in e:
                (prereq if e.get("state") in (1, 2) else exclude).append(str(e["id"]))
        nxt = [
            str(stage["nextQuest"])
            for stage in act.values()
            if isinstance(stage, dict) and isinstance(stage.get("nextQuest"), int)
        ]

        used_items.update(i["id"] for i in need + rewards + give + have)
        used_mobs.update(m["id"] for m in kill)
        if npc_map_id is not None:
            used_maps.add(npc_map_id)

        entry = {
            "id": qid,
            "name": (meta.get("name") or f"#{qid}").strip(),
            "lv": start.get("lvmin") or 0,
            # lvmax：96 個任務有等級上限（例：#1034 只有 Lv.10 以下接得到）
            **({"lvMax": start["lvmax"]} if isinstance(start.get("lvmax"), int) else {}),
            # interval：9 個任務可以重複接，單位是分鐘（全部都是 1440＝一天一次）
            **({"repeat": start["interval"]} if isinstance(start.get("interval"), int) else {}),
            "released": released,
            "need": need,
            **({"kill": kill} if kill else {}),
            **({"have": have} if have else {}),
            **({"jobs": jobs} if jobs else {}),
            **({"exclude": exclude} if exclude else {}),
            "rewards": rewards,
            **({"skills": skills} if skills else {}),
            **({"give": give} if give else {}),
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
        # 地區：優先看顯示用 NPC 站在哪，他查不到地圖時退而找這個任務的其他 NPC
        # （例：#6101 老舊的書，接任務的懷玆不在已實裝地圖上，但交任務的那位在）。
        # 兩邊都查不到 = 這個任務的 NPC 全都沒實裝，region 留空。
        region = region_of(npc_map_id) if npc_map_id is not None else None
        if region is None:
            for other in located:
                region = region_of(named_map_of(other))
                if region:
                    break
        if region:
            entry["region"] = region
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
            ("money", money),
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

    mobs = {
        str(mid): ((mob_tbl.get(str(mid)) or {}).get("name") or f"#{mid}").strip()
        for mid in sorted(used_mobs)
    }
    # 技能名稱表的鍵是 Name（大寫 N），跟 Item/Mob/Map 的 name 不一樣
    skill_names = {
        str(sid): ((skill_tbl.get(str(sid)) or {}).get("Name") or f"#{sid}").strip()
        for sid in sorted(used_skills)
    }

    maps = {}
    for mp in sorted(used_maps):
        tbl = map_tbl.get(str(mp)) or {}
        wm = wm_of(mp)
        maps[str(mp)] = {
            "street": (tbl.get("streetName") or "").strip(),
            "name": (tbl.get("mapName") or f"#{mp}").strip(),
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

    # chips 的排列順序：TOWNS 的宣告順序（大致就是遊戲的地理／練功動線），
    # 不是任務數多寡——照數量排的話每次更新資料 chip 都會換位置，很難記
    used_regions = {q.get("region") for q in quests}
    regions = [r for r in dict.fromkeys(TOWNS.values()) if r in used_regions]

    out = {
        "quests": quests,
        "chains": chains,
        "items": items,
        "mobs": mobs,
        "skills": skill_names,
        "maps": maps,
        "regions": regions,
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
    regions = Counter(q.get("region") or "（未實裝）" for q in quests)
    print(f"NPC 所在地圖 {len(maps)} 張、世界地圖 {len(worldmap)} 張、地區 {len(regions)} 個")
    print("  " + "、".join(f"{r} {n}" for r, n in regions.most_common()))
    print(f"已寫入 {OUT}（{os.path.getsize(OUT) // 1024} KB）")


if __name__ == "__main__":
    main()
