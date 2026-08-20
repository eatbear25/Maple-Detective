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
    節點 type：2=目錄、5=long、6=int、11=字串、12=canvas（圖在 spritesheet
    bundle，這裡無資料）、14=vector、18=null。

**canvas 節點是有子節點的**（origin / delay / z 這些屬性掛在它底下），只是型別不是 2。
預設仍照舊只展開目錄（維持既有腳本的輸出不變）；要讀圖的 origin/delay 就傳
`expand_canvas=True`，任何 childCount>0 的節點都會展成 dict。
"""

import struct

_DIR = 2


def _strings(raw: bytes, count: int, pool: int, tab: int) -> list[str]:
    offs = struct.unpack_from(f"<{count + 1}I", raw, tab)
    return [raw[pool + offs[i] : pool + offs[i + 1]].decode("utf-8") for i in range(count)]


def decode(raw: bytes, expand_canvas: bool = False):
    """解出 (根節點名稱, 樹)。目錄→dict、int/long→int、字串→str、vector→[x,y]、
    canvas/null/未知型別→None（expand_canvas=True 時，有子節點的一律展成 dict）。"""
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
        else:  # 12=canvas、18=null、其他未見過的型別
            value = None
        return names[name_idx], value

    return build(0)
