"""照 WZ 地圖的圖層自己疊出一張地圖底圖（像素借 maplestory.io 的 WZ 瀏覽端點）。

為什麼要自己疊：maplestory.io 的整張地圖渲染（/map/<id>/render）會漏畫物件——
女神之塔中央塔那張連女神像都沒有、迎月花山丘那張只剩地磚——所以兩張攻略圖
（extract-goddess-statue.py、extract-moonbunny-map.py）都改成拿地圖結構來自己畫。

用法：
    wz = Wz("TMS/209")
    m = fetch_map(wz, "910010000")            # 圖層物件／地磚、背景、反應器
    img = render(wz, m, crop=(x0, y0, x1, y1), reactors=[...])

render 只用到 wz.need()，所以也可以傳 Matched（多個版本、每張圖挑 origin 對得上的）。

疊圖順序照遊戲：背景（front=0）→ 圖層 0–7（每層先物件、再地磚）→ 前景背景
（front=1）。同一層裡物件照 z 排；地磚照「圖本身的 z，0 的話用地圖給的 zM」排
（HeavenClient 的寫法，地磚的轉角 edU 要畫在草皮 enH0 底下才不會蓋住草）。
z 一樣的照原本的序號。

反應器不在 WZ 的圖層裡，由呼叫端決定插在哪一層、哪個 z 之後（reactor_slot）。

座標一律用遊戲世界座標（y 向下為正），crop 是要畫的世界範圍。視差背景（rx/ry
不是 -100 的）照「鏡頭對準 crop 中心」擺，靜態圖沒有真正的鏡頭，這是唯一合理的選擇。
"""

import base64
import io
import json
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageOps

HEADERS = {"User-Agent": "maple-detective/1.0 (fan site asset fetch)"}

OBJ_FIELDS = ["oS", "l0", "l1", "l2", "x", "y", "z", "f"]
TILE_FIELDS = ["u", "no", "x", "y", "zM"]
BACK_FIELDS = ["bS", "no", "x", "y", "rx", "ry", "cx", "cy", "type", "a", "front", "ani", "f"]
REACTOR_FIELDS = ["id", "x", "y", "f", "name"]


class Wz:
    """maplestory.io 的 WZ 瀏覽端點：一個節點一個請求，圖會快取。"""

    def __init__(self, region):
        self.region = region
        self.api = f"https://maplestory.io/api/wz/{region}"
        self._canvas = {}

    def get(self, path):
        """一個節點；404 回 None，其他錯誤重試三次。"""
        url = f"{self.api}/{path}"
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

    def get_many(self, paths):
        with ThreadPoolExecutor(8) as pool:
            return dict(zip(paths, pool.map(self.get, paths)))

    def children(self, path):
        return (self.get(path) or {}).get("children") or []

    def fields(self, base, indices, names):
        """一次抓一批節點的指定欄位：{index: {欄位: 值}}，缺的欄位不放。"""
        got = self.get_many([f"{base}/{i}/{n}" for i in indices for n in names])
        out = {i: {} for i in indices}
        for i in indices:
            for n in names:
                node = got[f"{base}/{i}/{n}"]
                if node is not None and "value" in node:
                    out[i][n] = node["value"]
        return out

    def canvas(self, path):
        """(圖, origin_x, origin_y, z)；沒有這張圖回 None。"""
        if path not in self._canvas:
            node = self.get(path)
            if not node or node.get("type") != 12 or not node.get("value"):  # 這個端點的 12 是圖
                self._canvas[path] = None
            else:
                attrs = self.get_many([f"{path}/origin", f"{path}/z"])
                o = (attrs[f"{path}/origin"] or {}).get("value") or {}
                z = (attrs[f"{path}/z"] or {}).get("value") or 0
                img = Image.open(io.BytesIO(base64.b64decode(node["value"]))).convert("RGBA")
                self._canvas[path] = (img, o.get("x", 0), o.get("y", 0), z if isinstance(z, int) else 0)
        return self._canvas[path]

    def need(self, path, what):
        c = self.canvas(path)
        if not c:
            raise SystemExit(f"{what} 抓不到圖：{path}")
        return c


class Matched:
    """好幾個版本裡，每張圖各挑第一個 origin 跟客戶端一致的版本。

    經典版的圖不一定都是同一版：迎月花山丘的地磚與裝飾 TMS/209 全對，梯子頂端那
    一節卻是改過的新圖（origin 差 2px），要回到 GMS/83 才對得上——跟時裝那邊
    「有些道具要回到 GMS/83 那個年代」是同一回事。先 match() 過的圖，render 時
    need() 就會從挑中的版本拿；沒 match 過的用第一個版本。
    """

    def __init__(self, sources):
        self.sources = sources
        self.pick = {}

    def match(self, path, origin, what):
        for wz in self.sources:
            c = wz.canvas(path)
            if c and [c[1], c[2]] == list(origin):
                self.pick[path] = wz
                return wz.region
        raise SystemExit(f"{what} 在 {[w.region for w in self.sources]} 都找不到 origin {list(origin)} 的圖：{path}")

    def need(self, path, what):
        return self.pick.get(path, self.sources[0]).need(path, what)


def obj_path(o):
    return f"Map/Obj/{o['oS']}.img/{o['l0']}/{o['l1']}/{o['l2']}/0"


def tile_path(tile_set, t):
    return f"Map/Tile/{tile_set}.img/{t['u']}/{t['no']}"


def back_path(b):
    ani = b.get("ani", 0)
    return f"Map/Back/{b['bS']}.img/{'ani' if ani else 'back'}/{b['no']}" + ("/0" if ani else "")


def reactor_path(r):
    return f"Reactor/{r['id']}.img/{r.get('state', 0)}/0"


def fetch_map(wz, map_id, near=None):
    """地圖結構。near(entry, kind) 回 False 的物件／地磚只抓座標、不抓細節（省請求）。"""
    base = f"Map/Map/Map{map_id[0]}/{map_id}.img"
    layers = []
    for layer in range(8):
        info = wz.children(f"{base}/{layer}/info")
        tile_set = (wz.get(f"{base}/{layer}/info/tS") or {}).get("value") if "tS" in info else None
        parts = {}
        for kind, names in (("obj", OBJ_FIELDS), ("tile", TILE_FIELDS)):
            idx = sorted(int(k) for k in wz.children(f"{base}/{layer}/{kind}") if k.isdigit())
            pos = wz.fields(f"{base}/{layer}/{kind}", idx, ["x", "y"])
            keep = [i for i in idx if near is None or near(pos[i], kind)]
            rest = wz.fields(f"{base}/{layer}/{kind}", keep, [n for n in names if n not in ("x", "y")])
            parts[kind] = [{"index": i, **pos[i], **rest[i]} for i in keep]
        layers.append({"tS": tile_set, "obj": parts["obj"], "tile": parts["tile"]})

    back_idx = sorted(int(k) for k in wz.children(f"{base}/back") if k.isdigit())
    back = wz.fields(f"{base}/back", back_idx, BACK_FIELDS)
    reactor_idx = sorted(int(k) for k in wz.children(f"{base}/reactor") if k.isdigit())
    reactor = wz.fields(f"{base}/reactor", reactor_idx, REACTOR_FIELDS)
    return {
        "layers": layers,
        "backs": [back[i] for i in back_idx],
        "reactors": [reactor[i] for i in reactor_idx],
    }


def fetch_footholds(region, map_id):
    """地形用一般的地圖端點拿（WZ 端點一段一段問要上千個請求）。[[x1, y1, x2, y2], ...]"""
    url = f"https://maplestory.io/api/{region}/map/{map_id}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
        data = json.loads(r.read())
    fhs = data["footholds"]
    return [[f["x1"], f["y1"], f["x2"], f["y2"]] for f in (fhs.values() if isinstance(fhs, dict) else fhs)]


def flipped(c, flip):
    img, ox, oy, z = c
    return (ImageOps.mirror(img), img.width - ox, oy, z) if flip else c


def render(wz, m, crop, reactors=(), reactor_slot=(3, 0), backs=True, sky=None):
    """畫出 crop 範圍（世界座標 x0, y0, x1, y1）。

    reactors：[{id, x, y, f?, state?}]，插在第 reactor_slot[0] 層、z 大於
    reactor_slot[1] 的物件之前。backs=False 不畫背景（改鋪 sky 這個底色）。
    """
    x0, y0, x1, y1 = crop
    w, h = x1 - x0, y1 - y0
    cam_x, cam_y = (x0 + x1) / 2, (y0 + y1) / 2
    out = Image.new("RGBA", (w, h), (*(sky or (0, 0, 0)), 255))

    def blit(img, wx, wy):
        x, y = round(wx - x0), round(wy - y0)
        if x >= w or y >= h or x + img.width <= 0 or y + img.height <= 0:
            return
        out.alpha_composite(img, (max(x, 0), max(y, 0)), (max(-x, 0), max(-y, 0)))

    def draw_back(b):
        img, ox, oy, _ = flipped(wz.need(back_path(b), "背景"), b.get("f"))
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
            img, ox, oy, _ = flipped(wz.need(reactor_path(r), "反應器"), r.get("f"))
            blit(img, r["x"] - ox, r["y"] - oy)

    if backs:
        for b in m["backs"]:
            if not b.get("front"):
                draw_back(b)
    slot_layer, slot_z = reactor_slot
    for n, layer in enumerate(m["layers"]):
        drawn = False
        for o in sorted(layer["obj"], key=lambda o: (o.get("z", 0), o["index"])):
            if n == slot_layer and not drawn and o.get("z", 0) > slot_z:
                draw_reactors()
                drawn = True
            img, ox, oy, _ = flipped(wz.need(obj_path(o), "物件"), o.get("f"))
            blit(img, o["x"] - ox, o["y"] - oy)
        if n == slot_layer and not drawn:
            draw_reactors()

        def tile_z(t):
            z = wz.need(tile_path(layer["tS"], t), "地磚")[3]
            return z or t.get("zM", 0)

        for t in sorted(layer["tile"], key=lambda t: (tile_z(t), t["index"])):
            img, ox, oy, _ = wz.need(tile_path(layer["tS"], t), "地磚")
            blit(img, t["x"] - ox, t["y"] - oy)
    if backs:
        for b in m["backs"]:
            if b.get("front"):
                draw_back(b)
    return out.convert("RGB")
