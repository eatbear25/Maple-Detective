"""從 maplestory.io 下載網站會用到的圖示到 public/icons/。

用法：python tools/download-icons.py
已存在的檔案會跳過，可重複執行。來源優先 TMS/209，404 時退回 GMS/62。
- 道具：public/icons/item/{itemId}.png
- 怪物：public/icons/mob/{mobId}.gif（站立動圖）
- NPC：public/icons/npc/{npcId}.png（轉蛋模擬器的轉蛋機圖）

道具清單來自兩處：monster-book.json（掉落查詢）與 generated/gacha.json（轉蛋模擬）。
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


MOB_STANCES = ["stand", "fly", "move"]  # 部分怪物（如純飛行怪）沒有 stand 動畫，依序退回

# 轉蛋模擬器要用的轉蛋機 sprite。9110011 是遊戲截圖裡那台（機身有紅楓葉），
# 其他城鎮版本外觀相同，只多抓一台超級轉蛋機備用。
# 注意：遊戲內 UI 用的是高解析抗鋸齒版，跟這裡的 NPC sprite 不是同一張。
GACHA_NPCS = [9110011, 9110015]


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


def main():
    with open(os.path.join(PROJECT, "reference-data", "monster-book.json"), encoding="utf-8") as f:
        mobs = json.load(f)["mobs"]
    sup_path = os.path.join(PROJECT, "reference-data", "drop-supplement.json")
    sup_items = set()
    if os.path.exists(sup_path):
        with open(sup_path, encoding="utf-8") as f:
            sup_items = {i for k, v in json.load(f).items() if not k.startswith("_") for i in v}

    # 轉蛋獎品也要圖示；轉蛋資料還沒 build 過就跳過，不擋掉落查詢的圖
    gacha_path = os.path.join(PROJECT, "src", "data", "generated", "gacha.json")
    gacha_items, gacha_mobs = set(), set()
    if os.path.exists(gacha_path):
        with open(gacha_path, encoding="utf-8") as f:
            for pool in json.load(f)["pools"]:
                for p in pool["prizes"]:
                    # 只抓「實際要顯示的圖」。61 個台服專屬獎品自己沒有圖，
                    # 抓它們自己的 ID 只會每次重跑都失敗 61 次，所以走 icon 欄位就好。
                    icon = p.get("icon")
                    if not icon:
                        continue
                    # monster-book 的 mob key 是字串，統一成字串才能取聯集
                    if icon["kind"] == "mob":
                        gacha_mobs.add(str(icon["id"]))
                    else:
                        gacha_items.add(icon["id"])

    os.makedirs(os.path.join(PUB, "item"), exist_ok=True)
    os.makedirs(os.path.join(PUB, "mob"), exist_ok=True)
    os.makedirs(os.path.join(PUB, "npc"), exist_ok=True)

    jobs = []
    for mob_id in sorted(set(mobs) | gacha_mobs):
        jobs.append(("mob", mob_id, "mob/{id}/render/{stance}", os.path.join(PUB, "mob", f"{mob_id}.gif")))
    items = {i for v in mobs.values() for i in v["rewards"]} | sup_items | gacha_items
    for item_id in sorted(items):
        jobs.append(("item", item_id, "item/{id}/icon", os.path.join(PUB, "item", f"{item_id}.png")))
    for npc_id in GACHA_NPCS:
        jobs.append(("npc", npc_id, "npc/{id}/render/stand", os.path.join(PUB, "npc", f"{npc_id}.png")))

    print(f"{len(jobs)} 個圖示要抓")
    with ThreadPoolExecutor(max_workers=8) as ex:
        misses = [m for m in ex.map(lambda j: download(*j), jobs) if m]

    print(f"完成，失敗 {len(misses)} 個")
    for kind, oid in misses:
        print(f"  MISS {kind} {oid}")


if __name__ == "__main__":
    main()
