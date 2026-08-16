"""把 monster-book.json + 名稱表 + 怪物數值組裝成網站用的資料檔。

用法：python tools/build-site-data.py
輸入：reference-data/monster-book.json、name-tables/*、mob-stats.json、
      worldmap.json（tools/extract-worldmap.py）、name-supplement.json、
      map-supplement.json、drop-supplement.json、equip-info.json（後四者可選）
輸出：src/data/generated/monster-drops.json
    {
      "items":       { itemId: 中文名 },               // 實裝道具（Item.json 有名字）
      "futureItems": { itemId: 中文名 },               // 未實裝道具（name-supplement）
      "maps":        { mapId: { street, name, wm? } }, // 客戶端有名字的地圖
      "futureMaps":  { mapId: { street, name, wm? } }, // 未實裝地圖（map-supplement）
      "worldmap":    { sheet: { title, w, h, spots: [[x,y]...] } },
                     // 世界地圖底圖（public/worldmap/<sheet>.png）；spots = 該圖
                     // 全部點位座標，讓怪物頁彈窗畫出完整地圖（不只該怪的出沒點）
      "monsters":    [ { id, name, level|null, released,
                         maps, drops, futureDrops, stats } ]   // 依等級排序
    }
輸出：src/data/generated/item-info.json（道具 hover 彈窗用，只含實裝道具）
輸出：src/data/generated/worldmap-nav.json（地圖導覽頁用：每張世界地圖的
    全部點位 + 每個點位地圖清單 + 各地圖出沒怪物反查）
    {
      "sheets":   { sheet: { title, parent, w, h, links, spots: [
                     { x, y, maps: [mapId...], near?: [mapId...] } ] } },
                  // near = 借這個點標約略位置的隱藏地圖/迷你地城
      "mapNames": { mapId: { street, name, released? } },  // 點位上所有地圖
      "mobsByMap":{ mapId: [mobId...] }  // 怪物資訊從 monster-drops.json 查
    }

世界地圖點位（wm，2026-08-16 取代原本的地區分類——ID 前綴推地區在維多利亞
    整個對不上，詳見 git log）：
    wm = { s: 圖名, x, y, a? }，座標原點在底圖中心。優先用精準點位；
    隱藏地圖/迷你地城等不在遊戲世界地圖上的，找「ID 最接近的鄰居」的點位
    （9 碼補零後共同前綴 ≥6，取差距最小者）標約略位置（a=1）；
    組隊任務/活動地圖連鄰居都沒有就不給 wm。
    同一地圖出現在多張圖時，取層級最深的（大陸子圖 > 大陸圖 > 世界總圖）。

實裝判斷（2026-08-16 修正）：
    「怪物 ID 在 Mob.json」不夠——客戶端名稱表涵蓋全部舊 wz 怪物，包括未開放
    大陸（天空之城、玩具城…）的怪。正確判斷是**出沒地圖有沒有進目前客戶端**：
    released = mid 在 Mob.json 且 ≥1 張出沒地圖在客戶端 Map.json 有名字。
    道具實裝判斷不變：itemId 在 Item.json。未實裝內容進「未來視」分頁。

人工補充（drop-supplement.json）：
    客戶端圖鑑沒記錄、但實際遊戲確認會掉的道具（例：超級綠水靈掉黏稠稠鞋子），
    格式 { mobId: [itemId...] }，合併進該怪的掉落清單。
"""

import json
import os
import re

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT = os.path.join(PROJECT, "src", "data", "generated", "monster-drops.json")
OUT_INFO = os.path.join(PROJECT, "src", "data", "generated", "item-info.json")
OUT_NAV = os.path.join(PROJECT, "src", "data", "generated", "worldmap-nav.json")

# 網站顯示用的數值欄位（wz 原始欄位名；elemAttr 是屬性字串如 F3I1）
STAT_FIELDS = [
    "maxHP", "maxMP", "exp",
    "PADamage", "MADamage", "PDDamage", "MDDamage",
    "acc", "eva", "boss",
]


def load(*parts):
    path = os.path.join(REF, *parts)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    book = load("monster-book.json")["mobs"]
    item_tbl = load("name-tables", "Item.json")
    mob_tbl = load("name-tables", "Mob.json")
    map_tbl = load("name-tables", "Map.json")
    desc_tbl = load("name-tables", "MonsterBook.json")  # 圖鑑描述，等級 fallback
    stats_tbl = load("mob-stats.json").get("mobs", {})  # tools/extract-mob-stats.py
    supplement = load("name-supplement.json")  # 未實裝 mob/item 名稱（maplestory.io）
    sup_items = supplement.get("items", {})
    sup_mobs = supplement.get("mobs", {})
    map_sup = load("map-supplement.json")  # 未實裝地圖名稱（tools/fetch-map-names.py）
    drop_sup = {k: v for k, v in load("drop-supplement.json").items() if not k.startswith("_")}
    wm_sheets = load("worldmap.json").get("sheets", {})  # tools/extract-worldmap.py

    def client_named(mp):
        return bool((map_tbl.get(str(mp)) or {}).get("mapName"))

    # mapId → { s: 圖名, x, y }。同地圖出現在多張圖時取層級最深的
    # （奇幻村/廢礦等子圖 > 大陸圖 > 世界總圖，總圖的點是整個大陸糊在一起）。
    def sheet_depth(name):
        d = 0
        while name and wm_sheets.get(name, {}).get("parent"):
            name = wm_sheets[name]["parent"]
            d += 1
        return d

    spot_of = {}
    for sname, sheet in sorted(wm_sheets.items(), key=lambda kv: sheet_depth(kv[0])):
        for spot in sheet["spots"]:
            for mp in spot["maps"]:
                spot_of[mp] = {"s": sname, "x": spot["x"], "y": spot["y"]}

    spot_ids = sorted(spot_of)

    def wm_of(mp):
        """精準點位；沒有就借「ID 最接近的鄰居」的點標約略位置（a=1）。"""
        if mp in spot_of:
            return spot_of[mp]
        pad = str(mp).zfill(9)
        best, best_key = None, (0, float("-inf"))
        for sid in spot_ids:
            common = len(os.path.commonprefix([pad, str(sid).zfill(9)]))
            key = (common, -abs(mp - sid))
            if key > best_key:
                best, best_key = sid, key
        if best is None or best_key[0] < 6:
            return None
        return {**spot_of[best], "a": 1}

    def level_of(mid):
        st = stats_tbl.get(mid)
        if st and isinstance(st.get("level"), int):
            return st["level"]
        m = re.search(r"Lv[.。]?\s*(\d+)", desc_tbl.get(mid, ""))
        return int(m.group(1)) if m else None

    monsters = []
    used_items = set()
    used_future_items = set()
    used_maps = set()
    for mid, entry in book.items():
        named_maps = [mp for mp in entry["maps"] if client_named(mp)]
        released = mid in mob_tbl and len(named_maps) > 0
        name = mob_tbl[mid]["name"] if mid in mob_tbl else sup_mobs.get(mid, f"#{mid}")
        rewards = list(entry["rewards"]) + [i for i in drop_sup.get(mid, [])]
        drops, future = [], []
        for iid in rewards:
            if str(iid) in item_tbl:
                if iid not in drops:
                    drops.append(iid)
            elif iid not in future:
                future.append(iid)
        used_items.update(drops)
        used_future_items.update(future)
        used_maps.update(entry["maps"])

        st = stats_tbl.get(mid, {})
        stats = {k: st[k] for k in STAT_FIELDS if isinstance(st.get(k), int)}
        if isinstance(st.get("elemAttr"), str) and st["elemAttr"]:
            stats["elemAttr"] = st["elemAttr"]

        monsters.append(
            {
                "id": mid,
                "name": name,
                "level": level_of(mid),
                "released": released,
                "maps": entry["maps"],
                "drops": drops,
                "futureDrops": future,
                "stats": stats,
            }
        )
    monsters.sort(key=lambda m: (m["level"] is None, m["level"] or 0, int(m["id"])))

    items = {str(iid): item_tbl[str(iid)]["name"] for iid in sorted(used_items)}
    future_items = {str(iid): sup_items.get(str(iid), f"#{iid}") for iid in sorted(used_future_items)}

    maps, future_maps = {}, {}
    for mp in sorted(used_maps):
        entry = map_tbl.get(str(mp))
        wm = wm_of(mp)
        if entry and entry.get("mapName"):
            maps[str(mp)] = {
                "street": (entry.get("streetName") or "").strip(),
                "name": entry["mapName"].strip(),
                **({"wm": wm} if wm else {}),
            }
        elif str(mp) in map_sup:
            future_maps[str(mp)] = {
                **map_sup[str(mp)],
                **({"wm": wm} if wm else {}),
            }

    used_sheets = {
        info["wm"]["s"] for info in [*maps.values(), *future_maps.values()] if "wm" in info
    }
    worldmap = {
        sname: {
            "title": wm_sheets[sname]["title"],
            "w": wm_sheets[sname]["size"][0],
            "h": wm_sheets[sname]["size"][1],
            # 該圖全部點位（怪物頁彈窗拿來畫背景點，不然整張圖只有零星幾點很空）
            "spots": [[sp["x"], sp["y"]] for sp in wm_sheets[sname]["spots"]],
        }
        for sname in sorted(used_sheets)
    }

    out = {
        "items": items,
        "futureItems": future_items,
        "maps": maps,
        "futureMaps": future_maps,
        "worldmap": worldmap,
        "monsters": monsters,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    # 道具彈窗資料：desc（Item.json）+ 裝備數值（equip-info.json）
    equips = load("equip-info.json").get("equips", {})
    item_info = {}
    for iid in sorted(used_items):
        entry = {}
        desc = item_tbl[str(iid)].get("desc")
        if desc:
            entry["desc"] = desc.replace("\\n", "\n").replace("\\r", "")
        eq = equips.get(str(iid))
        if eq:
            entry["eq"] = eq
        if entry:
            item_info[str(iid)] = entry
    with open(OUT_INFO, "w", encoding="utf-8") as f:
        json.dump(item_info, f, ensure_ascii=False, separators=(",", ":"))

    # 地圖導覽頁資料：每張世界地圖的全部點位 + 地圖名稱 + 出沒怪物反查
    mobs_by_map = {}
    for mid, entry in book.items():
        for mp in entry["maps"]:
            mobs_by_map.setdefault(str(mp), []).append(mid)

    # 標約略位置的隱藏地圖掛回它借用的點（near），地圖導覽才找得到牠們的怪
    near_by_spot = {}
    for mp in sorted(used_maps):
        wm = wm_of(mp)
        if wm and wm.get("a"):
            near_by_spot.setdefault((wm["s"], wm["x"], wm["y"]), []).append(mp)

    def map_name_entry(mp):
        entry = map_tbl.get(str(mp))
        if entry and entry.get("mapName"):
            return {
                "street": (entry.get("streetName") or "").strip(),
                "name": entry["mapName"].strip(),
                "released": 1,
            }
        if str(mp) in map_sup:
            return dict(map_sup[str(mp)])
        return {"street": "", "name": f"#{mp}"}

    nav_sheets, map_names = {}, {}
    for sname, sheet in wm_sheets.items():
        spots_out = []
        for spot in sheet["spots"]:
            # 客戶端來源資料本身在少數點位重複列了同一 mapId（例：211000100），這裡去重避免前端渲染出重複 key
            spot_maps = list(dict.fromkeys(spot["maps"]))
            s_out = {"x": spot["x"], "y": spot["y"], "maps": spot_maps}
            near = near_by_spot.get((sname, spot["x"], spot["y"]))
            if near:
                s_out["near"] = near
            spots_out.append(s_out)
            for mp in [*spot_maps, *(near or [])]:
                map_names.setdefault(str(mp), map_name_entry(mp))
        nav_sheets[sname] = {
            "title": sheet["title"],
            "parent": sheet.get("parent"),
            "w": sheet["size"][0],
            "h": sheet["size"][1],
            "links": sheet.get("links") or [],
            "spots": spots_out,
        }
    nav_out = {
        "sheets": nav_sheets,
        "mapNames": map_names,
        "mobsByMap": {k: v for k, v in mobs_by_map.items() if k in map_names},
    }
    with open(OUT_NAV, "w", encoding="utf-8") as f:
        json.dump(nav_out, f, ensure_ascii=False, separators=(",", ":"))

    n_released = sum(1 for m in monsters if m["released"])
    all_infos = [*maps.values(), *future_maps.values()]
    n_exact = sum(1 for i in all_infos if "wm" in i and "a" not in i["wm"])
    n_approx = sum(1 for i in all_infos if "wm" in i and "a" in i["wm"])
    print(f"怪物 {len(monsters)}（實裝 {n_released}、未來視 {len(monsters) - n_released}、有等級 {sum(1 for m in monsters if m['level'] is not None)}）")
    print(f"道具 實裝 {len(items)} / 未實裝 {len(future_items)} 種、地圖 具名 {len(maps)} + 補充 {len(future_maps)} / {len(used_maps)}")
    print(f"人工補充掉落 {sum(len(v) for v in drop_sup.values())} 筆（{len(drop_sup)} 隻怪）")
    print(f"世界地圖點位：精準 {n_exact}、約略 {n_approx}、沒有 {len(all_infos) - n_exact - n_approx}（用到 {len(worldmap)} 張圖）")
    n_unnamed = sum(1 for v in map_names.values() if v["name"].startswith("#"))
    print(f"地圖導覽：{len(nav_sheets)} 張圖、{sum(len(s['spots']) for s in nav_sheets.values())} 個點、{len(map_names)} 張地圖（無名 {n_unnamed}）、有怪 {len(nav_out['mobsByMap'])}")
    print(f"已寫入 {OUT}（{os.path.getsize(OUT) // 1024} KB）、{OUT_INFO}（{os.path.getsize(OUT_INFO) // 1024} KB）、{OUT_NAV}（{os.path.getsize(OUT_NAV) // 1024} KB）")


if __name__ == "__main__":
    main()
