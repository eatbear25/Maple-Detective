"""從 maplestory.io 下載網站會用到的圖示到 public/icons/。

用法：python tools/download-icons.py
已存在的檔案會跳過，可重複執行。來源優先 TMS/209，404 時退回 GMS/62。
- 道具：public/icons/item/{itemId}.png
- 怪物：public/icons/mob/{mobId}.gif（站立動圖）
- 神秘商人 NPC：public/icons/npc/{npcId}.png（神秘商人模擬用）
- 任務 NPC：public/icons/npc/{npcId}.gif（站立動圖）

道具清單來自三處：monster-book.json（掉落查詢）、generated/quests.json（任務需求／獎勵／打怪）
與 generated/merchant.json（神秘商人模擬）。
"""

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(PROJECT, "public", "icons")
SOURCES = ["TMS/209", "GMS/62"]
HEADERS = {"User-Agent": "maple-detective/1.0 (fan site asset fetch)"}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


# 掉落表以外、頁面自己要用的道具圖示（掉落資料裡不會出現，得手動列）。
# 4001095–4001100：月妙的年糕第一階段的六色迎月花種子。
# 4001044–4001049、4001055：女神之塔最後一關的六片女神像碎片與生命草。
EXTRA_ITEMS = [
    4001095, 4001096, 4001097, 4001098, 4001099, 4001100,
    4001044, 4001045, 4001046, 4001047, 4001048, 4001049, 4001055,
]

MOB_STANCES = ["stand", "fly", "move"]  # 部分怪物（如純飛行怪）沒有 stand 動畫，依序退回

# 神秘商人模擬要用的 NPC sprite。官方活動圖寫「神秘商人—麥吉」，畫的就是勇士之村那位
# 戴斗笠、背著刀的麥吉（1022002），所以直接借他的站立圖。
# （以前的轉蛋模擬用 9110011/9110015 轉蛋機，圖還留在 public/icons/npc/ 沒刪。）
MERCHANT_NPCS = [1022002]


def download(kind, oid, path_tpl, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return None
    stances = MOB_STANCES if kind == "mob" else [None]
    for src in SOURCES:
        for stance in stances:
            tpl = path_tpl.format(id=oid, stance=stance) if stance else path_tpl.format(id=oid)
            try:
                data = fetch(f"https://maplestory.io/api/{src}/{tpl}")
                if data:
                    with open(dest, "wb") as f:
                        f.write(data)
                    return None
            except Exception:
                continue
    return (kind, oid)


def quest_data():
    """任務查詢頁用到的道具（需求+獎勵）、NPC 與怪物。

    build-quest-data.py 還沒跑過就回空集合。怪物是「完成條件要打倒的」，
    有 11 隻（小石球那種活動怪）不在怪物圖鑑的清單裡，所以要另外聯集進來。
    """
    path = os.path.join(PROJECT, "src", "data", "generated", "quests.json")
    if not os.path.exists(path):
        return set(), set(), set()
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    items = {int(iid) for iid in data["items"]}
    npcs = {q["npcId"] for q in data["quests"] if q.get("npcId")}
    mobs = set(data.get("mobs", {}))
    return items, npcs, mobs


def main():
    with open(os.path.join(PROJECT, "reference-data", "monster-book.json"), encoding="utf-8") as f:
        mobs = json.load(f)["mobs"]
    sup_path = os.path.join(PROJECT, "reference-data", "drop-supplement.json")
    sup_items = set()
    if os.path.exists(sup_path):
        with open(sup_path, encoding="utf-8") as f:
            sup_items = {i for k, v in json.load(f).items() if not k.startswith("_") for i in v}
    q_items, q_npcs, q_mobs = quest_data()
    sup_items |= q_items

    # 神秘商人的商品也要圖示；還沒 build 過就跳過，不擋掉落查詢的圖
    merchant_path = os.path.join(PROJECT, "src", "data", "generated", "merchant.json")
    merchant_items = set()
    if os.path.exists(merchant_path):
        with open(merchant_path, encoding="utf-8") as f:
            for pool in json.load(f)["pools"]:
                merchant_items |= {p["itemId"] for p in pool["prizes"]}

    os.makedirs(os.path.join(PUB, "item"), exist_ok=True)
    os.makedirs(os.path.join(PUB, "mob"), exist_ok=True)
    os.makedirs(os.path.join(PUB, "npc"), exist_ok=True)

    jobs = []
    for mob_id in sorted(set(mobs) | q_mobs):
        jobs.append(("mob", mob_id, "mob/{id}/render/{stance}", os.path.join(PUB, "mob", f"{mob_id}.gif")))
    items = {i for v in mobs.values() for i in v["rewards"]} | sup_items | merchant_items | set(EXTRA_ITEMS)
    for item_id in sorted(items):
        jobs.append(("item", item_id, "item/{id}/icon", os.path.join(PUB, "item", f"{item_id}.png")))
    for npc_id in MERCHANT_NPCS:
        jobs.append(("npc", npc_id, "npc/{id}/render/stand", os.path.join(PUB, "npc", f"{npc_id}.png")))
    for npc_id in sorted(q_npcs):
        jobs.append(("npc", npc_id, "npc/{id}/render/stand", os.path.join(PUB, "npc", f"{npc_id}.gif")))

    print(f"{len(jobs)} 個圖示要抓")
    with ThreadPoolExecutor(max_workers=8) as ex:
        misses = [m for m in ex.map(lambda j: download(*j), jobs) if m]

    print(f"完成，失敗 {len(misses)} 個")
    for kind, oid in misses:
        print(f"  MISS {kind} {oid}")


if __name__ == "__main__":
    main()
