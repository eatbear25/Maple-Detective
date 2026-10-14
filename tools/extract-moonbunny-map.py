"""從客戶端抽出「月妙的年糕」第一階段地圖（迎月花山丘 910010000）的攻略資料與底圖。

用法：
    pip install UnityPy pillow
    python tools/extract-moonbunny-map.py

輸出：
  src/data/generated/moon-bunny-map.json：地形、繩子、14 叢草（各掉哪色種子）、
    6 朵迎月花（各收哪色種子）、月妙的位置。前端拿它畫一張攻略示意圖。
  public/maps/910010000.webp：底圖（自己疊的，見下面）。**要連網**。

顏色怎麼來的（兩邊都是客戶端硬資料，不是猜的）：
  * 花：Reactor/9108000–9108005 每個 state 0 的 event 帶「要放進來的道具 id」
    （4001095–4001100），直接讀出來就是該平台收哪一色。
  * 草：Reactor/9102002–9102007 的 action 是 moonItem0–moonItem5，序號 N 對應
    種子 4001095+N。掉落本身是伺服器決定的、客戶端沒有，但這個對應關係已用
    社群整理的實機截圖交叉驗證過 14 叢全中。

底圖怎麼來的：**客戶端的 Map/910010000.wzjson 有完整的圖層結構**——每塊地磚、
每個物件、背景擺在哪都有，就是現行版本的樣子；缺的只有像素（在 spritesheet
裡，圖集順序解不開，見 tools/wzsheet.py）。所以結構照客戶端、像素向 maplestory.io
的 WZ 瀏覽端點借，用 tools/wzmap_render.py 照遊戲的圖層順序自己疊。借來的每張圖
都拿客戶端的 origin 驗身，各自挑第一個對得上的版本（TMS/209 → GMS/83），哪個
版本都對不上就中止。

（以前的做法是拿 maplestory.io 的整張地圖渲染，再「一欄一欄上下平移」把舊版的
下層平台湊成現行版的形狀——TMS/209 下層是三長段，現行版是五段高低交錯——
接縫、補丁、接長梯子一大堆，草皮拼起來東一塊西一塊。客戶端本來就有現行版的
地磚擺法，照著畫就好，那一整套都不需要了。）

畫進底圖的：地磚、物件、草叢（打了掉種子的那叢，五色共用 9102002 那張圖）、
月亮（fullmoon，年糕做越多越滿）。迎月花在種子放進去之前是 1×1 的空圖，畫了
等於沒畫。背景（遠山、森林、霧）刻意不畫：底圖是給人找種子位置的，背景一畫上去
種子標記就不好認，天空改鋪一層夜空色。

地圖座標沿用遊戲世界座標（y 向下為正）。
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import UnityPy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402
from wzmap_render import Matched, Wz, obj_path, reactor_path, render, tile_path  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "moon-bunny-map.json")
NAME_TABLES = os.path.join(PROJECT, "reference-data", "name-tables")
IMG_DIR = os.path.join(PROJECT, "public", "maps")

MAP_ID = "910010000"
# 每張圖挑第一個 origin 跟客戶端一致的版本：TMS/209 幾乎全對，只有梯子頂端那一節
# 是改過的新圖，要回到 GMS/83 才對得上
REGIONS = ["TMS/209", "GMS/83"]
SKY = (18, 22, 40)  # 不畫背景，天空鋪這個夜空色
# 裁切範圍（世界座標）：左右切齊地磚（-990–810；邊上幾個物件會多出十來 px，
# 留著的話兩側只會多一條夜空色的邊，像畫框）、下緣到最低的地磚（442）；
# 上緣比最高的雲（-768）再多留一截，最上面兩朵花的種子標記與文字要畫在那裡。
CROP = (-990, -840, 810, 440)
REACTOR_SLOT = (6, 0)  # 反應器畫在第 5 層地磚之後（不然下層的草叢會被地磚蓋住）
SEED_BASE = 4001095  # 淺綠 / 紫 / 淺紫 / 黃褐 / 黃 / 藍，連號六色


def load_bundle(target_suffix):
    """掃 json_*.bundle 找含指定 container 的那包（hash 檔名每次更新都變）。

    回傳 {容器路徑: raw bytes}。MonoScript 參照在 monoscripts 包裡，要一起載入才解得開。
    """
    monoscripts = [f for f in os.listdir(AA_W) if f.startswith("monoscripts_")]
    for fname in sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    ):
        env = UnityPy.load(*[os.path.join(AA_W, f) for f in [fname, *monoscripts]])
        if any(p.endswith(target_suffix) for p in env.container):
            by_id = {r.path_id: r for r in env.objects}
            return {p: bytes(by_id[ptr.path_id].get_raw_data()) for p, ptr in env.container.items()}
    raise SystemExit(f"找不到含 {target_suffix} 的 json_*.bundle")


def items(node):
    """WZ 的「0, 1, 2…」編號目錄 → 照編號排好的 list，順便記下原本的編號。"""
    return [dict(v, index=int(k)) for k, v in sorted((node or {}).items(), key=lambda kv: int(kv[0]))]


def client_structure(m):
    """客戶端地圖 → wzmap_render 吃的結構（背景照收，但 render 時不畫）。"""
    layers = []
    for n in range(8):
        layer = m.get(str(n)) or {}
        layers.append({
            "tS": (layer.get("info") or {}).get("tS"),
            "obj": items(layer.get("obj")),
            "tile": items(layer.get("tile")),
        })
    return {"layers": layers, "backs": items(m.get("back")), "reactors": []}


def match_all(wz, struct, reactors, assets, reactor_tree):
    """每張圖挑 origin 跟客戶端一致的版本（借圖順便驗身），都對不上就中止。"""
    picked = {}

    def match(path, mine, what):
        if path not in wz.pick:
            region = wz.match(path, mine, what)
            picked[region] = picked.get(region, 0) + 1

    for layer in struct["layers"]:
        for o in layer["obj"]:
            node = assets[f"Obj/{o['oS']}"][o["l0"]][o["l1"]][str(o["l2"])]["0"]
            match(obj_path(o), node["origin"], "物件")
        for t in layer["tile"]:
            node = assets[f"Tile/{layer['tS']}"][t["u"]][str(t["no"])]
            match(tile_path(layer["tS"], t), node["origin"], "地磚")
    for r in reactors:
        match(reactor_path(r), reactor_tree[r["id"]]["0"]["0"]["origin"], "反應器")
    print(f"  驗身：{sum(picked.values())} 張圖的 origin 與客戶端一致（{picked}）")


def main():
    maps = load_bundle(f"/{MAP_ID}.wzjson")
    m = wzjs_decode(next(v for k, v in maps.items() if k.endswith(f"/{MAP_ID}.wzjson")))[1]

    reactor_raw = load_bundle("/Reactor/9108000.wzjson")
    reactor_tree = {}
    for cpath, rb in reactor_raw.items():
        if "/Reactor/" in cpath:
            rid = os.path.basename(cpath).removesuffix(".wzjson")
            if rid.startswith(("9101", "9102", "9108")):
                reactor_tree[rid] = wzjs_decode(rb, expand_canvas=True)[1]

    def flower_item(rid):
        """花 reactor state 0 的 event 第 0 個欄位 = 要放上去的種子 id。"""
        return reactor_tree[rid]["0"]["event"]["0"]["0"]

    def bush_item(rid):
        """草 reactor 的 action moonItemN → 種子 4001095+N。"""
        action = reactor_tree[rid].get("action") or reactor_tree["9102002"]["action"]
        return SEED_BASE + int(action.removeprefix("moonItem"))

    def drawn_id(rid):
        """9102003–9102007 只是連到 9102002（info/link），圖都在 9102002。"""
        return str((reactor_tree[rid].get("info") or {}).get("link") or rid)

    bushes, flowers, reactors = [], [], []
    for r in m["reactor"].values():
        entry = {"x": r["x"], "y": r["y"]}
        if r["name"].startswith("moonflower"):
            flowers.append({**entry, "itemId": flower_item(r["id"])})
        elif r["name"] == "nut":
            bushes.append({**entry, "itemId": bush_item(r["id"])})
        reactors.append({"id": drawn_id(r["id"]), "x": r["x"], "y": r["y"], "f": r.get("f", 0)})
    bushes.sort(key=lambda b: b["x"])
    # 六朵花排成左右兩欄各三列（x 正負分欄，y 小的在上）。標上欄列給前端當
    # 「左上／左中／…」的速查表用，免得前端還要自己從座標推。
    flowers.sort(key=lambda f: (f["x"] >= 0, f["y"]))
    for i, fl in enumerate(flowers):
        fl["side"] = "right" if fl["x"] >= 0 else "left"
        fl["row"] = i % 3

    footholds = [
        [seg["x1"], seg["y1"], seg["x2"], seg["y2"]]
        for group in m["foothold"].values()
        for layer in group.values()
        for seg in layer.values()
    ]
    ropes = [{"x": r["x"], "y1": r["y1"], "y2": r["y2"]} for r in m["ladderRope"].values()]

    npc = next(l for l in m["life"].values() if l["type"] == "n")
    with open(os.path.join(NAME_TABLES, "Map.json"), encoding="utf-8") as f:
        map_name = json.load(f)[MAP_ID]["mapName"]
    with open(os.path.join(NAME_TABLES, "Npc.json"), encoding="utf-8") as f:
        npc_name = json.load(f)[str(int(npc["id"]))]["name"]
    with open(os.path.join(NAME_TABLES, "Item.json"), encoding="utf-8") as f:
        item_names = json.load(f)

    struct = client_structure(m)
    asset_names = {f"Obj/{o['oS']}" for layer in struct["layers"] for o in layer["obj"]}
    asset_names |= {f"Tile/{layer['tS']}" for layer in struct["layers"] if layer["tile"]}
    assets = {
        name: wzjs_decode(next(v for k, v in maps.items() if k.endswith(f"/Map/{name}.wzjson")),
                          expand_canvas=True)[1]
        for name in sorted(asset_names)
    }

    print(f"借 {' / '.join(REGIONS)} 的圖…")
    wz = Matched([Wz(r) for r in REGIONS])
    match_all(wz, struct, reactors, assets, reactor_tree)
    img = render(wz, struct, CROP, reactors=reactors, reactor_slot=REACTOR_SLOT, backs=False, sky=SKY)
    os.makedirs(IMG_DIR, exist_ok=True)
    # 存 WebP：底圖是點陣美術，同畫質下比 PNG 小一半以上
    img.save(os.path.join(IMG_DIR, f"{MAP_ID}.webp"), "WEBP", quality=88, method=6)

    data = {
        "meta": {
            "source": f"客戶端 Map/{MAP_ID}.wzjson + Reactor/9101000-9108005 ＋ maplestory.io {'/'.join(REGIONS)} 的圖",
            "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "script": "tools/extract-moonbunny-map.py",
        },
        "mapId": int(MAP_ID),
        "mapName": map_name,
        # 底圖與座標原點：world (x, y) 畫在圖上的 (x + originX, y + originY)
        "image": {
            "src": f"/maps/{MAP_ID}.webp",
            "width": img.width,
            "height": img.height,
            "originX": -CROP[0],
            "originY": -CROP[1],
        },
        "seedNames": {
            str(SEED_BASE + i): item_names[str(SEED_BASE + i)]["name"] for i in range(6)
        },
        "npc": {"x": npc["x"], "y": npc["y"], "name": npc_name},
        "footholds": footholds,
        "ropes": ropes,
        "bushes": bushes,
        "flowers": flowers,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"{map_name}：{len(bushes)} 叢草、{len(flowers)} 朵花、{len(footholds)} 段地形、"
          f"底圖 {img.width}x{img.height} → {OUT_PATH}")
    for fl in flowers:
        print(f"  花 ({fl['x']:>5},{fl['y']:>5})  {data['seedNames'][str(fl['itemId'])]}")


if __name__ == "__main__":
    main()
