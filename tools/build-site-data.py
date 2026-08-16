"""把 monster-book.json + 名稱表組裝成網站用的資料檔。

用法：python tools/build-site-data.py
輸入：reference-data/monster-book.json、name-tables/*、equip-info.json（可選）
輸出：src/data/generated/monster-drops.json
    {
      "items":    { itemId: 中文名 },                  // 只含有被掉落的道具
      "maps":     { mapId: { street, name } },         // 只含有名字的出沒地圖
      "monsters": [ { id, name, level|null, maps, drops } ]  // 依等級排序
    }
輸出：src/data/generated/item-info.json（道具 hover 彈窗用，只含被掉落的道具）
    { itemId: { "desc"?: 說明文字, "eq"?: { reqLevel, incPAD, ... } } }
    desc 來自 Item.json（\\n 已轉真換行；#c...#（遊戲內橘色強調）保留給前端解析）；
    eq 來自 equip-info.json（tools/extract-equip-info.py），沒跑過該腳本就只有 desc。

過濾規則（2026-08-14，對齊遊戲內圖鑑）：
    MonsterBook.wzjson 是舊 wz 掉落表的完整轉檔，含經典版**未實裝**的道具
    （287 種，多為屬性卷軸）和活動/變種怪（5 隻）。遊戲內圖鑑不顯示這些，
    所以這裡用「客戶端名稱表有沒有這個 ID」當實裝判斷，一律過濾掉：
    - 怪物不在 Mob.json  → 整隻跳過
    - 道具不在 Item.json → 該筆掉落跳過（另外同隻怪重複的道具 ID 去重）
    未實裝內容的名稱可在 reference-data/name-supplement.json 查到（maplestory.io），
    之後遊戲改版實裝時，重跑名稱表抽取 + 本腳本就會自動出現。
"""

import json
import os
import re

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT = os.path.join(PROJECT, "src", "data", "generated", "monster-drops.json")
OUT_INFO = os.path.join(PROJECT, "src", "data", "generated", "item-info.json")


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
    desc_tbl = load("name-tables", "MonsterBook.json")  # 圖鑑描述，等級藏在文字裡

    def level_of(mid):
        m = re.search(r"Lv[.。]?\s*(\d+)", desc_tbl.get(mid, ""))
        return int(m.group(1)) if m else None

    monsters = []
    used_items = set()
    used_maps = set()
    hidden_mobs = []
    hidden_rows = 0
    for mid, entry in book.items():
        if mid not in mob_tbl:
            hidden_mobs.append(mid)
            continue
        drops = []
        for iid in entry["rewards"]:
            if str(iid) not in item_tbl:
                hidden_rows += 1
            elif iid not in drops:
                drops.append(iid)
        used_items.update(drops)
        used_maps.update(entry["maps"])
        monsters.append(
            {
                "id": mid,
                "name": mob_tbl[mid]["name"],
                "level": level_of(mid),
                "maps": entry["maps"],
                "drops": drops,
            }
        )
    monsters.sort(key=lambda m: (m["level"] is None, m["level"] or 0, int(m["id"])))

    items = {str(iid): item_tbl[str(iid)]["name"] for iid in sorted(used_items)}

    maps = {}
    for mp in sorted(used_maps):
        entry = map_tbl.get(str(mp))
        if entry and entry.get("mapName"):
            maps[str(mp)] = {
                "street": (entry.get("streetName") or "").strip(),
                "name": entry["mapName"].strip(),
            }

    out = {"items": items, "maps": maps, "monsters": monsters}
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

    n_desc = sum(1 for v in item_info.values() if "desc" in v)
    n_eq = sum(1 for v in item_info.values() if "eq" in v)
    bare = [i for i in used_items if str(i) not in item_info]
    print(f"怪物 {len(monsters)}（{sum(1 for m in monsters if m['level'] is not None)} 隻有等級）")
    print(f"道具 {len(items)} 種、具名地圖 {len(maps)}/{len(used_maps)}")
    print(f"彈窗資料：desc {n_desc}、裝備數值 {n_eq}、兩者皆無 {len(bare)} {bare[:8]}")
    print(f"已寫入 {OUT_INFO}（{os.path.getsize(OUT_INFO) // 1024} KB）")
    print(f"已隱藏未實裝內容：怪物 {len(hidden_mobs)} 隻 {hidden_mobs}、掉落 {hidden_rows} 筆")
    print(f"已寫入 {OUT}（{os.path.getsize(OUT) // 1024} KB）")


if __name__ == "__main__":
    main()
