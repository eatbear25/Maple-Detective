"""從客戶端抽出「月妙的年糕」第一階段地圖（迎月花山丘 910010000）的攻略資料。

用法：
    pip install UnityPy
    python tools/extract-moonbunny-map.py

輸出 src/data/generated/moon-bunny-map.json：地形、繩子、14 叢草（各掉哪色種子）、
6 朵迎月花（各收哪色種子）、月妙的位置。前端拿它畫一張攻略示意圖。

顏色怎麼來的（兩邊都是客戶端硬資料，不是猜的）：
  * 花：Reactor/9108000–9108005 每個 state 0 的 event 帶「要放進來的道具 id」
    （4001095–4001100），直接讀出來就是該平台收哪一色。
  * 草：Reactor/9102002–9102007 的 action 是 moonItem0–moonItem5，序號 N 對應
    種子 4001095+N。掉落本身是伺服器決定的、客戶端沒有，但這個對應關係已用
    社群整理的實機截圖交叉驗證過 14 叢全中。

地圖座標沿用遊戲世界座標（y 向下為正），畫圖用的邊界取自 miniMap 的
centerX/centerY/width/height。
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

import numpy as np
import UnityPy
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "moon-bunny-map.json")
NAME_TABLES = os.path.join(PROJECT, "reference-data", "name-tables")
IMG_DIR = os.path.join(PROJECT, "public", "maps")

MAP_ID = "910010000"
RENDER_SOURCES = ["TMS/209", "GMS/62"]
HEADERS = {"User-Agent": "maple-detective/1.0 (fan site asset fetch)"}
SKY = (18, 22, 40)  # 底圖的天空是透明的，壓一層夜空色免得透出頁面背景
PAD_TOP = 100  # 最上面兩朵花的標記會畫到圖外，往上補一截天空
# 要重鋪的下層地面帶（世界座標）。上緣落在主地面（y=93）的草與裝飾植物之下、
# 下層平台（213/273）的植物之上；下緣落在最低那排平台底下的純土裡。
BAND_TOP, BAND_BOTTOM = 138, 345
STRIP_UP, STRIP_DN = 10, 26  # 草皮帶相對地面線的上下範圍（含草底下的暗影）
LAD_L, LAD_R = 38, 26  # 梯子圖相對 ladderRope x 的左右範圍
RUNG = 17  # 梯子橫木的週期（自相關量出來的），接長梯子時當基準
PATCH_W = 34  # 高低差補丁的半寬
SEED_BASE = 4001095  # 淺綠 / 紫 / 淺紫 / 黃褐 / 黃 / 藍，連號六色


def load_bundle(prefix, target_suffix):
    """掃 <prefix>_*.bundle 找含指定 container 的那包（hash 檔名每次更新都變）。

    回傳 (env, {容器路徑: raw bytes})。MonoScript 參照在 monoscripts 包裡，
    要一起載入才解得開。
    """
    monoscripts = [f for f in os.listdir(AA_W) if f.startswith("monoscripts_")]
    for fname in sorted(
        (f for f in os.listdir(AA_W) if f.startswith(prefix) and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    ):
        env = UnityPy.load(*[os.path.join(AA_W, f) for f in [fname, *monoscripts]])
        if any(p.endswith(target_suffix) for p in env.container):
            by_id = {r.path_id: r for r in env.objects}
            return {p: bytes(by_id[ptr.path_id].get_raw_data()) for p, ptr in env.container.items()}
    raise SystemExit(f"找不到含 {target_suffix} 的 {prefix}*.bundle")


def fetch_render():
    """抓地圖底圖（RGBA，天空是透明的）。回傳 (圖, 來源版本)。"""
    for src in RENDER_SOURCES:
        url = f"https://maplestory.io/api/{src}/map/{MAP_ID}/render"
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
        except Exception:
            continue
        import io as _io

        return Image.open(_io.BytesIO(data)).convert("RGBA"), src
    raise SystemExit("抓不到地圖底圖，maplestory.io 掛了或沒網路")


def align(footholds, img):
    """求底圖原點：world (x, y) 畫在底圖的 (x + dx, y + dy)。

    以「平台上緣」像素當對位特徵。地形一定整個在圖內，dx/dy 的可行範圍就被
    地形外框限死了，直接掃完取最高分。草叢會蓋住平台邊緣，命中率不會是 100%，
    但正確位移的分數遠高於其他位移，峰值很尖銳。
    """
    solid = np.array(img)[:, :, 3] > 128
    edge = np.zeros_like(solid)
    edge[1:] = solid[1:] & ~solid[:-1]
    h, w = solid.shape

    pts = set()
    for x1, y1, x2, y2 in footholds:
        steps = max(1, int(abs(x2 - x1) // 8))
        for i in range(steps + 1):
            t = i / steps
            pts.add((round(x1 + (x2 - x1) * t), round(y1 + (y2 - y1) * t)))
    xs, ys = (np.array(a) for a in zip(*sorted(pts)))

    best = (-1, 0, 0)
    for dx in range(max(0, -xs.min()), w - xs.max()):
        for dy in range(max(0, -ys.min()), h - ys.max()):
            rows = np.clip(ys + dy, 0, h - 1)
            score = sum(edge[np.clip(rows + off, 0, h - 1), xs + dx].sum() for off in (-2, -1, 0, 1, 2))
            if score > best[0]:
                best = (score, dx, dy)
    score, dx, dy = best
    print(f"  底圖對位：原點 ({dx}, {dy})，{score}/{len(xs)} 個地形取樣點落在平台上緣")
    return dx, dy


def fetch_io_footholds(src):
    """底圖那一版的地形。底圖是照它畫的，跟客戶端比對才知道哪幾段要搬。"""
    req = urllib.request.Request(f"https://maplestory.io/api/{src}/map/{MAP_ID}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    return [[f["x1"], f["y1"], f["x2"], f["y2"]] for f in data["footholds"].values()]


def rebuild_ground(flat, footholds, io_footholds, ropes, ox, oy):
    """照客戶端 footholds 重鋪下層那幾排平台。

    maplestory.io 的 render 是照「它那一版」的地形畫的，跟現行 Gamania 版不一樣：
    下層平台在 TMS/209 是三長段，現行版切成五段（244 高 / 116 低交錯）。兩版的
    高低差固定是 60px，所以主體做法是「整欄上下平移 60px」——草皮、長在上面的
    裝飾、平台底下的陰影會一起搬過去，畫面還是原本的美術，不會有拼貼痕跡。
    平移之後補三件事：

      1. 相鄰兩段平移量不同的地方＝新的高低差，貼一塊 io 自己的階梯美術
         （下坡用上坡鏡像）。
      2. io 自己的高低差若落在現行版本的平坦段中間，貼一塊乾淨草皮抹平。
      3. 梯子掛在上面那層地面、不能跟著平移，所以先擦掉、最後照原位貼回；
         平台變低導致梯子構不到時，從梯身中間插入整數個橫木週期把它接長。

    補洞素材一律自己組「整塊純土 + 一條乾淨草皮」：土絕不左右拼貼（土紋很有
    個性，重複會看出鎖鏈狀花紋），也不搬任何一叢草過去（複製或鏡像的草叢非常
    顯眼）。踩過的坑都寫在各段註解裡，別再走回頭路。
    """
    A = np.array(flat).astype(float)
    T, B = BAND_TOP, BAND_BOTTOM

    def surf(segs):
        """x → 地面高度；只取落在下層帶裡的水平段，用半開區間讓高低差落在正確的 x。"""
        d = {}
        for x1, y1, x2, y2 in segs:
            if y1 == y2 and T < y1 < B:
                for x in range(int(min(x1, x2)), int(max(x1, x2))):
                    d[x] = y1
        return d

    io_surf, cl_surf = surf(io_footholds), surf(footholds)
    xs = sorted(set(io_surf) & set(cl_surf))
    if not xs:
        raise SystemExit("底圖與客戶端的下層地形對不上，地面重鋪中止")
    delta = {x: cl_surf[x] - io_surf[x] for x in xs}
    bounds = [x for x in xs[1:] if delta[x] != delta[x - 1]]
    io_steps = [x for x in xs[1:] if io_surf[x] != io_surf[x - 1]]
    cl_steps = [(x, "down" if cl_surf[x] > cl_surf[x - 1] else "up")
                for x in xs[1:] if cl_surf[x] != cl_surf[x - 1]]
    lad_x = [r["x"] for r in ropes if r["y2"] > T]

    def green_of(arr):
        a = arr.astype(int)
        return (a[:, :, 1] > a[:, :, 0] + 18) & (a[:, :, 1] > a[:, :, 2] + 18) & (a[:, :, 1] > 50)

    def plant_tops(arr):
        """每欄「長在草皮上的植物」最高點；沒有植物就等於草皮上緣。"""
        gm = green_of(arr)
        out = {}
        for x in xs:
            g = io_surf[x] - 2
            col = gm[T + oy:g - 6 + oy, x + ox]
            run = col[:-2] & (col[1:-1] | col[2:])  # 連兩點才算，單一雜點會害接縫高度亂跳
            idx = np.flatnonzero(run)
            out[x] = (T + int(idx[0])) if len(idx) else g
        return out

    def ramp(n, k):
        w = np.ones(n)
        k = min(k, n // 2)
        if k:
            w[:k] = np.linspace(0, 1, k)
            w[-k:] = np.linspace(1, 0, k)
        return w

    def paste(dst, src, x0, y0, fx=10, fy=10):
        h, w = src.shape[:2]
        wgt = (ramp(h, fy)[:, None] * ramp(w, fx)[None, :])[:, :, None]
        dst[y0:y0 + h, x0:x0 + w] = dst[y0:y0 + h, x0:x0 + w] * (1 - wgt) + src * wgt

    def near_ladder(x0, x1, pad=18):
        return any(x0 - pad <= r + LAD_R and r - LAD_L <= x1 + pad for r in lad_x)

    # 純土帶：最低那排草皮以下全是土，補土素材都從這裡挖。下緣得真的量出來，
    # 底圖最下面幾列是天空。
    dirt_top = max(io_surf.values()) + STRIP_DN + 4
    dirt_bad = green_of(A) | (np.abs(A.astype(int) - np.array(SKY)).max(axis=2) < 14)
    dirt_bot = A.shape[0] - oy - 1
    while (dirt_bot > dirt_top + 40
           and dirt_bad[dirt_bot + oy, xs[0] + 20 + ox:xs[-1] - 20 + ox].mean() > 0.005):
        dirt_bot -= 1
    dirt_used = []

    def dirt_run(width, height):
        """從純土帶挖一整塊寬 width、高 height 的土（整塊取，絕不左右拼貼）。"""
        height = min(height, dirt_bot - dirt_top)
        cands = []
        for top in (dirt_bot - height, dirt_top):
            for x in range(xs[0] + 20, xs[-1] - width - 20, 4):
                n = int(dirt_bad[top + oy:top + height + oy, x + ox:x + width + ox].sum())
                if n <= 24:
                    far = min([abs(x - u) for u in dirt_used] or [9999])
                    cands.append((n == 0, far, x, top))
            if any(c[0] for c in cands):
                break
        if not cands:
            raise SystemExit(f"找不到 {width}x{height} 的純土")
        _, _, x, top = max(cands)  # 優先全乾淨，其次離上次取過的地方遠一點
        blk = A[top + oy:top + height + oy, x + ox:x + width + ox].copy()
        m = dirt_bad[top + oy:top + height + oy, x + ox:x + width + ox].copy()
        for off in (24, -24, 48, -48, 72):  # 零星草點用旁邊的土蓋掉
            if not m.any():
                break
            alt, am = np.roll(blk, off, axis=1), np.roll(m, off, axis=1)
            fix = m & ~am
            blk[fix] = alt[fix]
            m &= am
        dirt_used.append(x)
        return blk

    def stack(parts, overlap=8):
        h = sum(p.shape[0] for p in parts) - overlap * (len(parts) - 1)
        out = np.zeros((h, parts[0].shape[1], 3))
        acc = np.zeros((h, 1, 1))
        y = 0
        for i, p in enumerate(parts):
            w = np.ones(p.shape[0])
            if i:
                w[:overlap] = np.linspace(0, 1, overlap)
            if i < len(parts) - 1:
                w[-overlap:] = np.linspace(1, 0, overlap)
            out[y:y + p.shape[0]] += p * w[:, None, None]
            acc[y:y + p.shape[0]] += w[:, None, None]
            y += p.shape[0] - overlap
        return out / np.maximum(acc, 1e-6)

    def dirt_tall(width, height):
        """要的高度超過純土帶本身就上下接幾段（接縫交叉淡化）。"""
        avail = dirt_bot - dirt_top
        parts = [dirt_run(width, min(avail, height))]
        while sum(p.shape[0] for p in parts) - 8 * (len(parts) - 1) < height:
            parts.append(dirt_run(width, min(avail, height)))
        return stack(parts)[:height] if len(parts) > 1 else parts[0][:height]


    def grass_windows(level, width, tops, thresh, need_delta0):
        """找幾段乾淨的同高度草皮：沒植物、沒梯子、離高低差夠遠。"""
        steps = io_steps + [t for t, _ in cl_steps]
        found, s = [], xs[0]
        while s + width <= xs[-1]:
            win = range(s, s + width)
            if (all(io_surf.get(x) == level for x in win)
                    and not (need_delta0 and any(delta.get(x) != 0 for x in win))
                    and not near_ladder(s, s + width)
                    and not any(s - 18 <= t <= s + width + 18 for t in steps)
                    and all(tops[x] >= io_surf[x] - thresh for x in win)):
                found.append(s)
                s += width
            else:
                s += 1
        return found

    def profile(level, tops):
        """同高度平台每一列的平均亮度。土在平台底下有陰影、越深越亮，
        補土素材直接從深處搬過來會亮一塊，得照這條曲線校正回去。"""
        steps = io_steps + [t for t, _ in cl_steps]
        cols = [x for x in xs
                if io_surf[x] == level and tops[x] >= level - 10
                and not near_ladder(x, x, pad=30)
                and not any(abs(x - t) < 30 for t in steps)]
        return A[T + oy:B + oy, [c + ox for c in cols]].mean(axis=(1, 2))

    def blank_platform(level, width, tops, need_delta0=False):
        """組出寬 width 的「空平台」：整塊純土 + 一條乾淨草皮，不帶任何植物。"""
        unit = None
        for th in (10, 18, 30, 48, 90):
            for u in (96, 80, 64, 52, 44, 36):
                got = grass_windows(level, u, tops, th, need_delta0)
                if got:
                    unit, starts = u, got[::max(1, len(got) // 4)][:4]
                    break
            if unit:
                break
        if unit is None:
            raise SystemExit(f"找不到 level={level} 的草皮素材")
        s0, s1 = level - STRIP_UP, level + STRIP_DN
        tiles = [A[s0 + oy:s1 + oy, st + ox:st + unit + ox] for st in starts]
        strip = np.zeros((s1 - s0, width, 3))
        acc = np.zeros((s1 - s0, width, 1))
        x, i = 0, 0
        while x < width:  # 只有草皮那幾列會左右拼貼，草是均勻的、看不出來
            w = min(unit, width - x)
            wgt = ramp(unit, 14)[None, :, None][:, :w]
            strip[:, x:x + w] += tiles[i % len(tiles)][:, :w] * wgt
            acc[:, x:x + w] += wgt
            x += unit - 14
            i += 1
        blk = stack([dirt_tall(width, s0 - T + 8), strip / np.maximum(acc, 1e-6),
                     dirt_tall(width, B - s1 + 8)])
        gain = np.clip(profile(level, tops) / np.maximum(blk.mean(axis=(1, 2)), 1e-6), 0.75, 1.35)
        return np.clip(blk * gain[:, None, None], 0, 255)

    # ---- 1. 先擦掉梯子（最後貼回）與跨越平移邊界的裝飾（不擦會被切一半）----
    tops = plant_tops(A)
    work = A.copy()

    def erase(x0, x1, level):
        """把 x0..x1 換成空平台；只蓋到草皮下緣為止，蓋越少接縫越短。"""
        blk = blank_platform(level, x1 - x0 + 24, tops)[:level + STRIP_DN + 6 - T]
        paste(work, blk, x0 - 12 + ox, T + oy, fx=22, fy=14)

    for r in lad_x:
        erase(r - LAD_L, r + LAD_R, io_surf[r - LAD_L])

    clusters = []
    for x in xs:
        if tops[x] < io_surf[x] - 10:
            if clusters and x - clusters[-1][1] <= 6:
                clusters[-1][1] = x
            else:
                clusters.append([x, x])
    for x0, x1 in clusters:
        if any(x0 < b < x1 for b in bounds) and len({io_surf[x] for x in range(x0, x1 + 1)}) == 1:
            erase(x0, x1, io_surf[x0])
    tops = plant_tops(work)

    # ---- 2. 逐欄垂直平移 ----
    out = work.copy()
    seam = {}
    for x in xs:
        if delta[x]:
            g = io_surf[x] - 2
            # 接縫要落在「草皮與長在上面的植物」之上，兩邊才都不會被切到
            seam[x] = max(g + min(delta[x], 0) - (g - tops[x]) - 6,
                          T + 42 if delta[x] > 0 else T + 8)
    for x, j0 in seam.items():
        # 取鄰近九欄的中位數：單欄的偵測誤差會讓那欄從別的高度取土，
        # 在土裡拉出一條 1px 的細線，非常顯眼
        j = int(np.median([seam.get(x + k, j0) for k in range(-4, 5)]))
        d, px = delta[x], x + ox
        w = np.clip((np.arange(T, B) - j) / 6 + 0.5, 0, 1)[:, None]
        out[T + oy:B + oy, px] = (work[T + oy:B + oy, px] * (1 - w)
                                  + work[T - d + oy:B - d + oy, px] * w)

    # ---- 3. 高低差與接縫補丁 ----
    tops_out = plant_tops(out)
    up_src = next((t for t, k in cl_steps if k == "up" and t not in bounds), None)
    for t, kind in cl_steps:
        if t in bounds and up_src is not None:
            blk = out[T + oy:B + oy, up_src - PATCH_W + ox:up_src + PATCH_W + ox].copy()
            paste(out, blk[:, ::-1] if kind == "down" else blk,
                  t - PATCH_W + ox, T + oy, fx=12, fy=12)
    for b in bounds:
        if b not in [t for t, _ in cl_steps]:  # io 自己的高低差落在平坦段上，抹平
            paste(out, blank_platform(cl_surf[b], 2 * PATCH_W, tops_out, need_delta0=True),
                  b - PATCH_W + ox, T + oy, fx=12, fy=12)

    # ---- 4. 梯子貼回原位 ----
    gm = green_of(A)
    for r in lad_x:
        sl = (slice(T + oy, B + oy), slice(r - LAD_L + ox, r + LAD_R + ox))
        alpha = np.clip((np.abs(A[sl] - work[sl]).max(axis=2) - 35) / 35, 0, 1)
        alpha[gm[sl]] = 0  # 草不算梯子，免得把舊草皮一起貼回來
        m = Image.fromarray(((alpha > 0.4) * 255).astype(np.uint8))
        m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))  # 補梯子內部破洞
        m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # 去掉土紋雜點
        alpha = np.maximum(alpha, np.array(m) / 255.0)
        alpha = np.array(Image.fromarray((alpha * 255).astype(np.uint8))
                         .filter(ImageFilter.GaussianBlur(0.6)))[:, :, None] / 255.0
        colour = A[sl]
        rows = np.flatnonzero((alpha[:, :, 0] > 0.5).sum(axis=1) >= 5)  # 橫木／繩結那種成片的列
        bottom = T + int(rows[-1]) if len(rows) else T
        if bottom < cl_surf[r] - RUNG // 2:
            # 平台比底圖那版低，梯子會懸空。梯身是週期性的，從中間插入整數個
            # 橫木週期就能接到新平台。長度不寫死成 17 的倍數——週期不是整數 px，
            # 硬套會看到橫木錯開；改成在「剛好夠長」的範圍裡挑最對得起來的。
            body = slice(0, cl_surf[r] - 8 - T)
            wgt = alpha[body, :, 0]
            best = None
            for length in range(cl_surf[r] - bottom - RUNG // 2, cl_surf[r] - bottom + RUNG + 1):
                if T + length >= B or bottom + length > cl_surf[r] + RUNG:
                    continue
                w = np.minimum(wgt[length:], wgt[:-length])[:, :, None]
                err = float((np.abs(colour[body][length:] - colour[body][:-length]) * w).sum()
                            / max(w.sum(), 1))
                if best is None or err < best[0]:
                    best = (err, length)
            if best:
                idx = np.concatenate([np.arange(best[1]), np.arange(B - T - best[1])])
                alpha, colour = alpha[idx], colour[idx]
                alpha[cl_surf[r] - 2 - T:] = 0  # 接長後梯腳的投影會落到草上，切掉
        out[sl] = out[sl] * (1 - alpha) + colour * alpha

    moved = sum(1 for x in xs if delta[x])
    print(f"  地面重鋪：{len(xs)} 欄有 {moved} 欄要平移、補 {len(bounds)} 處接縫、"
          f"貼回 {len(lad_x)} 座梯子")
    return Image.fromarray(out.round().clip(0, 255).astype(np.uint8))


def main():
    maps = load_bundle("json_", f"/{MAP_ID}.wzjson")
    raw = next(v for k, v in maps.items() if k.endswith(f"/{MAP_ID}.wzjson"))
    _, m = wzjs_decode(raw)

    reactors = load_bundle("json_", "/Reactor/9108000.wzjson")
    reactor_tree = {}
    for cpath, rb in reactors.items():
        if "/Reactor/" in cpath:
            rid = os.path.basename(cpath).removesuffix(".wzjson")
            if rid.startswith("9102") or rid.startswith("9108"):
                reactor_tree[rid] = wzjs_decode(rb)[1]

    def flower_item(rid):
        """花 reactor state 0 的 event 第 0 個欄位 = 要放上去的種子 id。"""
        return reactor_tree[rid]["0"]["event"]["0"]["0"]

    def bush_item(rid):
        """草 reactor 的 action moonItemN → 種子 4001095+N。"""
        action = reactor_tree[rid].get("action") or reactor_tree["9102002"]["action"]
        return SEED_BASE + int(action.removeprefix("moonItem"))

    bushes, flowers = [], []
    for r in m["reactor"].values():
        entry = {"x": r["x"], "y": r["y"]}
        if r["name"].startswith("moonflower"):
            flowers.append({**entry, "itemId": flower_item(r["id"])})
        elif r["name"] == "nut":
            bushes.append({**entry, "itemId": bush_item(r["id"])})
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

    render, render_src = fetch_render()
    io_footholds = fetch_io_footholds(render_src)
    origin_x, origin_y = align(footholds, render)
    flat = Image.new("RGB", (render.width, render.height + PAD_TOP), SKY)
    flat.paste(render, (0, PAD_TOP), render)
    origin_y += PAD_TOP
    os.makedirs(IMG_DIR, exist_ok=True)
    flat = rebuild_ground(flat, footholds, io_footholds, ropes, origin_x, origin_y)
    # 存 WebP：底圖是點陣美術，同畫質下比 PNG 小一半以上
    flat.save(os.path.join(IMG_DIR, f"{MAP_ID}.webp"), "WEBP", quality=88, method=6)

    data = {
        "meta": {
            "source": f"客戶端 Map/{MAP_ID}.wzjson + Reactor/9102002-9108005",
            "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "script": "tools/extract-moonbunny-map.py",
        },
        "mapId": int(MAP_ID),
        "mapName": map_name,
        # 底圖與座標原點：world (x, y) 畫在圖上的 (x + originX, y + originY)
        "image": {
            "src": f"/maps/{MAP_ID}.webp",
            "width": flat.width,
            "height": flat.height,
            "originX": origin_x,
            "originY": origin_y,
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
    print(f"{map_name}：{len(bushes)} 叢草、{len(flowers)} 朵花、{len(footholds)} 段地形 → {OUT_PATH}")
    for fl in flowers:
        print(f"  花 ({fl['x']:>5},{fl['y']:>5})  {data['seedNames'][str(fl['itemId'])]}")


if __name__ == "__main__":
    main()
