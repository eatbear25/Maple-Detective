"""把時裝的「道具特效層」（Effect/ItemEff）從 maplestory.io 抓回來、驗過、烤成靜態檔。

用法（**要連網**，約十分鐘；已烤好的會跳過）：
    python tools/extract-cash-items.py         # 先有點裝清單
    python tools/fetch-item-effects.py         # 只處理還沒處理過的
    python tools/fetch-item-effects.py --rebake          # 全部重來（格式改了，記得 FORMAT +1）
    python tools/fetch-item-effects.py --only 1005576,1102955
    python tools/build-fashion-data.py         # 把「有特效層」併進 catalog（欄位 fx）

輸出：
    public/wz-static/fashion/fx-v<FORMAT>/<id>.json   一件一檔（格式見 src/lib/fashion/baked.ts）
    reference-data/fashion-fx-coverage.json            每件的狀態與來源版本

為什麼要有這層（2026-10-29，玩家回報「森林護者帽子穿上去看不到」）：
有些時裝的外觀不在 Character 包，而在 `Effect/ItemEff.wzjson`。catalog 裡有 59 件在
這張表，其中 33 件的本體只是一張 1×1 空圖、外觀**全部**在特效層（多半是披風，
另有森林／黑夜護者帽子、獨眼死神），其餘是本體有圖、特效疊在上面的光效。
fetch-fashion-assets.py 只烤本體，所以這 33 件穿上去什麼都看不到。

另放一個資料夾、不併進本體的檔案：本體那批掛一年的 immutable 快取，同網址換內容
訪客拿不到新的；併進去就得把八千多件全部重烤一次換網址。

結構與座標全用客戶端的，只跟 maplestory.io 的 WZ 瀏覽端點要像素（跟
fetch-fashion-assets.py 的 walk_wz 同一套理由）。單件 JSON 雖然也有這層
（`itemEffects.entries.effect`），但它是一串**沒有動作名**的清單、筆數還跟客戶端
對不上（森林護者帽子 37 筆 vs 客戶端 35 個動作），靠順序對應不可靠。
驗身：抽幾張圖比 origin，對不上就換下一個版本。

客戶端的結構（`<id>/effect/`）：
  action / actionExceptRotation / fixed / z     最上層的屬性（z 是預設值）
  <動作>/pos, <動作>/z                          這個動作的錨點偏移與前後
  <動作>/<格>                                   圖（origin、delay），多半是連到
                                                default／backDefault 的連結
畫法（定位規則出自 MapleSalon2 的 categorizedItem.resolveEffectFrames，它註明
沿用 MapleNecrocer）寫在 src/lib/fashion/renderer.ts 的 buildItemEffectTracks。

不收的：情侶 T 恤那 3 件（1048001、1048002、1049000）底下不是 effect 而是 0／1，
是「靠近另一半才出現」的特效，紙娃娃沒有另一半。
"""

import base64
import hashlib
import importlib.util
import io
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

import UnityPy
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wzjs import Link, decode as wzjs_decode  # noqa: E402

# 動作清單、HTTP、圖集打包跟本體的烤圖工具共用同一份，不另外維護
_spec = importlib.util.spec_from_file_location("fetch_fashion_assets", os.path.join(HERE, "fetch-fashion-assets.py"))
ffa = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ffa)

AA_W = ffa.AA_W
PROJECT = ffa.PROJECT
CASH_PATH = ffa.CASH_PATH
COVERAGE_PATH = os.path.join(ffa.REF, "fashion-fx-coverage.json")
CONTAINER = "Assets/WzAssets/Json/Effect/ItemEff.wzjson"

# 輸出格式版本。改了格式就 +1（網址跟著變，舊快取自然失效），
# src/lib/fashion/baked.ts 的 FX_DIR 要一起改
FORMAT = 1
OUT_DIR = os.path.join(PROJECT, "public", "wz-static", "fashion", f"fx-v{FORMAT}")

# 台服舊版優先（時代最接近經典版），新道具只有新版本才有
REGIONS = ["TMS/209", "TWMS/256", "GMS/83", "GMS/270", "KMS/389", "JMS/444", "CMS/202", "SEA/220"]
IMG = "Effect/ItemEff.img"
WORKERS = 6
DEFAULT_DELAY = 120  # 沒寫 delay 的格（MapleSalon2 同值）


def load_client():
    """回傳 ItemEff 的整棵樹（連結保留成 Link，圖展成帶 _canvas 的 dict）。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )
    for fname in bundles:
        if os.path.getsize(os.path.join(AA_W, fname)) > 100_000_000:
            continue  # Character／Map 那幾包不可能有，省得把大包讀進記憶體
        env = UnityPy.load(os.path.join(AA_W, fname))
        if CONTAINER not in env.container:
            continue
        reader = {r.path_id: r for r in env.objects}[env.container[CONTAINER].path_id]
        _, tree = wzjs_decode(bytes(reader.get_raw_data()), expand_canvas=True, links=True)
        print(f"ItemEff 包 = {fname}：{len(tree)} 件道具")
        return tree
    raise SystemExit(f"在 {AA_W} 找不到 {CONTAINER}")


def is_canvas(node):
    return isinstance(node, dict) and (node.get("_canvas") or "$inlink" in node or "$outlink" in node)


def client_plan(tree, item_id, keep):
    """這件道具的特效：頁面用得到的每個動作是哪一組格、錨點偏移與前後。

    回傳 (books, act, canvases)：
      books     [{"pos", "z", "f": [圖的路徑, ...]}]，連到同一組圖的動作共用一本
      act       {動作: books 的索引}
      canvases  {圖的路徑: {"origin": [x, y], "delay": n, "_pixels": 像素在哪}}
    路徑從 ItemEff.img 的根算起（<id>/effect/...），連結在這裡就解開了。
    """

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

    root = [str(item_id), "effect"]
    effect = at(root)
    if not isinstance(effect, dict):
        return [], {}, {}
    default_z = effect.get("z") if isinstance(effect.get("z"), int) else -1

    books, book_index, act, canvases = [], {}, {}, {}
    for action in keep:
        if action not in effect:
            continue
        parts, node = resolve(root + [action])
        if not isinstance(node, dict):
            continue
        # pos／z 掛在動作這一層（連結過去的話，以連結本身那一層沒有屬性，取目標的）
        own = at(root + [action])
        meta = own if isinstance(own, dict) else node
        pos = meta.get("pos") if isinstance(meta.get("pos"), int) else None
        z = meta.get("z") if isinstance(meta.get("z"), int) else default_z

        frames = []
        for key in sorted((k for k in node if k.isdigit()), key=int):
            where, canvas = resolve(parts + [key])
            if not is_canvas(canvas):
                break  # 中間斷掉就只取到這裡（MapleSalon2 也是遇到缺格就停）
            path = "/".join(where)
            if path not in canvases:
                origin = canvas.get("origin") if isinstance(canvas.get("origin"), list) else [0, 0]
                delay = canvas.get("delay") if isinstance(canvas.get("delay"), int) and canvas["delay"] > 0 else None
                if isinstance(canvas.get("$outlink"), str):
                    pixels = "/" + canvas["$outlink"]  # 從 wz 根目錄算起、在別的 img
                elif isinstance(canvas.get("$inlink"), str):
                    pixels = canvas["$inlink"]  # 同一個 img 裡的另一張
                else:
                    pixels = path
                canvases[path] = {"origin": origin, "delay": delay or DEFAULT_DELAY, "_pixels": pixels}
            frames.append(path)
        if not frames:
            continue
        key = json.dumps([pos, z, frames])
        if key not in book_index:
            book_index[key] = len(books)
            books.append({"pos": pos, "z": z, "f": frames})
        act[action] = book_index[key]
    return books, act, canvases


def fetch_pixels(item_id, canvases):
    """依序問各版本：origin 抽驗對得上的那版，把每張圖的像素抓回來。回傳 (版本, {像素路徑: PNG})。"""
    reasons = {}
    # 抽驗的圖平均分散在各本（全擠在 default 的話驗不到背面那本）
    paths = sorted(canvases)
    step = max(1, len(paths) // 4)
    paths = paths[::step] + [p for i, p in enumerate(paths) if i % step]
    for region in REGIONS:
        base = f"https://maplestory.io/api/wz/{region}/{IMG}"
        if not ffa.get_json(f"{base}/{item_id}/effect"):
            continue
        checked, ok = 0, True
        for path in paths:
            if checked >= 4:
                break
            theirs = (ffa.get_json(f"{base}/{path}/origin") or {}).get("value")
            if not isinstance(theirs, dict):
                continue  # 對方在這裡是連結之類的，讀不到座標，換一張驗
            mine = canvases[path]["origin"]
            if (theirs.get("x", 0), theirs.get("y", 0)) != (mine[0], mine[1]):
                # 對方這格是「借別張像素」的 _inlink 節點時，端點穿過去讀到的是被借那張的
                # origin（破舊魔女披風的 proneStab：客戶端 63,34、它回 39,-12），驗不了，換一張
                node = ffa.get_json(f"{base}/{path}") or {}
                if "_inlink" in (node.get("children") or []):
                    continue
                ok = False
                break
            checked += 1
        if not ok or not checked:
            reasons[region] = "origin 對不上" if not ok else "沒有可驗的 origin"
            continue
        pixels = {}
        for source in sorted({c["_pixels"] for c in canvases.values()}):
            url = f"https://maplestory.io/api/wz/{region}{source}" if source.startswith("/") else f"{base}/{source}"
            node = ffa.get_json(url)
            if node and node.get("type") == 12 and node.get("value"):  # 這個端點的 12 是圖
                pixels[source] = base64.b64decode(node["value"])
        if len(pixels) < len({c["_pixels"] for c in canvases.values()}):
            reasons[region] = f"只拿到 {len(pixels)} 張圖"
            continue
        return region, pixels, reasons
    return None, None, reasons


def bake(books, act, canvases, pixels):
    sprites, sprite_index, frame_of = [], {}, {}
    for path, canvas in canvases.items():
        image = Image.open(io.BytesIO(pixels[canvas["_pixels"]])).convert("RGBA")
        digest = hashlib.md5(image.tobytes() + repr(image.size).encode()).digest()
        if digest not in sprite_index:
            sprite_index[digest] = len(sprites)
            sprites.append(image)
        frame_of[path] = [sprite_index[digest], canvas["origin"][0], canvas["origin"][1], canvas["delay"]]
    atlas, rects = ffa.pack_atlas(sprites)
    buf = io.BytesIO()
    atlas.save(buf, "WEBP", lossless=True, quality=100, method=6)
    return {
        "atlas": base64.b64encode(buf.getvalue()).decode("ascii"),
        "s": rects,
        "b": [{"pos": b["pos"], "z": b["z"], "f": [frame_of[p] for p in b["f"]]} for b in books],
        "act": act,
    }


def process(tree, item_id, keep):
    node = tree.get(str(item_id))
    if not isinstance(node, dict) or "effect" not in node:
        return {"state": "skipped", "reason": "不是 effect（情侶特效那類）"}
    books, act, canvases = client_plan(tree, item_id, keep)
    if not books:
        return {"state": "skipped", "reason": "頁面選得到的動作都沒有特效"}
    try:
        region, pixels, reasons = fetch_pixels(item_id, canvases)
    except ffa.FetchError as err:
        return {"state": "error", "errors": [str(err)]}
    if region is None:
        entry = {"state": "missing"}
        if reasons:
            entry["rejected"] = reasons
        return entry
    raw = json.dumps(bake(books, act, canvases, pixels), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(os.path.join(OUT_DIR, f"{item_id}.json"), "wb") as f:
        f.write(raw)
    return {"state": "ok", "src": region, "bytes": len(raw), "books": len(books), "frames": len(canvases)}


def main():
    args = sys.argv[1:]
    rebake = "--rebake" in args
    only = None
    if "--only" in args:
        only = {int(x) for x in args[args.index("--only") + 1].split(",")}

    keep = ffa.keep_actions()
    with open(CASH_PATH, encoding="utf-8") as f:
        cash = json.load(f)["items"]
    wanted = {int(i) for i, e in cash.items() if e["slot"] not in ffa.EXCLUDE_SLOTS}

    coverage = {"meta": {}, "items": {}}
    if os.path.exists(COVERAGE_PATH) and not rebake:
        with open(COVERAGE_PATH, encoding="utf-8") as f:
            coverage = json.load(f)
        old = coverage.get("meta", {})
        if old.get("format") != FORMAT or old.get("actions") != keep:
            raise SystemExit("動作清單或格式跟上次烤的不一樣：FORMAT 加 1、baked.ts 的 FX_DIR 跟著改，再加 --rebake")
    done = coverage["items"]

    tree = load_client()
    todo = []
    for raw_id in tree:
        if not raw_id.isdigit() or int(raw_id) not in wanted:
            continue
        item_id = int(raw_id)
        if only is not None:
            if item_id in only:
                todo.append(item_id)
            continue
        if done.get(raw_id, {}).get("state") in ("ok", "skipped", "missing"):
            continue
        todo.append(item_id)
    print(f"ItemEff 裡是時裝的 {sum(1 for k in tree if k.isdigit() and int(k) in wanted)} 件，這次要處理 {len(todo)} 件")
    if not todo:
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    lock = threading.Lock()
    tally = {}
    started = time.time()
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(process, tree, i, keep): i for i in todo}
        for n, future in enumerate(as_completed(futures), 1):
            item_id = futures[future]
            try:
                entry = future.result()
            except Exception as err:  # noqa: BLE001  一件壞掉不要拖垮整批，記下來下次重試
                entry = {"state": "error", "errors": [f"{type(err).__name__}: {err}"]}
            with lock:
                done[str(item_id)] = entry
                tally[entry["state"]] = tally.get(entry["state"], 0) + 1
            if entry["state"] != "ok":
                print(f"  {item_id}: {entry}")
            if n % 10 == 0 or n == len(todo):
                print(f"[{n}/{len(todo)}] {tally}  {time.time() - started:.0f} 秒")

    coverage["meta"] = {
        "format": FORMAT,
        "actions": keep,
        "regions": REGIONS,
        "updatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
    }
    coverage["items"] = dict(sorted(done.items(), key=lambda kv: int(kv[0])))
    with open(COVERAGE_PATH, "w", encoding="utf-8") as f:
        json.dump(coverage, f, ensure_ascii=False, indent=1)
    states = {}
    for entry in done.values():
        states[entry["state"]] = states.get(entry["state"], 0) + 1
    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f"全部狀態：{states}，烤出來共 {total / 1048576:.1f} MB")
    if tally.get("error"):
        print(f"有 {tally['error']} 件網路沒問成功，重跑一次會只補這些")


if __name__ == "__main__":
    sys.exit(main())
