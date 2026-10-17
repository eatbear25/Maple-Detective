"""把 quest.json + npc-map.json + 名稱表組裝成任務查詢頁用的資料檔。

用法：python tools/build-quest-data.py
輸入：reference-data/quest.json（tools/extract-quest.py）、npc-map.json（同上）、
      name-tables/{Item,Npc,Map}.json、equip-info.json、worldmap.json
輸出：src/data/generated/quests.json
    {
      "quests":   [ { id, name, series?, lv, npc?, npcId?, npcMap?, released,
                      region?, lvMax?, repeat?, need, kill?, have?, jobs?,
                      rewards, give?, exp?, money?, cost?, pop?, skill?,
                      scripted?, sup?, prereq, needQ?, ev?, f? } ],
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
                  // needQ    = 交任務前要先完成的任務（母任務等子任務做完）
                  // ev       = 活動期間 ["YYYY-MM-DDTHH:MM", ...]（有這欄的 region = 活動）
                  // 依 lv 排序；need/rewards = [{ id, n }]；f = flows 索引
      "flows":    [ [block...] ],   // 任務流程，格式見 build_flows()
      "items":    { itemId: { name, desc?, eq? } },   // 任務用到的全部道具
      "mobs":     { mobId: 中文名 },   // 完成條件要打的怪
      "skills":   { skillId: 中文名 },  // 技能獎勵
      "maps":     { mapId: { street, name, wm? } },   // NPC 所在地
      "regions":  [ 地區名... ],   // 地區 chips 的順序（TOWNS 宣告順序）
      "worldmap": { sheet: { title, w, h, spots: [[x,y]...] } }
    }

## 實裝判斷

任務的 NPC 有沒有站在「客戶端 Map.json 有名字」的地圖上。
released = 至少一個 NPC 查得到具名地圖。2026-08 的實測分佈：全部實裝 296、部分 28、
完全沒有 166 —— 定案是「296+28 算現行版本，只有 166 掛未實裝徽章」，
所以這裡用 any() 而不是 all()。2026-10-17 重抽後變成 493／4／16：
客戶端把還沒開放的 197 個任務（4 轉、菇菇王國、瑪加提亞…）整批拿掉了。

## 任務流程

有前後關聯的任務整串排成一條「流程」（2026-10-17 改，原本叫任務鏈、而且照系列名切段，
#2083 伊卡路斯的滑翔翼前後的任務都被切掉了）。邊怎麼來見 flow_edges()，
怎麼排成「主線＋分岔框」見 build_flows()；排完存進 flows，任務只帶索引 f。
tools/check-quest-data.py 會把流程攤平，確認每個前置都排在前面、沒有斷線。

## 系統任務

客戶端有 57 個遊戲內看不到的任務（台詞旗標、菇菇通行證的確認用任務…），
不輸出，規則見 is_hidden()。

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


# 職業轉職五選一：客戶端沒有寫互斥（靠「只限初心者」間接擋掉——轉完職就不是初心者了），
# 流程上不標的話會被讀成「五個都可以做」
EXCLUSIVE_SETS = [{"1049", "1050", "1051", "1052", "1053"}]


def flow_edges(quests, end_req):
    """任務之間「誰要排在誰前面」的邊，回傳 pred：{questId: {前一步 questId}}。

    三種來源：
    1. Check["0"].quest 的 state 1/2（前置；1 = 那個任務接了就行、2 = 要完成）
    2. Act 的 nextQuest（86/87 筆跟 1 重複，自己指向自己的 #2066 丟掉）
    3. **Check["1"].quest**：「交任務時要先完成別的任務」。兩種長相：
       - 母任務＋子任務（謠言的真相、巨居蟹的祭品…）：子任務的前置是「母任務進行中」，
         母任務要等子任務都做完才能交。這時不能畫「子任務 → 母任務」（會成環），
         改成「子任務 → 接在母任務後面的任務」——少了這條，#2145 調查木妖會跟五個
         子任務排在同一層，看起來像不用等子任務做完
       - 單純要求（維多利亞探險者要先完成兩個探險家任務）：畫「要求的任務 → 本任務」
    """
    ids = {q["id"] for q in quests}
    pred = {q["id"]: set() for q in quests}
    after_done = defaultdict(set)  # 母任務 → 要等它「完成」才能接的任務
    for q in quests:
        for p in q["prereq"]:
            if p in ids and p != q["id"]:
                pred[q["id"]].add(p)
                if p not in q.get("inProg", ()):
                    after_done[p].add(q["id"])
        for n in q["next"]:
            if n in ids and n != q["id"]:
                pred[n].add(q["id"])
                after_done[q["id"]].add(n)

    def reaches(a, b):
        stack, seen = [a], {a}
        while stack:
            x = stack.pop()
            if x == b:
                return True
            for y in ids:
                if x in pred[y] and y not in seen:
                    seen.add(y)
                    stack.append(y)
        return False

    for parent_q, reqs in end_req.items():
        if parent_q not in ids:
            continue
        for r in reqs:
            if r not in ids or r == parent_q or r in pred[parent_q]:
                continue
            if reaches(parent_q, r):
                for s in after_done[parent_q]:
                    if s != r:
                        pred[s].add(r)
            else:
                pred[parent_q].add(r)
    return pred


def build_flows(quests, pred, excludes, end_req):
    """把有關聯的任務排成「任務流程」，回傳 [blocks]（兩個任務以上的才留）。

    以前的做法是「有系列名就照系列名切」，結果 #2083 伊卡路斯的滑翔翼（沒系列名）
    跟它的前置「好無聊」（有系列名）、後續「伊卡路斯與飛天藥水」被切成三段，
    玩家看不到整條線（2026-10-17 回報）。現在**整個連通元件就是一條流程**，
    系列名只拿來當標題。

    元件不一定是一直線（18/66 條有分岔），所以排成「主線＋框」：
      block = "questId"                         主線上的一步
            | {"k": "all"|"one"|"split", "lines": [[block...]...]}
                  也算一步。all = 這幾條都要做完（順序不拘）、one = 擇一、
                  split = 從這裡分成好幾條線，各走各的
            | {"k": "also"|"side", "lines": [...]}
                  不算一步，掛在主線旁邊。also = 另外也要先完成（匯進主線）、
                  side = 從主線分出去的支線
    分岔的幾條線裡有一條**明顯最長**的話（其他都比它短），它就升格成主線、
    其他的進 also/side 框；一樣長（五個子任務、五條 XX 之路）就整組框起來：
    - 會匯合、或全部是前一步的子任務（母任務要等它們做完才能交，#2208 巴勒圖的委託）→ all
    - 兩兩互斥 → one
    - 其他 → split
    **互斥但長短不一的不算擇一**：#3069 遺失的食人花汁寫了「接過 #3048 就不能接」，
    但它是道具弄丟時的補救任務，不是劇情分歧；標成擇一會被讀成「二選一的結局」。

    做法：先做遞移化簡（#2201 打敗骷髏的前置寫了 2199 和 2200，但 2200 本來就接在
    2199 後面，不化簡就會多出一個假分岔），再從起點往下走：
    - 只有一個起點 → 主線一步
    - 好幾個起點，而且會匯到同一個任務 J → J 之前的部分各自成一條線（all/also），J 接主線
    - 好幾個起點、各走各的 → 各自成一條線（one/split/side），結束
    """
    ids = set(pred)
    succ = defaultdict(set)
    for q, ps in pred.items():
        for p in ps:
            succ[p].add(q)

    # 拓撲序（同層取 id 小的先），順便確認沒有環
    indeg = {q: len(pred[q]) for q in ids}
    ready = sorted((q for q in ids if indeg[q] == 0), key=int)
    topo = []
    while ready:
        cur = ready.pop(0)
        topo.append(cur)
        for nxt in succ[cur]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                ready.append(nxt)
        ready.sort(key=int)
    if len(topo) != len(ids):
        raise SystemExit(f"任務關聯有環：{sorted(ids - set(topo), key=int)}")
    order = {q: i for i, q in enumerate(topo)}

    def reach(x, within):
        """x 自己＋在 within 裡走得到的全部任務"""
        out, stack = {x}, [x]
        while stack:
            for y in succ[stack.pop()]:
                if y in within and y not in out:
                    out.add(y)
                    stack.append(y)
        return out

    # 遞移化簡：p→q 若另有一條 p→…→q 的路就拿掉
    for p in topo:
        for q in list(succ[p]):
            if any(q in reach(o, ids) for o in succ[p] if o != q):
                succ[p].discard(q)
                pred[q].discard(p)

    def ancestors(x, within):
        out, stack = set(), [x]
        while stack:
            for y in pred[stack.pop()]:
                if y in within and y not in out:
                    out.add(y)
                    stack.append(y)
        return out

    def components(nodes):
        nodes, out = set(nodes), []
        while nodes:
            comp, stack = set(), [min(nodes, key=order.get)]
            while stack:
                x = stack.pop()
                if x in comp:
                    continue
                comp.add(x)
                stack += [y for y in pred[x] | succ[x] if y in nodes and y not in comp]
            nodes -= comp
            out.append(comp)
        return sorted(out, key=lambda c: min(order[x] for x in c))

    def size(blocks):
        return sum(1 if isinstance(b, str) else sum(size(l) for l in b["lines"]) for b in blocks)

    def exclusive(heads):
        def ex(a, b):
            return b in excludes.get(a, ()) or a in excludes.get(b, ()) or any(
                a in s and b in s for s in EXCLUSIVE_SETS
            )
        return all(ex(a, b) for i, a in enumerate(heads) for b in heads[i + 1 :])

    def group(lines, merge, heads):
        """多條線 → blocks。merge = 這些線之後會匯合。"""
        if len(lines) == 1:
            return lines[0]
        sizes = sorted((size(l) for l in lines), reverse=True)
        if sizes[0] > sizes[1]:
            main = max(lines, key=size)
            rest = [l for l in lines if l is not main]
            # 匯合型：支線框放在匯合點前面；分岔型：放在分岔點後面
            return main + [{"k": "also", "lines": rest}] if merge else [{"k": "side", "lines": rest}] + main
        if merge:
            return [{"k": "all", "lines": lines}]
        # 全部是同一個母任務的子任務（母任務交件前要先做完的）
        parents = set.intersection(*(pred[h] for h in heads))
        members = {x for l in lines for x in flow_ids(l)}
        if any(members <= set(end_req.get(p, ())) for p in parents):
            return [{"k": "all", "lines": lines}]
        if exclusive(heads):
            return [{"k": "one", "lines": lines}]
        return [{"k": "split", "lines": lines}]

    def layout(nodes):
        nodes, blocks = set(nodes), []
        while nodes:
            srcs = sorted((x for x in nodes if not (pred[x] & nodes)), key=order.get)
            if len(srcs) == 1:
                blocks.append(srcs[0])
                nodes.discard(srcs[0])
                continue
            down = {s: reach(s, nodes) for s in srcs}
            common = set.intersection(*down.values())
            if common:
                join = min(common, key=order.get)
                rest = reach(join, nodes)
                parts = components(nodes - rest)
                lines = [layout(p) for p in parts]
                heads = [min(p, key=order.get) for p in parts]
                blocks += group(lines, True, heads)
                nodes = rest
                continue
            # 各走各的：起點之間有共同後代的併成同一條線
            clusters = []
            for s in srcs:
                hit = [c for c in clusters if any(down[s] & down[t] for t in c)]
                merged = [s] + [t for c in hit for t in c]
                clusters = [c for c in clusters if c not in hit] + [merged]
            if len(clusters) == 1:
                # 沒辦法乾淨拆開（目前資料沒有這種形狀）→ 照拓撲序平鋪，至少不漏
                blocks += sorted(nodes, key=order.get)
                break
            regions = sorted(
                (set().union(*(down[s] for s in c)) for c in clusters),
                key=lambda r: min(order[x] for x in r),
            )
            lines = [layout(r) for r in regions]
            heads = [min(r, key=order.get) for r in regions]
            blocks += group(lines, False, heads)
            break
        return blocks

    flows = [layout(c) for c in components(ids) if len(c) > 1]
    flows.sort(key=lambda f: min(int(x) for x in flow_ids(f)))
    return flows


def walk_blocks(blocks):
    """全部 block（含框裡面的），給統計與檢查用"""
    for b in blocks:
        yield b
        if not isinstance(b, str):
            for line in b["lines"]:
                yield from walk_blocks(line)


def flow_ids(blocks):
    for b in blocks:
        if isinstance(b, str):
            yield b
        else:
            for line in b["lines"]:
                yield from flow_ids(line)


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
    # 2026-10-15 開放。兩個主城畫在同一張「冰原雪域」大陸圖上，靠「離哪個近」自動分
    200000000: "天空之城",
    211000000: "冰原雪域",
}

# 活動任務（客戶端 Check["0"] 帶 start/end 日期的）不照地理分，獨立一個 chip：
# 萬聖節那串 75 個任務的 NPC 散在冰原雪域、天空之城跟活動專用地圖上，
# 照地理分會把冰原雪域的 chip 灌成三分之二都是活動任務
EVENT_REGION = "活動"

MAP_REGION_OVERRIDE = {
    # 詛咒之林：惡靈森林任務鏈的其他五步都在魔法森林（潘喜/艾溫/漢斯），
    # 但這張是隱藏地圖、世界地圖上沒有點，ID 前綴 910 又會被推去自由市場入口
    910100000: "魔法森林",
    910100001: "魔法森林",
    # 卡伊琳的訓練場：海盜轉職教官卡伊琳的地方，在鯨魚號上
    912010200: "鯨魚號",
    # 隱藏研究室：「冒險家的戒指」的前一步（#69095）在魔法森林的 101020006 進去
    876009611: "魔法森林",
    # 艾利傑的庭園：天空之城史菲魯納那條線（#3111~3114）的最後兩步
    920020000: "天空之城",
}

# 不上網站的任務。遊戲內也看不到，規則見 is_hidden()
HIDDEN_IDS = {"9999"}  # 開發測試用


def is_hidden(qid, name, start, info):
    """遊戲內看不到的系統任務（2026-10-17 的客戶端多了 60 個）：
    - 沒有中文名：#9250~9254、#506441 這種，客戶端 QuestData 沒登記
    - 等級 9999：「萬聖節台詞顯示用任務」，給 NPC 換台詞用的旗標
    - info.disableAtNPC：NPC 不會給（「菇菇通行證參與確認用」「楓葉商會硬幣(隱藏任務)」）
    - info.disableAtStartTab 加 disableAtPerformTab：任務視窗的「可接」「進行中」都不顯示
    """
    return (
        qid in HIDDEN_IDS
        or not name
        or (start.get("lvmin") or 0) >= 9999
        or bool(info.get("disableAtNPC"))
        or bool(info.get("disableAtStartTab") and info.get("disableAtPerformTab"))
    )


def event_period(start):
    """活動任務的期間 [開始, 結束]（"YYYY-MM-DDTHH:MM"），不是活動就 None。

    客戶端格式是 YYYYMMDDHH 或 YYYYMMDDHHMM（菇菇通行證的說明文字寫「10月14日下午11時59分」，
    對應 end = 202610142359）。**2020 年以前的日期不算**：#2147、#2208 那批是舊版活動
    （2007、2008 年元旦）殘留的設定，經典版不見得有在檢查，標上去只會讓人以為接不到。
    """

    def parse(v):
        if not isinstance(v, str) or len(v) not in (10, 12) or not v.isdigit():
            return None
        v = v.ljust(12, "0")
        return f"{v[0:4]}-{v[4:6]}-{v[6:8]}T{v[8:10]}:{v[10:12]}"

    s, e = parse(start.get("start")), parse(start.get("end"))
    if not (s or e) or (e or s) < "2020":
        return None
    return [s, e]


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
    end_req = {}  # Check["1"].quest：交任務前要先完成的任務（建流程用）
    used_items, used_maps, used_mobs, used_skills = set(), set(), set(), set()
    full = partial = none = 0
    hidden = []

    for qid in sorted(check_tbl, key=int):
        check = check_tbl[qid]
        act = act_tbl.get(qid, {})
        meta = strings.get(qid, {})
        start = check.get("0") or {}
        end = check.get("1") or {}
        if is_hidden(qid, (meta.get("name") or "").strip(), start, info_tbl.get(qid) or {}):
            hidden.append(qid)
            continue

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
        prereq, exclude, in_prog = [], [], []
        for e in (start.get("quest") or {}).values():
            if isinstance(e, dict) and "id" in e:
                (prereq if e.get("state") in (1, 2) else exclude).append(str(e["id"]))
                if e.get("state") == 1:
                    in_prog.append(str(e["id"]))
        nxt = [
            str(stage["nextQuest"])
            for stage in act.values()
            if isinstance(stage, dict) and isinstance(stage.get("nextQuest"), int)
        ]
        # 交任務前要先完成的任務（Check["1"].quest，16 個任務）。state 1 的那筆
        # （#2048 要求 #2047 進行中）不是先後關係，不收。跟前置重複的（瑞恩的測驗）也不顯示
        done_first = [
            str(e["id"])
            for e in (end.get("quest") or {}).values()
            if isinstance(e, dict) and "id" in e and e.get("state") == 2
        ]
        if done_first:
            end_req[qid] = done_first
        need_q = [x for x in done_first if x not in prereq]

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
            **({"inProg": in_prog} if in_prog else {}),
            **({"needQ": need_q} if need_q else {}),
            "next": nxt,
        }
        period = event_period(start)
        if period:
            entry["ev"] = period
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
        if released and period:
            region = EVENT_REGION
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

    excludes = {q["id"]: set(q.get("exclude") or ()) for q in quests}
    flows = build_flows(quests, flow_edges(quests, end_req), excludes, end_req)
    flow_of = {qid: idx for idx, flow in enumerate(flows) for qid in flow_ids(flow)}
    for q in quests:
        if q["id"] in flow_of:
            q["f"] = flow_of[q["id"]]
        del q["next"]  # 只是建流程用的中間欄位，前端拿 flows 就好
        q.pop("inProg", None)  # 同上

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
    # 「活動」排在地理地區後面（前端再把「未實裝」接在最後）
    used_regions = {q.get("region") for q in quests}
    regions = [r for r in [*dict.fromkeys(TOWNS.values()), EVENT_REGION] if r in used_regions]

    out = {
        "quests": quests,
        "flows": flows,
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
    print(f"隱藏 {len(hidden)} 個系統任務（沒有中文名／等級 9999／NPC 不給／任務視窗不顯示）")
    shapes = Counter(b["k"] for f in flows for b in walk_blocks(f) if not isinstance(b, str))
    print(f"任務流程 {len(flows)} 條（最大 {max((len(list(flow_ids(f))) for f in flows), default=0)} 個任務）、"
          f"入流程任務 {len(flow_of)}；分岔框 {dict(shapes)}")
    print(f"道具 {len(items)} 種（有中文名 {named_items}、有說明 {sum(1 for v in items.values() if 'desc' in v)}）")
    regions = Counter(q.get("region") or "（未實裝）" for q in quests)
    print(f"NPC 所在地圖 {len(maps)} 張、世界地圖 {len(worldmap)} 張、地區 {len(regions)} 個")
    print("  " + "、".join(f"{r} {n}" for r, n in regions.most_common()))
    print(f"已寫入 {OUT}（{os.path.getsize(OUT) // 1024} KB）")


if __name__ == "__main__":
    main()
