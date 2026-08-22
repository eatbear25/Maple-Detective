"""從客戶端圖集切出技能圖示 → public/icons/skill/<skillId>.png。

用法：
    pip install UnityPy pillow
    python tools/extract-skill-icons.py

輸入 reference-data/skill-icon-map.json（技能 → 圖集位置或參考站檔名，見下），
輸出 public/icons/skill/*.png。

## `.wzspritesheet`（WZSS）格式，版本 4 —— 2026-08-22 逆向

檔案是 MonoBehaviour，raw bytes 版面（不需要 typetree）：

    [MonoBehaviour 標頭 + m_Name][19×u32 目錄表]["WZSS"][u32 版本=4][各區段]

目錄表在 **offset 36**（m_GameObject 12B + m_Enabled 4B + m_Script 12B +
m_Name 長度前綴 4B + 名稱補齊到 4 的倍數），欄位（位址都相對 "WZSS" magic）：

    hdr[0]  圖頁數（同資料夾的 <name>_0.png、_1.png…）
    hdr[8]  矩形表位址   hdr[9]  矩形數（= 不重複的圖數）
    hdr[10] sprite 表位址（每筆 20B = 5×u32）
    hdr[11] 別名數        hdr[12] 別名表位址（每筆 16B = 4×u32）
    hdr[13] sprite 總數（= 矩形數 + 別名數，可拿來驗證解析對不對）

    矩形 = 4×u32 (x, y, w, h)
    sprite 筆 = (spriteIdx, rectIdx, ?, ?, originIdx)
    別名筆 = (spriteIdx, 0xFFFFFFFF, 0xFFFFFFFF, rectIdx)  ← 指到別人的矩形

### 三個非踩不可的坑

1. **y 是從圖的「底部」量的**。要用 `crop((x, H-y-h, x+w, H-y))`，H 是那張圖頁
   的高度。直接用 (x, y) 切會拿到別的圖——而且常常也是一張看得懂的圖示，
   所以不會馬上發現錯了。
2. **sprite 筆的第 3 個欄位不是圖頁編號**。新手包(000)有 4 張圖頁，那個欄位
   會給 0~3，但 32×32 的圖示其實全部在最後一張。目前的做法是按「哪一頁切出來
   不是純色塊」來決定（見 pick_page）。
3. **圖集只有座標，沒有名字**。矩形的排列順序是打包器的內部順序，跟 wzjson 的
   節點順序、前序欄位、字母序全都對不上（三種都驗過）。所以「哪張圖是哪個技能」
   **無法從客戶端資料推出來**，必須靠外部比對——這就是 skill-icon-map.json 的用途。

## skill-icon-map.json 怎麼來的

用 https://jamox80.github.io/maplestory-skill-simulator/ 的圖示當比對鑰匙：
把它每張圖跟客戶端切出來的 32×32 候選做像素比對（疊白底後算平均差），差 0 即同一張。
110 個 1/2 轉技能裡 93 個這樣認出來，其餘 17 個客戶端比對不到就直接存它的圖
（map 裡 src="ref"）。技能圖示在同一職業的候選裡是「三件組」——一般／灰階（未習得）
／高亮（滑鼠移上去），三者正規化灰階幾乎相同；**彩度最高的那張才是一般版本**
（用 50 個已知答案驗過，49 比 1）。

遊戲更新後如果 sprite 編號跑掉，重跑比對即可；比對腳本沒有留在 repo 裡，
但上面這段說明足以重建。
"""

import json
import os
import struct
import sys

import UnityPy
from PIL import Image

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(PROJECT, "reference-data", "skill-icon-map.json")
OUT_DIR = os.path.join(PROJECT, "public", "icons", "skill")

SHEET_DIR = "/SpriteSheet/TW/Skill/"


def find_sheet_bundle():
    """掃非 json 的 bundle 找 container path 含 /SpriteSheet/TW/Skill/ 的那包。"""
    files = sorted(
        (f for f in os.listdir(AA_W) if f.endswith(".bundle") and f.startswith("spritesheet_")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
        reverse=True,  # Skill 圖集是最大的那包（~175MB），先試大的
    )
    for fname in files:
        env = UnityPy.load(os.path.join(AA_W, fname))
        if any(SHEET_DIR in p for p in env.container):
            return fname, env
    raise SystemExit(f"在 {AA_W} 找不到 {SHEET_DIR}")


def parse_sheet(raw, pages):
    """回傳 {spriteIdx: (x, y, w, h)}。座標是原始值，y 仍是從底部量。"""
    m = raw.find(b"WZSS")
    if m == -1:
        raise ValueError("找不到 WZSS magic")
    version = struct.unpack_from("<I", raw, m + 4)[0]
    if version != 4:
        raise ValueError(f"WZSS 版本 {version}，此解碼器只驗證過版本 4")
    hdr = struct.unpack_from("<19I", raw, 36)
    npages, roff, nrect = hdr[0], hdr[8], hdr[9]
    soff, nalias, aoff, nsprite = hdr[10], hdr[11], hdr[12], hdr[13]
    assert npages == len(pages), f"圖頁數不符：表說 {npages}、實際 {len(pages)}"
    assert nrect + nalias == nsprite, f"不重複圖 {nrect} + 別名 {nalias} != 總數 {nsprite}"
    rects = [struct.unpack_from("<4I", raw, m + roff + k * 16) for k in range(nrect)]
    out = {}
    for k in range(nrect):
        e = struct.unpack_from("<5I", raw, m + soff + k * 20)
        out[e[0]] = rects[e[1]]
    for k in range(nalias):
        a = struct.unpack_from("<4I", raw, m + aoff + k * 16)
        out[a[0]] = rects[a[3]]
    return out


def pick_page(pages, rect):
    """挑出這個矩形真正所在的圖頁：切出來不是純色塊的那張（見 docstring 坑 2）。"""
    x, y, w, h = rect
    best, best_var = None, -1.0
    for page in pages:
        pw, ph = page.size
        if x + w > pw or y + h > ph:
            continue
        crop = page.crop((x, ph - y - h, x + w, ph - y))
        ext = crop.convert("L").getextrema()
        var = ext[1] - ext[0]
        if var > best_var:
            best, best_var = crop, var
    return best


def main():
    if not os.path.exists(MAP_PATH):
        raise SystemExit(f"缺少 {MAP_PATH}（技能 → 圖集位置的對照表）")
    with open(MAP_PATH, encoding="utf-8") as f:
        icon_map = json.load(f)

    fname, env = find_sheet_bundle()
    cont = env.container
    readers = {r.path_id: r for r in env.objects}
    os.makedirs(OUT_DIR, exist_ok=True)

    jobs = sorted({v["job"] for v in icon_map.values() if v.get("src") == "client"})
    sprites, pages_of = {}, {}
    for job in jobs:
        sheet = next((p for c, p in cont.items() if c.endswith(f"/Skill/{job}.wzspritesheet")), None)
        if sheet is None:
            print(f"  找不到 {job}.wzspritesheet，略過")
            continue
        pages, i = [], 0
        while True:
            p = next((pp for c, pp in cont.items() if c.endswith(f"/Skill/{job}_{i}.png")), None)
            if p is None:
                break
            pages.append(p.read().image.convert("RGBA"))
            i += 1
        raw = bytes(readers[sheet.path_id].get_raw_data())
        sprites[job] = parse_sheet(raw, pages)
        pages_of[job] = pages

    n_ok, n_skip = 0, 0
    for sid, v in icon_map.items():
        dest = os.path.join(OUT_DIR, f"{sid}.png")
        if v.get("src") != "client":
            n_skip += 1  # 參考站來源的圖不重切，保留現有檔案
            continue
        job = v["job"]
        rect = sprites.get(job, {}).get(v["sprite"])
        if rect is None:
            print(f"  {sid} {v.get('name','')}：圖集裡沒有 sprite {v['sprite']}")
            continue
        img = pick_page(pages_of[job], rect)
        if img is None:
            print(f"  {sid} {v.get('name','')}：矩形超出所有圖頁")
            continue
        img.save(dest)
        n_ok += 1
    print(f"{fname}：切出 {n_ok} 個圖示 → {OUT_DIR}（{n_skip} 個來自參考站，未覆蓋）")


if __name__ == "__main__":
    sys.exit(main())
