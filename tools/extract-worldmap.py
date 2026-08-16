"""從楓之谷經典版客戶端抽取世界地圖（底圖 + 出沒點座標）。

用法：
    pip install UnityPy
    python tools/extract-worldmap.py

輸出：
    public/worldmap/<sheet>.png        16 張世界地圖底圖（總圖 + 各大陸 + 子圖）
    reference-data/worldmap.json       每張圖的點位（SpotX/SpotY，原點在圖中心）
                                       與 mapId 清單、圖與圖的連結、顯示名稱

資料來源（都用 container path 掃描定位，不依賴 bundle 檔名）：
    json_*.bundle:
        Assets/WzAssets/Json/Etc/WorldMap.json        點位/連結資料（純 JSON TextAsset）
        Assets/WzAssets/Json/String/TW/WorldMap.json  各圖連結的中文 tooltip
    spriteset_*.bundle:
        Assets/WzAssets/SpriteSet/TW/Map/WorldMap/BaseImg.asset
            MonoBehaviour，欄位名被混淆但版面單純：依序為
            [對齊的 key 字串 "WorldMap"/"WorldMap000"/...][PPtr<Sprite>(fileID i32 + pathID i64)]
            直接掃 raw bytes 配對即可，Sprite 用 UnityPy .image 轉 PNG。

座標系（已驗證）：SpotX/SpotY 原點在底圖中心，網頁上畫點就是
    left = (x + w/2) / w、top = (y + h/2) / h。
"""

import json
import os
import re
import struct
import sys
from datetime import datetime, timezone, timedelta

import UnityPy

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_JSON = os.path.join(PROJECT, "reference-data", "worldmap.json")
OUT_PNG_DIR = os.path.join(PROJECT, "public", "worldmap")

ETC_PATH = "Assets/WzAssets/Json/Etc/WorldMap.json"
STR_PATH = "Assets/WzAssets/Json/String/TW/WorldMap.json"
BASEIMG_PATH = "Assets/WzAssets/SpriteSet/TW/Map/WorldMap/BaseImg.asset"

ROOT_TITLE = "楓之谷世界"


def bundles(prefix):
    files = [f for f in os.listdir(AA_W) if f.startswith(prefix) and f.endswith(".bundle")]
    return sorted(files, key=lambda f: os.path.getsize(os.path.join(AA_W, f)))


def find_text_assets():
    """掃 json_*.bundle 抽出兩份純 JSON TextAsset。"""
    found = {}
    for fname in bundles("json_"):
        env = UnityPy.load(os.path.join(AA_W, fname))
        for cpath, pptr in env.container.items():
            if cpath in (ETC_PATH, STR_PATH) and cpath not in found:
                reader = next(r for r in env.objects if r.path_id == pptr.path_id)
                found[cpath] = (fname, json.loads(reader.read().m_Script))
        if len(found) == 2:
            return found
    missing = {ETC_PATH, STR_PATH} - set(found)
    raise SystemExit(f"在 json_*.bundle 裡找不到 {missing}")


def export_base_images():
    """掃 spriteset_*.bundle 找 BaseImg.asset，解出 sheet 名 → PNG。"""
    for fname in bundles("spriteset_"):
        env = UnityPy.load(os.path.join(AA_W, fname))
        pptr = dict(env.container.items()).get(BASEIMG_PATH)
        if pptr is None:
            continue
        ids = {r.path_id: r for r in env.objects}
        reader = ids[pptr.path_id]
        raw = bytes(reader.get_raw_data())

        os.makedirs(OUT_PNG_DIR, exist_ok=True)
        sizes = {}
        # 版面：m_Name("BaseImg") 之後是一串 [key 字串][PPtr]；key 都叫 WorldMap*
        keys = [(m.start(), m.group().decode()) for m in re.finditer(rb"WorldMap[0-9]*", raw)]
        for off, key in keys:
            p = (off + len(key) + 3) & ~3  # 字串後 4-byte 對齊
            file_id, path_id = struct.unpack_from("<iq", raw, p)
            r = ids.get(path_id)
            if r is None or r.type.name != "Sprite":
                print(f"  跳過 {key}：pathID {path_id} 不是本包的 Sprite（fileID={file_id}）")
                continue
            img = r.read().image
            img.save(os.path.join(OUT_PNG_DIR, f"{key}.png"))
            sizes[key] = [img.width, img.height]
        if not sizes:
            raise SystemExit(f"{fname} 有 BaseImg.asset 但一張圖都沒解出來，版面可能變了")
        print(f"底圖 {len(sizes)} 張 ← {fname}")
        return fname, sizes
    raise SystemExit(f"在 spriteset_*.bundle 裡找不到 {BASEIMG_PATH}")


def sheet_titles(worlds, strings):
    """圖的顯示名稱 = 上層圖 MapLinkList 對應 index 的中文 tooltip。"""
    titles = {"WorldMap": ROOT_TITLE}
    for name, sheet in worlds.items():
        for link in sheet.get("MapLinkList") or []:
            values = (strings.get(str(sheet["WorldMapId"])) or {}).get("values", {})
            tip = values.get(f"{link['MapLinkIdx']}_toolTip")
            if tip:
                titles[link["LinkMap"]] = tip
    return titles


def main():
    found = find_text_assets()
    etc_bundle, etc = found[ETC_PATH]
    _, strings = found[STR_PATH]
    worlds = etc["Worlds"]
    print(f"點位資料 ← {etc_bundle}：{len(worlds)} 張圖")

    img_bundle, sizes = export_base_images()
    titles = sheet_titles(worlds, strings)

    sheets = {}
    for name, sheet in worlds.items():
        if name not in sizes:
            print(f"  注意：{name} 有點位資料但沒底圖")
            continue
        sheets[name] = {
            "title": titles.get(name, name),
            "parent": sheet.get("ParentMap"),
            "size": sizes[name],
            "spots": [
                {"x": s["SpotX"], "y": s["SpotY"], "type": s["Type"], "maps": s["MapNo"]}
                for s in sheet.get("MapList") or []
            ],
            "links": [l["LinkMap"] for l in sheet.get("MapLinkList") or []],
        }

    n_spots = sum(len(s["spots"]) for s in sheets.values())
    n_maps = len({mp for s in sheets.values() for sp in s["spots"] for mp in sp["maps"]})
    assert n_spots > 300 and n_maps > 500, f"點位異常少（spots={n_spots} maps={n_maps}），抽取結果可疑"
    for probe in ("WorldMap", "WorldMap000", "WorldMap010"):
        assert probe in sheets, f"缺少 {probe}"

    out = {
        "meta": {
            "source": f"{etc_bundle} -> {ETC_PATH}; {img_bundle} -> {BASEIMG_PATH}",
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "sheets": len(sheets),
            "spots": n_spots,
            "mapIds": n_maps,
        },
        "sheets": sheets,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"圖名：{ {k: v['title'] for k, v in sheets.items()} }")
    print(f"已寫入 {OUT_JSON}（{n_spots} 個點、{n_maps} 張地圖）與 {OUT_PNG_DIR}/*.png")


if __name__ == "__main__":
    sys.exit(main())
