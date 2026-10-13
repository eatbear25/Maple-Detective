"""把時裝的圖與動作資料從 maplestory.io 抓回來、驗過、烤成靜態檔。

用法（**要連網**，第一次全抓約一小時，之後只補新的；中斷了重跑會接著抓）：
    pip install UnityPy Pillow
    python tools/extract-cash-items.py         # 先有點裝清單
    python tools/fetch-fashion-assets.py       # 只處理還沒處理過的
    python tools/fetch-fashion-assets.py --retry-missing   # 之前找不到的再問一次
    python tools/fetch-fashion-assets.py --improve         # 同上，外加指紋沒有 100% 吻合的也重問
                                                           # （改了下面的版本清單 REGIONS 之後用）
    python tools/fetch-fashion-assets.py --rebake          # 全部重來（動作清單或格式改了，記得 FORMAT +1）
    python tools/fetch-fashion-assets.py --only 30000,1002231
    python tools/fetch-fashion-assets.py --verify          # 不連網，只檢查烤好的檔案
    python tools/build-fashion-data.py         # 把「能不能預覽」併進 catalog

輸出：
    public/wz-static/fashion/v1/<id>.json
                                    一件一檔：去重後的圖集（lossless WebP）＋動作表。
                                    不放 public/fashion/ 是因為會跟 /fashion 頁面的路由同名
                                    （長快取的 header 規則會連頁面一起套到）
    public/icons/fashion/<id>.png   清單用的縮圖
    reference-data/fashion-coverage.json
        每件的來源版本與比對分數，或「透明」「找不到」。build-fashion-data.py 讀這份。

為什麼要烤（2026-10-13，原本是瀏覽器執行期直接打 maplestory.io）：
  - 那個 API 單次中位數 1.3 秒、4.6% 的請求超過 10 秒、最長卡 60 秒，而且回應極肥
    （每個影格各帶一份 base64，髮型 284KB、最大的武器 26MB），試衣間因此常常
    停在「合成中」。去重之後髮型只剩 5KB、那把武器 117KB。
  - 缺件要依序問好幾個版本才知道沒有，使用者得等十幾秒才看到「無法預覽」。
    現在抓的時候就知道，清單上直接標出來。

**借圖一定要驗**：各服的道具 ID 會撞。黑色都會雅痞造型（30570）在 TMS/209 是對的，
在 GMS/270 是另一顆完全不同的頭——原本的執行期備援是「有東西就用」，會畫錯。
驗法：客戶端的 wzjson 有每張圖的 origin 與 map（錨點），拿這組數字當指紋，
maplestory.io 回來的要對得上才收（實測同一件是 100% 吻合、撞 ID 的是 0%）。
唯一的例外是 hairShade（髮際陰影）：maplestory.io 的單件 JSON 不給這張圖，
指紋要先把它排除，也因此試衣間畫不出髮際陰影。（WZ 瀏覽端點其實問得到
`default/hairShade/<膚色>`，要補的話走 walk_wz 那條路。）

一件道具怎麼找圖（process）：
  1. 依 REGIONS 的順序問單件端點。指紋 100% 吻合就收工；否則問完全部、挑最吻合的。
     順序與「為什麼要回頭問舊版本」寫在 REGIONS 上面。
  2. 單件端點全軍覆沒 → walk_wz：結構與座標用客戶端的，只跟 WZ 瀏覽端點要像素。
     婚紗、泳裝、救生衣、棒球手套這批是靠這條路救回來的。
  3. 都沒有 → missing。剩下的不是撞 ID（rejected 會列出各版本的吻合比例），
     就是哪個版本都沒有這個 img。

info（islot / vslot / invisibleFace）一律用客戶端的，不用 maplestory.io 的——
遮蔽規則以經典版為準。

動作清單直接讀 src/lib/fashion/config.ts 的 ACTIONS / EXPRESSIONS，只烤頁面
選得到的（全烤會大三倍）。**那邊加動作之後要 --rebake**，build-fashion-data.py
會比對清單、不一致就擋下來。

武器：點裝武器在 wz 裡依「套在哪種武器上」分成 30~58 幾組，每組支援的姿勢不同
（單手只有 stand1、雙手只有 stand2）。這裡每個動作各挑第一組有的攤平，
所以試衣間裡兩種站姿都看得到。
"""

import base64
import hashlib
import io
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

import UnityPy
from PIL import Image

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
CASH_PATH = os.path.join(REF, "cash-items.json")
COVERAGE_PATH = os.path.join(REF, "fashion-coverage.json")
CONFIG_TS = os.path.join(PROJECT, "src", "lib", "fashion", "config.ts")

# 輸出格式版本。改了格式或動作清單就 +1（網址跟著變，舊快取自然失效），
# src/lib/fashion/baked.ts 的 DIR 要一起改
FORMAT = 1
ITEM_DIR = os.path.join(PROJECT, "public", "wz-static", "fashion", f"v{FORMAT}")
ICON_DIR = os.path.join(PROJECT, "public", "icons", "fashion")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import Link, decode as wzjs_decode  # noqa: E402

# 客戶端每件道具的原始資料讀取器。多數道具只需要指紋（load_client 當場算完就丟），
# 要走 WZ 那條路的少數幾件才回頭把整棵結構讀出來，免得七千件的樹同時佔著記憶體
_readers = {}
_reader_lock = threading.Lock()

CHAR_RE = re.compile(r"/Json/Character/([^/]+)/(\d{8})\.wzjson$")

# 依序問這些版本，第一個指紋對得上的就收。TMS/209 是台服舊版、時代最接近經典版，
# 排最前面；後面幾個是各服最新版（收得最全）。
#
# **不要為了快把 GMS/KMS 挪到前面**（它們有 CDN 快取，0.3 秒就回；TMS/209 要 3~8 秒）。
# 指紋只保證「是同一件道具」，不保證「是同一版的圖」：抽 58 件指紋吻合的拿 GMS/270
# 跟 TMS/209 逐張比，22 件有出入——多半是表情的格數不同，但有 6 件連像素都改過
# （新版重畫了幾格）。經典版要的是舊圖。
#
# 中間那段**舊版本**是補「後來被重畫過」的：經典版客戶端的圖是大改版以前的畫法，
# 有些道具連 TMS/209 都已經是新圖（指紋 0% 吻合），要回到 GMS/83 那個年代才對得上
# （例：黑色蘑菇頭 30190、唇印 1012009、雙結羽毛 31712）。所以規則是
# 「100% 吻合就收工，否則問完全部、挑最吻合的那版」，不是「第一個過門檻的就用」。
REGIONS = [
    "TMS/209",
    "TWMS/256",
    # 舊版本
    "GMS/83",
    "EMS/92",
    "KMS/284",
    "JMS/368",
    "SEA/162",
    "CMS/148",
    "GMS/117",
    "GMS/150",
    # 各服最新版
    "GMS/270",
    "KMS/389",
    "JMS/444",
    "CMS/202",
    "SEA/220",
    "GMS/211.1.0",
]
# 台服的名稱是繁中，可以直接跟客戶端名稱表比對（沒有指紋可驗時的備案）
ZH_TW_REGIONS = {"TMS/209", "TWMS/256"}

# 單件 JSON 是 null、但原始 WZ 其實有圖的道具，改走 WZ 瀏覽端點一個節點一個節點抓
# （見 walk_wz）。一件要幾百個請求，所以只問這幾個版本
WZ_REGIONS = ["TMS/209", "GMS/83", "TWMS/256", "GMS/270", "CMS/202", "SEA/220"]

# 紙娃娃不畫的部位（跟 build-fashion-data.py 的 EXCLUDE_SLOTS 一致）
EXCLUDE_SLOTS = {"ring"}

# 指紋吻合比例的門檻。實際分布是兩極的（同一件 ≈1.0、撞 ID ≈0），取中間即可
MATCH_THRESHOLD = 0.6

# 實測 6 條約每秒 1.1 件、10 條約 1.8 件（TMS/209 沒有 CDN 快取，每件都是現算的）。
# 那是別人免費提供的服務，不要再往上開
WORKERS = 10
TIMEOUT = 60
RETRIES = 3
UA = {"User-Agent": "MapleDetective-fashion-bake/1.0 (+https://github.com/eatbear25/Maple-Detective)"}


class FetchError(Exception):
    pass


def keep_actions():
    """頁面選得到的動作與表情（讀 config.ts，不另外維護一份）。"""
    with open(CONFIG_TS, encoding="utf-8") as f:
        src = f.read()
    names = []
    for const in ("ACTIONS", "EXPRESSIONS"):
        m = re.search(rf"export const {const}\b[^=]*=\s*\[(.*?)\n\];", src, re.S)
        if not m:
            raise SystemExit(f"在 {CONFIG_TS} 找不到 {const}")
        ids = re.findall(r'\bid:\s*"(\w+)"', m.group(1))
        if not ids:
            raise SystemExit(f"{const} 是空的？")
        names += ids
    # 帽子、髮型這類不分動作的部件掛在 default / backDefault 底下
    for extra in ("default", "backDefault"):
        if extra not in names:
            names.append(extra)
    return list(dict.fromkeys(names))


# ===== 客戶端：指紋與 info =====


def client_print(tree):
    """客戶端這件道具所有圖的 (origin, map) 集合。hairShade 不算（見模組 docstring）。"""
    prints = set()

    def walk(node, under_shade):
        if not isinstance(node, dict):
            return
        origin = node.get("origin")
        if isinstance(origin, list) and not under_shade:
            anchors = node.get("map") if isinstance(node.get("map"), dict) else {}
            prints.add(
                (
                    origin[0],
                    origin[1],
                    tuple(sorted((k, v[0], v[1]) for k, v in anchors.items() if isinstance(v, list))),
                )
            )
        for key, child in node.items():
            if key in ("origin", "map"):
                continue
            walk(child, under_shade or key == "hairShade")

    for key, child in tree.items():
        if key != "info":
            walk(child, False)
    return prints


def load_client(wanted):
    """回傳 {itemId: {"print": set, "bare": bool, "info": {...}}}。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: -os.path.getsize(os.path.join(AA_W, f)),  # Character 是最大包
    )
    out = {}
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        hits = [(c, p) for c, p in env.container.items() if CHAR_RE.search(c)]
        if not hits:
            continue
        readers = {r.path_id: r for r in env.objects}
        for cpath, pptr in hits:
            item_id = int(CHAR_RE.search(cpath).group(2))
            if item_id not in wanted:
                continue
            _readers[item_id] = readers[pptr.path_id]  # client_plan 要用時再回頭重讀
            _, tree = wzjs_decode(bytes(readers[pptr.path_id].get_raw_data()), expand_canvas=True)
            raw_info = tree.get("info") if isinstance(tree.get("info"), dict) else {}
            info = {
                "islot": raw_info.get("islot") or "",
                "vslot": raw_info.get("vslot") or "",
                "cash": 1,
            }
            if raw_info.get("invisibleFace"):
                info["invisibleFace"] = 1
            out[item_id] = {
                "print": client_print(tree),
                # 只有 info、沒有任何動作節點 = 透明帽那類，本來就什麼都不畫
                "bare": all(k == "info" for k in tree),
                "info": info,
                # container 的子目錄名就是 WZ 的資料夾名（Cap、Longcoat…），walk_wz 要用
                "folder": CHAR_RE.search(cpath).group(1),
            }
        print(f"客戶端 {fname}：讀到 {len(out)} 件的結構")
        break
    return out


# ===== maplestory.io =====


def http_get(url):
    """回傳回應內容；404 回 None；網路壞掉重試後仍失敗丟 FetchError。"""
    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
                return res.read()
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return None
            last = err
        except Exception as err:  # noqa: BLE001  逾時、連線中斷都重試
            last = err
        time.sleep(2 * (attempt + 1))
    raise FetchError(f"{url}: {last}")


def get_json(url):
    """同 http_get，多解一層 JSON（回應被截斷也算網路壞掉，重試）。"""
    last = None
    for attempt in range(RETRIES):
        body = http_get(url)
        if body is None:
            return None
        try:
            return json.loads(body)
        except ValueError as err:
            last = err
            time.sleep(2 * (attempt + 1))
    raise FetchError(f"{url}: {last}")


def fetch_item(region, item_id):
    """回傳單件 JSON；該版本沒有這件回 None（HTTP 200 + body `null`，不是 404）。"""
    return get_json(f"https://maplestory.io/api/{region}/item/{item_id}")


def client_plan(item_id, keep):
    """客戶端的結構：頁面用得到的每個動作、每一格、每個部件，真正的圖在哪、座標多少。

    回傳 (frames, canvases)：
      frames    {動作: [ {部件名: 圖的路徑} | None, ... ]}
      canvases  {圖的路徑: {"origin", "mapOffset", "position"}}（欄位名照單件 JSON）
    連結（wz 的 UOL）在這裡就解開了，所以同一張圖不管被幾格引用都只有一個路徑。
    """
    with _reader_lock:
        raw = bytes(_readers[item_id].get_raw_data())
    _, tree = wzjs_decode(raw, expand_canvas=True, links=True)

    def at(parts):
        node = tree
        for key in parts:
            if not isinstance(node, dict) or key not in node:
                return None
            node = node[key]
        return node

    def resolve(parts):
        """順著連結走到真正的節點。連結的路徑相對於它的上一層。"""
        for _ in range(8):
            node = at(parts)
            if not isinstance(node, Link):
                return parts, node
            target = parts[:-1]
            for step in node.split("/"):
                if step == "..":
                    target = target[:-1]
                elif step and step != ".":
                    target = target + [step]
            parts = target
        return parts, None

    # 武器底下多一層「套在哪種武器上」的分組；每個動作取第一組有的（規則同 pick_books）
    weapon_types = sorted((k for k in tree if k.isdigit()), key=lambda k: (k != "30", int(k)))
    bases = [[t] for t in weapon_types] or [[]]

    frames, canvases = {}, {}
    for action in keep:
        base = next((b for b in bases if at(b + [action]) is not None), None)
        if base is None:
            continue
        action_parts, action_node = resolve(base + [action])
        if not isinstance(action_node, dict):
            continue
        numbered = sorted((k for k in action_node if k.isdigit()), key=int)
        if numbered:
            rows = [None] * (int(numbered[-1]) + 1)
            cells = [(int(k), action_parts + [k]) for k in numbered]
        else:
            # default / backDefault 與臉的 default：節點本身就是一格
            rows = [None]
            cells = [(0, action_parts)]
        for index, parts in cells:
            parts, frame = resolve(parts)
            if not isinstance(frame, dict):
                continue
            row = {}
            for piece in frame:
                where, canvas = resolve(parts + [piece])
                # 不是圖的（delay、face 這些屬性，或 hairShade 那種資料夾）跳過
                if not isinstance(canvas, dict) or not (
                    canvas.get("_canvas") or "$inlink" in canvas or "$outlink" in canvas
                ):
                    continue
                path = "/".join(where)
                row[piece] = path
                if path in canvases:
                    continue
                origin = canvas.get("origin") if isinstance(canvas.get("origin"), list) else [0, 0]
                attrs = {"origin": {"x": origin[0], "y": origin[1]}}
                # 像素在哪。第三種節點：自己有 origin/map/z、但像素借別張圖的
                # （`$inlink`＝同一個 img 裡的路徑，`$outlink`＝從 wz 根目錄算起、在別的 img）。
                # 武器大量用這個：同一張圖在不同動作裡只是拿的位置不同
                if isinstance(canvas.get("$outlink"), str):
                    attrs["_pixels"] = "/" + canvas["$outlink"]
                else:
                    attrs["_pixels"] = canvas.get("$inlink") or path
                if isinstance(canvas.get("map"), dict):
                    attrs["mapOffset"] = {
                        k: {"x": v[0], "y": v[1]} for k, v in canvas["map"].items() if isinstance(v, list)
                    }
                if canvas.get("z") not in (None, ""):
                    attrs["position"] = canvas["z"]
                canvases[path] = attrs
            rows[index] = row or None
        if any(rows):
            frames[action] = rows
    return frames, canvases


def walk_wz(region, client, item_id, keep):
    """單件端點給不出圖的道具，改從 WZ 瀏覽端點把圖抓回來，組成跟單件 JSON 一樣的形狀。

    回傳 (資料, None) 或 (None, 原因)；原因是 None 代表這個版本根本沒有這個 img。

    maplestory.io 的單件端點要該版本的 String.wz 有這件的名字才會回東西；婚紗、泳裝、
    救生衣、棒球手套這批在各版本都沒登記名字（經典版自己補的），於是單件端點一律
    null——但圖其實好好的在 WZ 裡，`/api/wz/<版本>/Character/<資料夾>/<id>.img/<路徑>`
    一個節點一個節點問得到。

    **只跟它要像素，結構與座標全用客戶端的**（client_plan）。不是偷懶：那個端點穿過
    連結節點讀兩層以下的值會讀錯（`stand1/0/default/map/brow` 回來的是 map 資料夾
    而不是座標，錨點全變 0,0），而連結指向哪它又不給。客戶端兩樣都有。
    順帶把請求數從一件三百多個壓到幾十個（同一張圖只抓一次）。

    驗身：抽幾張圖比 origin（讀一層是正常的），對不上就是撞 ID。
    """
    frames, canvases = client_plan(item_id, keep)
    if not canvases:
        return None, "客戶端在這些動作底下沒有圖"
    base = f"https://maplestory.io/api/wz/{region}/Character/{client['folder']}/{item_id:08d}.img"
    if not get_json(base):
        return None, None

    paths = sorted(canvases)
    for path in paths[:: max(1, len(paths) // 4)][:4]:
        theirs = (get_json(f"{base}/{path}/origin") or {}).get("value") or {}
        mine = canvases[path]["origin"]
        if (theirs.get("x", 0), theirs.get("y", 0)) != (mine["x"], mine["y"]):
            return None, "origin 對不上"

    pixels = {}
    for source in sorted({attrs["_pixels"] for attrs in canvases.values()}):
        # 開頭是 / 的是 $outlink：從 wz 根目錄算起，不在這個 img 底下
        url = f"https://maplestory.io/api/wz/{region}{source}" if source.startswith("/") else f"{base}/{source}"
        node = get_json(url)
        if node and node.get("type") == 12 and node.get("value"):  # 這個端點的 12 是圖
            pixels[source] = node["value"]
    drawable = {path for path, attrs in canvases.items() if attrs["_pixels"] in pixels}
    if len(drawable) < len(canvases) * 0.9:
        return None, f"只拿到 {len(drawable)}/{len(canvases)} 張圖"

    def effect(path):
        attrs = canvases[path]
        return {"image": pixels[attrs["_pixels"]], **{k: v for k, v in attrs.items() if k != "_pixels"}}

    books = {}
    for action, rows in frames.items():
        books[action] = {
            "frames": [
                row and {"effects": {piece: effect(p) for piece, p in row.items() if p in drawable}} for row in rows
            ]
        }
    return {"frameBooks": books}, None


def all_books(data):
    """這件道具所有動作的影格表（含武器的各分組），驗指紋用。"""
    books = list((data.get("frameBooks") or {}).values())
    for sub in (data.get("frameBooksPerWeaponType") or {}).values():
        books += list((sub or {}).values())
    return [b for b in books if b]


def msio_print(data):
    prints = set()
    for book in all_books(data):
        for frame in book.get("frames") or []:
            for effect in ((frame or {}).get("effects") or {}).values():
                if not effect or not effect.get("image"):
                    continue
                origin = effect.get("origin") or {}
                anchors = effect.get("mapOffset") or {}
                prints.add(
                    (
                        origin.get("x", 0),
                        origin.get("y", 0),
                        tuple(sorted((k, v.get("x", 0), v.get("y", 0)) for k, v in anchors.items())),
                    )
                )
    return prints


def pick_books(data, keep):
    """挑要烤的動作。武器每個動作各取第一組有的（30 優先，跟 renderer 的慣例一致）。"""
    flat = data.get("frameBooks") or {}
    per_type = data.get("frameBooksPerWeaponType") or {}
    order = sorted(per_type, key=lambda k: (k != "30", int(k) if k.isdigit() else 999))
    books = {}
    for action in keep:
        for weapon_type in order:
            book = (per_type[weapon_type] or {}).get(action)
            if book and book.get("frames"):
                books[action] = book
                break
        else:
            if flat.get(action):
                books[action] = flat[action]
    return books


# ===== 烤 =====


def pack_atlas(sprites):
    """簡單的層架式排版：依高度排序、一排排往下放。回傳 (圖集, 每張的 [x,y,w,h])。"""
    if not sprites:
        return None, []
    order = sorted(range(len(sprites)), key=lambda i: (-sprites[i].height, -sprites[i].width))
    area = sum(s.width * s.height for s in sprites)
    max_width = max(max(s.width for s in sprites), min(1024, int(area**0.5 * 1.3) + 1))
    rects = [None] * len(sprites)
    x = y = shelf = width = 0
    for i in order:
        sprite = sprites[i]
        if x and x + sprite.width > max_width:
            y += shelf
            x = shelf = 0
        rects[i] = [x, y, sprite.width, sprite.height]
        x += sprite.width
        shelf = max(shelf, sprite.height)
        width = max(width, x)
    atlas = Image.new("RGBA", (width, y + shelf), (0, 0, 0, 0))
    for i, sprite in enumerate(sprites):
        atlas.paste(sprite, (rects[i][0], rects[i][1]))
    return atlas, rects


def bake(data, keep, info):
    """maplestory.io 的單件 JSON → 網站用的精簡格式（見 src/lib/fashion/baked.ts）。"""
    sprites, sprite_index = [], {}
    pieces, piece_index = [], {}
    actions = {}
    for action, book in pick_books(data, keep).items():
        frames = []
        for frame in book.get("frames") or []:
            row = {}
            for name, effect in ((frame or {}).get("effects") or {}).items():
                if not effect or not effect.get("image"):
                    continue  # 空影格（這一格沒有這個部件）
                image = Image.open(io.BytesIO(base64.b64decode(effect["image"]))).convert("RGBA")
                if image.width == 0 or image.height == 0:
                    continue
                digest = hashlib.md5(image.tobytes() + repr(image.size).encode()).digest()
                if digest not in sprite_index:
                    sprite_index[digest] = len(sprites)
                    sprites.append(image)
                origin = effect.get("origin") or {}
                anchors = effect.get("mapOffset")
                piece = [
                    sprite_index[digest],
                    origin.get("x", 0),
                    origin.get("y", 0),
                    effect.get("position") or None,
                    # 沒有 map 與「空的 map」renderer 的處理不同，照原樣留
                    None if anchors is None else {k: [v.get("x", 0), v.get("y", 0)] for k, v in anchors.items()},
                ]
                key = json.dumps(piece, sort_keys=True)
                if key not in piece_index:
                    piece_index[key] = len(pieces)
                    pieces.append(piece)
                row[name] = piece_index[key]
            frames.append(row or None)
        if any(frames):
            actions[action] = frames

    atlas, rects = pack_atlas(sprites)
    encoded = ""
    if atlas is not None:
        buf = io.BytesIO()
        atlas.save(buf, "WEBP", lossless=True, quality=100, method=6)
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return {"info": info, "atlas": encoded, "s": rects, "pc": pieces, "act": actions}, sprites


def synth_icon(baked, sprites):
    """髮型／臉型在 maplestory.io 沒有 icon 欄位，用 default 那一格自己拼一張。"""
    frames = baked["act"].get("default") or baked["act"].get("stand1") or next(iter(baked["act"].values()), None)
    row = next((f for f in frames or [] if f), None)
    if not row:
        return None
    # 名字帶 Below 的在後面、帶 Over 的在前面，夠縮圖用了
    rank = lambda name: (0 if "Below" in name or name.startswith("back") else 2 if "Over" in name else 1)  # noqa: E731
    placed = []
    for name in sorted(row, key=rank):
        sprite_i, ox, oy, _z, anchors = baked["pc"][row[name]]
        ax, ay = next(iter(anchors.values())) if anchors else (0, 0)
        placed.append((sprites[sprite_i], -ox - ax, -oy - ay))
    min_x = min(x for _, x, _ in placed)
    min_y = min(y for _, _, y in placed)
    max_x = max(x + s.width for s, x, _ in placed)
    max_y = max(y + s.height for s, _, y in placed)
    icon = Image.new("RGBA", (max_x - min_x, max_y - min_y), (0, 0, 0, 0))
    for sprite, x, y in placed:
        icon.alpha_composite(sprite, (x - min_x, y - min_y))
    buf = io.BytesIO()
    icon.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def write_icon(item_id, png):
    with open(os.path.join(ICON_DIR, f"{item_id}.png"), "wb") as f:
        f.write(png)


def is_same_item(forward, reverse, hits):
    """指紋算不算同一件。forward＝客戶端的圖有幾成對方也有，reverse＝反過來。

    兩種都算：
    - forward 過門檻：客戶端大部分的圖對方都有（正常情況，絕大多數是 1.0）。
    - 對方的圖客戶端**全都有**、只是客戶端多幾張：單件 JSON 會漏掉巢狀的圖，
      如意金箍棒（1702112）就是對方 71 張全中、客戶端另有 71 張它沒給。
      至少要中 3 張才信，免得圖很少的道具（臉飾只有 1 張）湊巧對上。
    """
    return forward >= MATCH_THRESHOLD or (reverse >= 0.95 and hits >= 3)


def save_baked(item_id, data, keep, info, icon_png):
    baked, sprites = bake(data, keep, info)
    raw = json.dumps(baked, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(os.path.join(ITEM_DIR, f"{item_id}.json"), "wb") as f:
        f.write(raw)
    icon = icon_png or synth_icon(baked, sprites)
    if icon:
        write_icon(item_id, icon)
    entry = {"bytes": len(raw)}
    if not baked["act"]:
        entry["empty"] = 1  # 有圖，但頁面選得到的動作它都沒有
    return entry


def process(item_id, client, name, keep, regions):
    """處理一件。回傳寫進 coverage 的那筆。"""
    rejected = {}
    errors = []
    icon_fallback = None  # 畫不出來的也盡量給張縮圖（名稱對得上才信）
    named_but_empty = False  # 台服有這件、名字也對，但它一張圖都沒有
    best = None  # (排序鍵, 版本, 單件 JSON, forward)
    mine = client["print"]

    # 透明道具不用圖，只是順路拿縮圖，而縮圖只信名稱對得上的台服版本
    if client["bare"]:
        regions = [r for r in regions if r in ZH_TW_REGIONS]

    for region in regions:
        try:
            data = fetch_item(region, item_id)
        except FetchError as err:
            errors.append(f"{region}: {err}")
            continue
        if not data:
            continue

        icon_b64 = (data.get("metaInfo") or {}).get("icon")
        same_name = region in ZH_TW_REGIONS and bool(name) and (data.get("description") or {}).get("name") == name
        if icon_b64 and same_name and icon_fallback is None:
            icon_fallback = base64.b64decode(icon_b64)

        if client["bare"]:
            if icon_fallback is not None:
                break
            continue

        theirs = msio_print(data)
        if not theirs:
            named_but_empty = named_but_empty or same_name
            continue
        if not mine:
            if same_name:  # 客戶端沒有可比的座標，退而求其次比名稱
                best = ((1.0, 1.0), region, data, None)
                break
            continue

        hits = len(mine & theirs)
        forward, reverse = hits / len(mine), hits / len(theirs)
        if not is_same_item(forward, reverse, hits):
            rejected[region] = round(forward, 2)
            continue
        if best is None or (forward, reverse) > best[0]:
            best = ((forward, reverse), region, data, forward)
        if forward >= 1.0:
            break  # 完全吻合，後面的版本不用問了

    if best is not None:
        (_, reverse), region, data, forward = best
        icon_b64 = (data.get("metaInfo") or {}).get("icon")
        entry = {"state": "ok", "src": region}
        entry.update(save_baked(item_id, data, keep, client["info"], base64.b64decode(icon_b64) if icon_b64 else None))
        if forward is not None:
            entry["score"] = round(forward, 2)
            if forward < MATCH_THRESHOLD:
                entry["subset"] = round(reverse, 2)  # 靠「對方的圖客戶端全都有」收的
        return entry

    if icon_fallback is not None:
        write_icon(item_id, icon_fallback)
    if client["bare"] or (not mine and named_but_empty):
        # 後者是透明拳套、透明指虎：客戶端有動作節點但沒有任何座標，台服也一張圖都沒有
        return {"state": "transparent"}

    # 單件端點沒有任何版本給得出圖 → 直接翻 WZ（撞 ID 的不用試，翻出來也是同一份錯的）
    if mine and not rejected:
        for region in WZ_REGIONS:
            try:
                data, why_not = walk_wz(region, client, item_id, keep)
            except FetchError as err:
                errors.append(f"wz {region}: {err}")
                continue
            if data is None:
                if why_not:
                    rejected[f"wz {region}"] = why_not
                continue
            try:
                icon = http_get(f"https://maplestory.io/api/{region}/item/{item_id}/icon")
            except FetchError:
                icon = None
            entry = {"state": "ok", "src": region, "via": "wz"}
            entry.update(save_baked(item_id, data, keep, client["info"], icon))
            return entry

    if errors:
        # 有版本沒問成功，不能下「找不到」的結論；下次執行會再試
        return {"state": "error", "errors": errors[:3]}
    entry = {"state": "missing"}
    if rejected:
        entry["rejected"] = rejected  # 這些版本有同 ID 的道具，但不是同一件
    return entry


def verify(done):
    """把烤好的檔案整批讀一遍：格式對不對、圖集解不解得開、編號有沒有指到外面。"""
    problems = []
    checked = 0
    for raw_id, entry in done.items():
        if entry.get("state") != "ok":
            continue
        path = os.path.join(ITEM_DIR, f"{raw_id}.json")
        try:
            with open(path, encoding="utf-8") as f:
                baked = json.load(f)
            width = height = 0
            if baked["atlas"]:
                atlas = Image.open(io.BytesIO(base64.b64decode(baked["atlas"])))
                atlas.load()
                width, height = atlas.size
            for x, y, w, h in baked["s"]:
                assert w > 0 and h > 0 and x >= 0 and y >= 0, "矩形尺寸不對"
                assert x + w <= width and y + h <= height, "矩形超出圖集"
            for sprite, _ox, _oy, _z, _anchors in baked["pc"]:
                assert 0 <= sprite < len(baked["s"]), "部件指到不存在的圖"
            for frames in baked["act"].values():
                for row in frames:
                    for index in (row or {}).values():
                        assert 0 <= index < len(baked["pc"]), "影格指到不存在的部件"
            assert baked["info"]["islot"] is not None
        except Exception as err:  # noqa: BLE001
            problems.append(f"{raw_id}: {err!r}")
        checked += 1
    stray = [f for f in os.listdir(ITEM_DIR) if done.get(f[: -len(".json")], {}).get("state") != "ok"]
    print(f"檢查 {checked} 個烤好的檔案：{len(problems)} 個有問題、{len(stray)} 個多餘的檔案")
    for line in problems[:20]:
        print("  !!", line)
    return not problems


def main():
    args = sys.argv[1:]
    if "--verify" in args:
        with open(COVERAGE_PATH, encoding="utf-8") as f:
            return 0 if verify(json.load(f)["items"]) else 1
    rebake = "--rebake" in args
    retry_missing = "--retry-missing" in args or "--improve" in args
    improve = "--improve" in args
    only = None
    if "--only" in args:
        only = {int(x) for x in args[args.index("--only") + 1].split(",")}

    keep = keep_actions()
    with open(CASH_PATH, encoding="utf-8") as f:
        cash = json.load(f)["items"]
    with open(os.path.join(REF, "name-tables", "Item.json"), encoding="utf-8") as f:
        names = json.load(f)

    coverage = {"meta": {}, "items": {}}
    if os.path.exists(COVERAGE_PATH) and not rebake:
        with open(COVERAGE_PATH, encoding="utf-8") as f:
            coverage = json.load(f)
        old_meta = coverage.get("meta", {})
        if old_meta.get("format") != FORMAT or old_meta.get("actions") != keep:
            raise SystemExit(
                "動作清單或格式跟上次烤的不一樣。請把本檔的 FORMAT 加 1、"
                "src/lib/fashion/baked.ts 的 DIR 跟著改，再加 --rebake 全部重來。"
                "網址帶版本號是因為這批檔案掛一年的 immutable 快取，同網址換內容訪客拿不到新的"
            )
    done = coverage["items"]

    todo = []
    for raw_id, entry in cash.items():
        if entry["slot"] in EXCLUDE_SLOTS:
            continue
        item_id = int(raw_id)
        if only is not None:
            if item_id in only:
                todo.append(item_id)
            continue
        prev = done.get(raw_id, {})
        state = prev.get("state")
        # --improve：指紋沒有 100% 吻合的也重問一輪（換了版本清單之後，可能有更吻合的那版）
        imperfect = state == "ok" and prev.get("score", 1.0) < 1.0 and prev.get("via") != "wz"
        if (state in ("ok", "transparent") and not (improve and imperfect)) or (
            state == "missing" and not retry_missing
        ):
            continue
        todo.append(item_id)

    print(f"點裝 {sum(1 for e in cash.values() if e['slot'] not in EXCLUDE_SLOTS)} 件，這次要處理 {len(todo)} 件")
    print(f"烤 {len(keep)} 個動作／表情：{' '.join(keep)}")
    if not todo:
        return

    os.makedirs(ITEM_DIR, exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)
    client = load_client(set(todo))
    absent = [i for i in todo if i not in client]
    if absent:
        raise SystemExit(f"客戶端找不到這些 ID 的 wzjson：{absent[:10]}（先重跑 extract-cash-items.py）")
    bare = sum(1 for i in todo if client[i]["bare"])
    blank = sum(1 for i in todo if not client[i]["bare"] and not client[i]["print"])
    print(f"其中透明（客戶端只有 info）{bare} 件、有動作但沒有座標可比 {blank} 件")

    lock = threading.Lock()

    def save():
        coverage["meta"] = {
            "format": FORMAT,
            "actions": keep,
            "regions": REGIONS,
            "updatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        }
        coverage["items"] = dict(sorted(done.items(), key=lambda kv: int(kv[0])))
        tmp = COVERAGE_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(coverage, f, ensure_ascii=False, indent=1)
        os.replace(tmp, COVERAGE_PATH)

    started = time.time()
    tally = {}
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {
            pool.submit(process, i, client[i], (names.get(str(i)) or {}).get("name"), keep, REGIONS): i
            for i in todo
        }
        for n, future in enumerate(as_completed(futures), 1):
            item_id = futures[future]
            try:
                entry = future.result()
            except Exception as err:  # noqa: BLE001  單件壞掉不要拖垮整批
                entry = {"state": "error", "errors": [repr(err)]}
            with lock:
                prev = done.get(str(item_id), {})
                if prev.get("state") == "ok" and entry["state"] != "ok":
                    # 重問一輪反而沒問成功（多半是網路）：原本烤好的那份還在，維持原狀
                    entry = prev
                done[str(item_id)] = entry
                tally[entry["state"]] = tally.get(entry["state"], 0) + 1
            if entry["state"] != "ok":
                print(f"  {item_id} {(names.get(str(item_id)) or {}).get('name')}: {entry}", flush=True)
            if n % 100 == 0 or n == len(todo):
                save()
                rate = n / (time.time() - started)
                print(f"[{n}/{len(todo)}] {tally}  剩約 {(len(todo) - n) / rate / 60:.0f} 分鐘", flush=True)

    # 沒烤成功的不該留著舊檔（--rebake 之後狀態可能變了）
    for fname in os.listdir(ITEM_DIR):
        if done.get(fname[: -len(".json")], {}).get("state") != "ok":
            os.remove(os.path.join(ITEM_DIR, fname))

    states = {}
    sources = {}
    total_bytes = 0
    for entry in done.values():
        states[entry["state"]] = states.get(entry["state"], 0) + 1
        if entry["state"] == "ok":
            sources[entry["src"]] = sources.get(entry["src"], 0) + 1
            total_bytes += entry.get("bytes", 0)
    print("全部狀態：", states)
    print("來源版本：", sources)
    print(f"烤出來共 {total_bytes / 1024 / 1024:.1f} MB")
    if states.get("error"):
        print(f"有 {states['error']} 件網路沒問成功，重跑一次會只補這些")
    verify(done)


if __name__ == "__main__":
    sys.exit(main())
