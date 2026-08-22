"""世界地圖點位查詢：mapId → { s: 底圖名, x, y, a? }。

從 tools/extract-worldmap.py 產的 reference-data/worldmap.json 建索引，
給 build-site-data.py 與 build-quest-data.py 共用（兩條管線各自獨立，
但「地圖在世界地圖上的哪個點」這條規則只該有一份）。

規則：
- 同一張地圖出現在多張底圖時取層級最深的那張（奇幻村/廢礦等子圖 > 大陸圖 >
  世界總圖，因為總圖的點是整個大陸糊在一起）。
- 不在世界地圖上的隱藏圖/迷你地城，借「ID 最接近的鄰居」的點標約略位置（a=1）；
  共同前綴不足 6 碼就放棄（組隊任務/活動地圖連鄰居都沒有）。
"""

import os


def build_wm_lookup(wm_sheets):
    """回傳 wm_of(mapId) -> dict | None。"""

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

    return wm_of
