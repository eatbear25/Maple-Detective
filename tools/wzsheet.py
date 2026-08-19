"""客戶端 .wzspritesheet（圖集索引）與 .wzjson 素材定義的解析器。

用途：把 Map 的圖磚／物件／背景從客戶端 bundle 裡取出來，重繪整張地圖。
遊戲更新後版面若變動，先跑本檔的 __main__ 自我檢查。

### .wzspritesheet 版面（MonoBehaviour raw bytes，2026-08 逆向）

    [12B 標頭][u32][u32][8B hash][字串: 素材集名稱，長度前綴、補齊 4B]
    [20×u32 目錄表][字串: 資產路徑][…][字串: 32 字元 hash][8B 0]
    [u32 資料區長度][資料區 …]

目錄表（相對資料區起點的 offset）：
    hdr[0]  圖集頁數（<name>_<page>.png）
    hdr[7]/hdr[8]   矩形數 / 矩形表（每筆 16B = x, y, w, h）
    hdr[9]/hdr[10]  同上數量 / 索引表（每筆 20B，第 3 欄 = 該圖在第幾頁圖集）
    hdr[11]/hdr[12] 別名數 / 別名表（每筆 16B）。編號 >= 矩形數的圖是舊 wz 的
                    _inlink/_outlink 重複圖，沒有自己的矩形，第 4 欄指向真正的矩形。
    hdr[19] 後面那個字串的長度
    其餘欄位語意未確認（本專案用不到）。

資料區起點沒有直接寫在標頭裡，用「32 字元 hash 字串 + 8B 0 + u32 長度」定位，
並以 `起點 + 長度 == 檔案長度` 驗證（素材集名稱本身也可能長得像 hash，要逐一試）。

### .wzjson 素材定義

圖磚/物件/背景的每一張圖在 wzjson 裡是一個 type=18（null）節點，底下掛
`origin`（vector）與 `z`（int）。origin 存的是 IEEE float 被當成 int32 塞進
vector 值池，要轉回來。

### ⚠ 未解：圖編號 → 矩形編號的對應（2026-08-18 卡關）

矩形表是「圖集打包順序」，跟名稱沒有關係，wzjson 裡也沒有任何欄位直接寫編號。
已排除的假設：
  * origin 的值池索引 → 只有 Tile 對得上（Tile 剛好每個 vector 都是 origin）
  * type=18 節點的前序序號 → Obj/Back 都錯位（畫出來會出現不相干的圖）
  * 兩張 hash 表對接 → 一張 36 字元、一張 40 字元，雜湊算法不同，前綴也不同
  * 節點的 `前序`／保留欄位 → 都是節點指標，不是圖編號

證據顯示打包順序是「匯出器走訪 wz 樹的順序」，而那個順序跟 wzjson 節點表的順序
不一致（例：Back/darkMountain 的別名剛好 4 筆＝`ani` 群組的 4 張圖，代表 `back`
群組排在 `ani` 前面，但節點表是 `ani` 在前）。這個順序沒有存在客戶端資料裡。

**目前可用的部分**：Tile 用「值池索引＝矩形編號」是對的（已目視驗證整套
darkMountain 圖磚）。Obj/Back 要正確取圖得先解出上面那個順序。
"""

import re
import struct

_HASH = re.compile(rb"\x20\x00\x00\x00[0-9a-f]{32}")


def _str(raw, off):
    """讀長度前綴字串，回傳 (字串, 下一個 4B 對齊位置)。"""
    n = struct.unpack_from("<I", raw, off)[0]
    return raw[off + 4 : off + 4 + n].decode(), (off + 4 + n + 3) & ~3


def parse_sheet(raw: bytes):
    """回傳 {"name", "pages", "rects", "page", "alias"}。用 resolve() 查圖。"""
    name, off = _str(raw, 12 + 4 + 4 + 8)
    hdr = struct.unpack_from("<20I", raw, off)
    for m in _HASH.finditer(raw):
        end = m.end() + 8
        if end + 4 > len(raw):
            continue
        size = struct.unpack_from("<I", raw, end)[0]
        base = end + 4
        if base + size != len(raw):
            continue
        count = hdr[7]
        rects = [struct.unpack_from("<4i", raw, base + hdr[8] + i * 16) for i in range(count)]
        pages = [struct.unpack_from("<5i", raw, base + hdr[10] + i * 20)[2] for i in range(hdr[9])]
        alias = {}
        for i in range(hdr[11]):
            sid, _, _, target = struct.unpack_from("<4i", raw, base + hdr[12] + i * 16)
            if 0 <= target < count:
                alias[sid] = target
        if rects and all(0 <= p < hdr[0] for p in pages) and all(w > 0 and h > 0 for _, _, w, h in rects):
            return {"name": name, "pages": hdr[0], "rects": rects, "page": pages, "alias": alias}
    raise ValueError(f"{name}.wzspritesheet 版面對不上，格式可能改了")


def _f32(v):
    return struct.unpack("<f", struct.pack("<i", v))[0]


def parse_assets(raw: bytes):
    """解 Tile/Obj/Back 的 wzjson，回傳 {"bsc/0": {"sprite", "origin", "z"}, ...}。

    key 是節點在樹裡的路徑（去掉最外層的素材集名稱）。
    """
    wz = raw.find(b"WZJS")
    h = struct.unpack_from("<36I", raw, wz - 144)
    at = lambda o: wz + o  # noqa: E731
    offs = struct.unpack_from(f"<{h[26] + 1}I", raw, at(h[28]))
    pool = at(h[27])
    names = [raw[pool + offs[i] : pool + offs[i + 1]].decode() for i in range(h[26])]
    ints = struct.unpack_from(f"<{h[10]}i", raw, at(h[11])) if h[10] else ()
    vecs = struct.unpack_from(f"<{h[16] * 2}i", raw, at(h[17])) if h[16] else ()
    nodes = [struct.unpack_from("<8I", raw, at(h[1]) + i * 32) for i in range(h[0])]

    out = {}
    ordinal = {i: n for n, i in enumerate(j for j in range(h[0]) if nodes[j][0] == 18)}

    def walk(i, prefix):
        t, name_idx, _, first, cnt, *_ = nodes[i]
        if prefix is None:  # 最外層是素材集名稱，不進路徑
            path = ""
        else:
            path = f"{prefix}/{names[name_idx]}" if prefix else names[name_idx]
        if t == 18:
            entry = {}
            for c in range(first, first + cnt):
                kt, kn, kv, *_ = nodes[c]
                if names[kn] == "origin" and kt == 14:
                    entry["sprite"] = ordinal[i]
                    entry["origin"] = (_f32(vecs[kv * 2]), _f32(vecs[kv * 2 + 1]))
                elif names[kn] == "z" and kt == 6:
                    entry["z"] = ints[kv]
            if "sprite" in entry:
                out[path.lstrip("/")] = entry
        for c in range(first, first + cnt):
            walk(c, path)

    walk(0, None)
    return out


def resolve(sheet, sprite_id):
    """圖編號 → 矩形編號（處理重複圖的別名），查不到回 None。"""
    if 0 <= sprite_id < len(sheet["rects"]):
        return sprite_id
    return sheet["alias"].get(sprite_id)
