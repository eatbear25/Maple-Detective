"""組出「女神之塔」最後一關（中央塔 920010100）的女神像碎片攻略圖。

用法：
    pip install UnityPy pillow
    python tools/extract-goddess-statue.py

輸出：
  public/maps/920010100.webp                女神像那一段的底圖（自己合成的，見下面）
  src/data/generated/goddess-statue.json    七個放置點：六片碎片＋最後的生命草

資料分兩半，來源不一樣：

  * 哪個位置收哪個道具 —— 客戶端硬資料。Reactor/2008000–2008005（地圖上叫 scar1–6）
    與 2006001（minerva）的 state 底下有 event，帶「要丟進來的道具 id」與判定框
    lt/rb，跟月妙的迎月花同一種寫法。判定框裡剛好各罩住一塊平台，標記就畫在那塊
    平台上（取判定框內重疊最長的那段 foothold）。女神像本體收的是生命草 4001055，
    落在柱頂。
  * 地圖本身（反應器擺哪、平台、女神像、背景）—— 920 那批地圖不在客戶端裡（連
    名稱表都沒有），向 maplestory.io 的 WZ 瀏覽端點借 GMS/83。用到的物件與反應器
    圖都先拿客戶端的 origin 驗身（客戶端有 Obj/tower 與 Reactor 的結構，缺的只有
    像素），對不上就中止，免得借到撞 ID 的別張圖。

為什麼不直接用 maplestory.io 的整張地圖渲染：它那張漏畫了 skyStation 那批物件，
只剩兩側牆壁和兩塊平台，女神像整個不見。所以這裡自己照 WZ 的圖層順序疊：
背景（front=0）→ 各圖層物件（依 z）→ 圖層磚塊 → 前景背景（front=1）。

版本挑 GMS/83 不挑 TMS/209：兩版物件的 origin 都跟客戶端一致、像素也幾乎一樣，
但 TMS/209 的女神像柱子底部被切成透明的，而且 TMS/209 的 WZ 端點沒有 Map/Back。

反應器畫的是 state 0（剛進地圖、還沒放碎片時的破損樣子），插在女神像（z=5）
之後、平台（z≥6）之前——這是對照遊戲截圖定的：平台要蓋在缺口圖上面，不然左中
那塊平台會被缺口吃掉。

這張圖的素材不會跟著遊戲更新變（地圖根本不在客戶端），一般不用重跑；
遊戲哪天把奧爾比斯推進客戶端，再改成讀客戶端的地圖。
"""

import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import UnityPy
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "goddess-statue.json")
NAME_TABLES = os.path.join(PROJECT, "reference-data", "name-tables")
IMG_DIR = os.path.join(PROJECT, "public", "maps")

MAP_ID = "920010100"
REGION = "GMS/83"
API = f"https://maplestory.io/api/wz/{REGION}"
MAP_IMG = f"Map/Map/Map{MAP_ID[0]}/{MAP_ID}.img"
HEADERS = {"User-Agent": "maple-detective/1.0 (fan site asset fetch)"}

REACTORS = ["2008000", "2008001", "2008002", "2008003", "2008004", "2008005", "2006001"]
PIECE_BASE = 4001044  # 女神像的第一個～第六個碎片，連號
# 裁切範圍（世界座標）：女神像整尊（含左邊斷掉的翅膀）＋最低那兩塊平台，
# 左右對稱各留一點窗外的天空。右緣再往外就會切到 x=191 那座梯子的邊。
CROP = (-268, -1195, 172, -722)
OBJ_MARGIN = 700  # 物件只要 x,y 落在裁切範圍外這麼遠以內就抓（最寬的物件 671px）
TILE_MARGIN = 150
REACTOR_Z = 5.5  # 反應器插在 z 這個值之後（見 docstring）


def load_client(target_suffix):
    """掃 json_*.bundle 找含指定 container 的那包，回傳 {容器路徑: 解碼後的樹}。"""
    monoscripts = [f for f in os.listdir(AA_W) if f.startswith("monoscripts_")]
    for fname in sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    ):
        env = UnityPy.load(*[os.path.join(AA_W, f) for f in [fname, *monoscripts]])
        if any(p.endswith(target_suffix) for p in env.container):
            by_id = {r.path_id: r for r in env.objects}
            return env, by_id
    raise SystemExit(f"找不到含 {target_suffix} 的 json_*.bundle")


def client_tree(env, by_id, suffix):
    path = next(p for p in env.container if p.endswith(suffix))
    raw = bytes(by_id[env.container[path].path_id].get_raw_data())
    return wzjs_decode(raw, expand_canvas=True)[1]


def get(path):
    """WZ 瀏覽端點的一個節點；404 回 None，其他錯誤重試三次。"""
    url = f"{API}/{path}"
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
    raise SystemExit(f"maplestory.io 連不上：{url}")


def get_many(paths):
    with ThreadPoolExecutor(8) as pool:
        return dict(zip(paths, pool.map(get, paths)))


def children(path):
    return (get(path) or {}).get("children") or []


def fields(base, indices, names):
    """一次抓一批節點的指定欄位：{index: {欄位: 值}}，缺的欄位不放。"""
    paths = [f"{base}/{i}/{n}" for i in indices for n in names]
    got = get_many(paths)
    out = {i: {} for i in indices}
    for i in indices:
        for n in names:
            node = got[f"{base}/{i}/{n}"]
            if node is not None and "value" in node:
                out[i][n] = node["value"]
    return out


def near(e, margin):
    x0, y0, x1, y1 = CROP
    return x0 - margin <= e["x"] <= x1 + margin and y0 - margin <= e["y"] <= y1 + margin


def fetch_map():
    """地圖結構：各圖層的物件／磚塊、背景、反應器。離裁切範圍太遠的不抓細節。"""
    layers = []
    for layer in range(8):
        base = f"{MAP_IMG}/{layer}"
        info = children(f"{base}/info")
        tile_set = (get(f"{base}/info/tS") or {}).get("value") if "tS" in info else None
        objs, tiles = [], []
        for kind, out, rest, margin in (
            ("obj", objs, ["oS", "l0", "l1", "l2", "z", "f"], OBJ_MARGIN),
            ("tile", tiles, ["u", "no", "zM"], TILE_MARGIN),
        ):
            idx = sorted(int(k) for k in children(f"{base}/{kind}") if k.isdigit())
            pos = fields(f"{base}/{kind}", idx, ["x", "y"])
            keep = [i for i in idx if near(pos[i], margin)]
            detail = fields(f"{base}/{kind}", keep, rest)
            out += [{"index": i, **pos[i], **detail[i]} for i in keep]
        layers.append({"tS": tile_set, "obj": objs, "tile": tiles})

    back_idx = sorted(int(k) for k in children(f"{MAP_IMG}/back") if k.isdigit())
    back = fields(f"{MAP_IMG}/back", back_idx,
                  ["bS", "no", "x", "y", "rx", "ry", "cx", "cy", "type", "a", "front", "ani", "f"])
    reactor_idx = sorted(int(k) for k in children(f"{MAP_IMG}/reactor") if k.isdigit())
    reactor = fields(f"{MAP_IMG}/reactor", reactor_idx, ["id", "x", "y", "f", "name"])
    return layers, [back[i] for i in back_idx], [reactor[i] for i in reactor_idx]


def fetch_footholds():
    """地形用一般的地圖端點拿（WZ 端點一段一段問要上千個請求）。"""
    url = f"https://maplestory.io/api/{REGION}/map/{MAP_ID}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
        data = json.loads(r.read())
    fhs = data["footholds"]
    return [[f["x1"], f["y1"], f["x2"], f["y2"]] for f in (fhs.values() if isinstance(fhs, dict) else fhs)]


_canvas = {}


def canvas(path):
    """(圖, origin_x, origin_y)；沒有這張圖回 None。"""
    if path not in _canvas:
        node = get(path)
        if not node or node.get("type") != 12 or not node.get("value"):  # 這個端點的 12 是圖
            _canvas[path] = None
        else:
            o = (get(f"{path}/origin") or {}).get("value") or {}
            img = Image.open(io.BytesIO(base64.b64decode(node["value"]))).convert("RGBA")
            _canvas[path] = (img, o.get("x", 0), o.get("y", 0))
    return _canvas[path]


def render(layers, backs, reactors):
    x0, y0, x1, y1 = CROP
    w, h = x1 - x0, y1 - y0
    cam_x, cam_y = (x0 + x1) / 2, (y0 + y1) / 2  # 視差背景照「鏡頭對準裁切中心」擺
    out = Image.new("RGBA", (w, h), (0, 0, 0, 255))

    def blit(img, wx, wy):
        x, y = round(wx - x0), round(wy - y0)
        if x >= w or y >= h or x + img.width <= 0 or y + img.height <= 0:
            return
        out.alpha_composite(img, (max(x, 0), max(y, 0)), (max(-x, 0), max(-y, 0)))

    def flipped(c, flip):
        img, ox, oy = c
        return (ImageOps.mirror(img), img.width - ox, oy) if flip else c

    def draw_back(b):
        ani = b.get("ani", 0)
        c = canvas(f"Map/Back/{b['bS']}.img/{'ani' if ani else 'back'}/{b['no']}" + ("/0" if ani else ""))
        if not c:
            raise SystemExit(f"背景 {b['bS']}/{b['no']} 抓不到圖")
        img, ox, oy = flipped(c, b.get("f"))
        if b.get("a", 255) < 255:
            img = img.copy()
            img.putalpha(img.getchannel("A").point(lambda v: v * b["a"] // 255))
        # rx/ry = -100 是貼在世界上（不跟鏡頭動）；其他值是視差，0 = 貼在螢幕上
        rx, ry = b.get("rx", 0), b.get("ry", 0)
        bx = b["x"] + (cam_x * (1 + rx / 100) if rx != -100 else 0) - ox
        by = b["y"] + (cam_y * (1 + ry / 100) if ry != -100 else 0) - oy
        kind = b.get("type", 0)
        cx, cy = b.get("cx") or img.width, b.get("cy") or img.height
        xs, ys = [bx], [by]
        if kind in (1, 3, 4, 6):  # 水平鋪滿
            first = bx - ((bx - x0) // cx + 1) * cx
            xs = [first + k * cx for k in range(int(w // cx) + 3)]
        if kind in (2, 3, 5, 7):  # 垂直鋪滿
            first = by - ((by - y0) // cy + 1) * cy
            ys = [first + k * cy for k in range(int(h // cy) + 3)]
        for yy in ys:
            for xx in xs:
                blit(img, xx, yy)

    def draw_reactors():
        for r in reactors:
            img, ox, oy = flipped(canvas(f"Reactor/{r['id']}.img/0/0"), r.get("f"))
            blit(img, r["x"] - ox, r["y"] - oy)

    for b in backs:
        if not b.get("front"):
            draw_back(b)
    for n, layer in enumerate(layers):
        drawn = False
        for o in sorted(layer["obj"], key=lambda o: (o.get("z", 0), o["index"])):
            if n == 3 and not drawn and o.get("z", 0) > REACTOR_Z:
                draw_reactors()
                drawn = True
            c = canvas(f"Map/Obj/{o['oS']}.img/{o['l0']}/{o['l1']}/{o['l2']}/0")
            if not c:
                raise SystemExit(f"物件 {o['oS']}/{o['l0']}/{o['l1']}/{o['l2']} 抓不到圖")
            img, ox, oy = flipped(c, o.get("f"))
            blit(img, o["x"] - ox, o["y"] - oy)
        if n == 3 and not drawn:
            draw_reactors()
        for t in sorted(layer["tile"], key=lambda t: (t.get("zM", 0), t["index"])):
            c = canvas(f"Map/Tile/{layer['tS']}.img/{t['u']}/{t['no']}")
            if not c:
                raise SystemExit(f"磚塊 {layer['tS']}/{t['u']}/{t['no']} 抓不到圖")
            img, ox, oy = c
            blit(img, t["x"] - ox, t["y"] - oy)
    for b in backs:
        if b.get("front"):
            draw_back(b)
    return out.convert("RGB")


def verify(layers, reactors, client_obj, client_reactors):
    """借來的圖拿客戶端的 origin 驗身。客戶端沒收的物件（背景、connect 梯子）跳過。"""
    checked = 0
    for layer in layers:
        for o in layer["obj"]:
            node = client_obj.get(o["oS"], {}).get(o["l0"], {}).get(o["l1"], {}).get(str(o["l2"]), {})
            mine = (node.get("0") or {}).get("origin")
            if not mine:
                continue
            _, ox, oy = canvas(f"Map/Obj/{o['oS']}.img/{o['l0']}/{o['l1']}/{o['l2']}/0")
            if [ox, oy] != list(mine):
                raise SystemExit(f"物件 {o['l0']}/{o['l1']}/{o['l2']} origin 對不上：{ox},{oy} vs {mine}")
            checked += 1
    for r in reactors:
        _, ox, oy = canvas(f"Reactor/{r['id']}.img/0/0")
        mine = client_reactors[r["id"]]["0"]["0"]["origin"]
        if [ox, oy] != list(mine):
            raise SystemExit(f"反應器 {r['id']} origin 對不上：{ox},{oy} vs {mine}")
        checked += 1
    print(f"  驗身：{checked} 張圖的 origin 與客戶端一致")


def drop_spot(r, event, footholds):
    """判定框裡重疊最長的那段水平地形＝玩家要站上去丟道具的平台，取它的中點。"""
    lx, ly = r["x"] + event["lt"][0], r["y"] + event["lt"][1]
    rx, ry = r["x"] + event["rb"][0], r["y"] + event["rb"][1]
    best = None
    for x1, y1, x2, y2 in footholds:
        if y1 != y2 or not ly <= y1 <= ry:
            continue
        a, b = max(min(x1, x2), lx), min(max(x1, x2), rx)
        if b > a and (best is None or b - a > best[0]):
            best = (b - a, (min(x1, x2) + max(x1, x2)) / 2, y1)
    if best is None:
        raise SystemExit(f"反應器 {r['id']} 的判定框裡找不到平台")
    return round(best[1]), best[2]


def main():
    env, by_id = load_client("/Reactor/2008000.wzjson")
    client_reactors = {rid: client_tree(env, by_id, f"/Reactor/{rid}.wzjson") for rid in REACTORS}
    env, by_id = load_client("/Map/Obj/tower.wzjson")
    client_obj = {"tower": client_tree(env, by_id, "/Map/Obj/tower.wzjson")}

    print(f"抓 {REGION} 的 {MAP_ID} 地圖結構…")
    layers, backs, reactors = fetch_map()
    reactors = [r for r in reactors if r["id"] in REACTORS]
    if sorted(r["id"] for r in reactors) != sorted(REACTORS):
        raise SystemExit(f"地圖上的反應器跟預期不同：{[r['id'] for r in reactors]}")
    footholds = fetch_footholds()
    verify(layers, reactors, client_obj, client_reactors)

    with open(os.path.join(NAME_TABLES, "Item.json"), encoding="utf-8") as f:
        item_names = json.load(f)

    spots = []
    for r in reactors:
        # 碎片的 event 在 state 0（放進去就變 state 1、補上那一塊）；女神像本體
        # 要等六片都放好、轉到 state 6 才收生命草
        event = next(
            (st["event"]["0"] for st in client_reactors[r["id"]].values()
             if isinstance(st, dict) and "event" in st),
            None,
        )
        if event is None or event.get("type") != 100:
            raise SystemExit(f"反應器 {r['id']} 沒有收道具的 event")
        item_id = event["0"]
        x, y = drop_spot(r, event, footholds)
        order = item_id - PIECE_BASE + 1 if 0 <= item_id - PIECE_BASE < 6 else None
        spots.append({
            "reactorId": int(r["id"]),
            "itemId": item_id,
            "name": item_names[str(item_id)]["name"],
            "order": order,
            "x": x,
            "y": y,
        })
    spots.sort(key=lambda s: (s["order"] is None, s["order"] or 0))
    if [s["order"] for s in spots] != [1, 2, 3, 4, 5, 6, None]:
        raise SystemExit(f"碎片編號不是一到六各一片＋生命草：{[s['order'] for s in spots]}")

    img = render(layers, backs, reactors)
    os.makedirs(IMG_DIR, exist_ok=True)
    img.save(os.path.join(IMG_DIR, f"{MAP_ID}.webp"), "WEBP", quality=88, method=6)

    data = {
        "meta": {
            "source": f"客戶端 Reactor/2008000-2008005、2006001 ＋ maplestory.io {REGION} 的 {MAP_ID} 地圖與圖",
            "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "script": "tools/extract-goddess-statue.py",
        },
        "mapId": int(MAP_ID),
        # 底圖與座標原點：world (x, y) 畫在圖上的 (x + originX, y + originY)
        "image": {
            "src": f"/maps/{MAP_ID}.webp",
            "width": img.width,
            "height": img.height,
            "originX": -CROP[0],
            "originY": -CROP[1],
        },
        # 每個放置點：x, y 是平台中點（地形線上，世界座標）
        "spots": spots,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"女神像：{len(spots)} 個放置點、底圖 {img.width}x{img.height} → {OUT_PATH}")
    for s in spots:
        print(f"  ({s['x']:>5},{s['y']:>5})  {s['name']}")


if __name__ == "__main__":
    main()
