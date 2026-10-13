"""WZJS 二進位格式通用解碼器（版本 5，2026-08 逆向完成）。

用法：
    from wzjs import decode
    root_name, tree = decode(raw_bytes)   # raw = MonoBehaviour 的 get_raw_data()

版面（所有 offset 都相對 "WZJS" magic 位置）：
    [MonoBehaviour 標頭 + m_Name][36×u32 目錄表]["WZJS"][u32 版本=5][節點表]…值池…
    目錄表是 18 組 (count, offset) 配對：
      h[0]/h[1]   節點數 / 節點表起點（每節點 32B = 8×u32：
                  type, nameIdx, valIdx, firstChild, childCount, parent, 前序, 保留）
      h[8]/h[9]   long 值池（8B/筆，type 5）
      h[10]/h[11] int 值池（4B/筆，type 6；結尾可能有對齊 padding，用 count 讀）
      h[16]/h[17] vector 值池（2×**float32**/筆，type 14；origin/map 等座標都在這，
                  各包實測皆為 float，值都是整數，回傳時轉成 int）
      h[26]/h[27] 名稱字串池（h[28] 是名稱 offset 表 = count+1 個前綴和）
      h[32]/h[33] 字串值池（h[34] 是 offset 表；valIdx 為 0-based 直接索引）
      其餘配對在已掃描的檔案中皆為空池，語意未確認。
    節點 type：2=目錄、5=long、6=int、11=字串、14=vector、
    18=圖（canvas；像素在 spritesheet bundle，這裡只有掛在它底下的 origin/map/z/delay）、
    12=連結（舊 wz 的 UOL；沒有子節點，valIdx 指向字串值池裡的相對路徑）。

**12 與 18 以前記反了**（寫成 12=canvas、18=null）。2026-10-13 把 Character 包的原始節點表
印出來才確認：帽子 `stand1/0/default` 是 type 12、valIdx 指到字串 `../../default/default`；
`default/default` 才是 type 18、底下掛 origin/map/z。連結的路徑是相對於**它的上一層**
（`..` 從所在的那一格往上算）。Map 包的 type 18 同樣是圖（見 tools/wzsheet.py）。

**圖節點是有子節點的**（origin / delay / z 這些屬性掛在它底下），只是型別不是 2。
預設仍照舊只展開目錄（維持既有腳本的輸出不變）；要讀圖的 origin/delay 就傳
`expand_canvas=True`，任何 childCount>0 的節點都會展成 dict。

要知道連結指向哪就再傳 `links=True`：type 12 回傳 `Link`（str 的子類別，值是相對路徑）
而不是 None，type 18 展成的 dict 會多一個 `"_canvas": True` 方便跟一般目錄區分。
用法見 tools/fetch-fashion-assets.py 的 client_plan。
"""

import struct

_DIR = 2
_LINK = 12
_CANVAS = 18


class Link(str):
    """連結節點（舊 wz 的 UOL）：值是相對路徑，指向同一個 img 裡真正的那張圖。"""


def _strings(raw: bytes, count: int, pool: int, tab: int) -> list[str]:
    offs = struct.unpack_from(f"<{count + 1}I", raw, tab)
    return [raw[pool + offs[i] : pool + offs[i + 1]].decode("utf-8") for i in range(count)]


def decode(raw: bytes, expand_canvas: bool = False, links: bool = False):
    """解出 (根節點名稱, 樹)。目錄→dict、int/long→int、字串→str、vector→[x,y]、
    圖/連結/未知型別→None（expand_canvas=True 時，有子節點的一律展成 dict；
    links=True 時連結→Link、圖→帶 `_canvas` 記號的 dict）。"""
    wz = raw.find(b"WZJS")
    if wz == -1:
        raise ValueError("找不到 WZJS magic")
    version = struct.unpack_from("<I", raw, wz + 4)[0]
    if version != 5:
        raise ValueError(f"WZJS 格式版本 {version}，此解碼器只驗證過版本 5")

    h = struct.unpack_from("<36I", raw, wz - 144)
    a = lambda off: wz + off  # noqa: E731

    ints = struct.unpack_from(f"<{h[10]}i", raw, a(h[11])) if h[10] else ()
    longs = struct.unpack_from(f"<{h[8]}q", raw, a(h[9])) if h[8] else ()
    vecs = struct.unpack_from(f"<{h[16] * 2}f", raw, a(h[17])) if h[16] else ()
    names = _strings(raw, h[26], a(h[27]), a(h[28]))
    svals = _strings(raw, h[32], a(h[33]), a(h[34]))

    node_base = a(h[1])
    nodes = [struct.unpack_from("<8I", raw, node_base + i * 32) for i in range(h[0])]

    def build(i: int):
        t, name_idx, val_idx, first, cnt, *_ = nodes[i]
        if links and t == _CANVAS:
            node = dict(build(c) for c in range(first, first + cnt)) if cnt else {}
            node["_canvas"] = True
            return names[name_idx], node
        if links and t == _LINK:
            return names[name_idx], Link(svals[val_idx])
        if t == _DIR or (expand_canvas and cnt):
            return names[name_idx], dict(build(c) for c in range(first, first + cnt))
        if t == 6:
            value = ints[val_idx]
        elif t == 11:
            value = svals[val_idx]
        elif t == 5:
            value = longs[val_idx]
        elif t == 14:  # 座標，float 但值都是整數
            value = [int(vecs[val_idx * 2]), int(vecs[val_idx * 2 + 1])]
        else:  # 12=連結、沒有子節點的 18=圖、其他未見過的型別
            value = None
        return names[name_idx], value

    return build(0)
