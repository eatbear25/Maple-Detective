"""從楓之谷經典版客戶端抽取裝備數值（Character/ 底下每件裝備的 info 節點）。

用法：
    pip install UnityPy
    python tools/extract-equip-info.py

輸出 reference-data/equip-info.json，結構：
    { "meta": {...}, "equips": { "<itemId>": { reqLevel, reqSTR, reqDEX, reqINT,
      reqLUK, reqPOP?, reqJob, attackSpeed?, tuc?, inc...（非零才留） } } }

原理：Character/ 那包 bundle（掃描時 141MB、8044 物件）的 container path 是
    Assets/WzAssets/Json/Character/<子類>/<8碼補零ID>.wzjson
每檔是 WZJS 二進位（見 tools/wzjs.py），info 子樹就是舊 wz 的裝備 info：
需求值（reqLevel/reqSTR/...）、能力加成（incPAD/incLUK/...）、攻擊速度
（attackSpeed）、可使用捲軸次數（tuc）。Hair/Face 也在 Character/ 底下，
用「ID >= 1000000」過濾掉。掉落機率一樣不在客戶端，這裡只有裝備本身數值。
"""

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

import UnityPy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "reference-data", "equip-info.json")

PATH_RE = re.compile(r"/Character/[^/]+/(\d{8})\.wzjson$")

# info 節點裡對彈窗有用的欄位；inc* 另外用前綴撈（非零才留）
KEEP = ("reqLevel", "reqSTR", "reqDEX", "reqINT", "reqLUK", "reqPOP", "reqJob", "attackSpeed", "tuc")


def pick_fields(info: dict) -> dict:
    out = {}
    for k in KEEP:
        v = info.get(k)
        if isinstance(v, int):
            out[k] = v
    for k, v in info.items():
        if k.startswith("inc") and isinstance(v, int) and v != 0:
            out[k] = v
    return dict(sorted(out.items()))


def main():
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: -os.path.getsize(os.path.join(AA_W, f)),  # Character 是最大包，大的先掃
    )
    equips = {}
    src_bundles = []
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        hits = [(c, p) for c, p in env.container.items() if PATH_RE.search(c)]
        if not hits:
            continue
        readers = {r.path_id: r for r in env.objects}
        n = 0
        for cpath, pptr in hits:
            item_id = int(PATH_RE.search(cpath).group(1))
            if item_id < 1_000_000:  # Hair/Face 也放在 Character/，跳過
                continue
            _, tree = decode(bytes(readers[pptr.path_id].get_raw_data()))
            info = tree.get("info")
            if isinstance(info, dict):
                equips[str(item_id)] = pick_fields(info)
                n += 1
        print(f"{fname}: 裝備 {n} 件")
        src_bundles.append(fname)

    if not equips:
        raise SystemExit(f"在 {AA_W} 找不到任何 Character/ 裝備資料")

    # 抽樣驗證（舊 wz 已知數值：1302000 寶劍 攻擊 17、捲軸 7）
    sword = equips["1302000"]
    assert sword.get("incPAD") == 17 and sword.get("tuc") == 7, f"寶劍數值異常: {sword}"
    print("抽樣：寶劍 =", sword)
    print("抽樣：鋰礦鬥拳 =", equips.get("1472009"))

    out = {
        "meta": {
            "source": [f"{b} -> Assets/WzAssets/Json/Character/" for b in src_bundles],
            "extractedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "equips": len(equips),
        },
        "equips": dict(sorted(equips.items(), key=lambda kv: int(kv[0]))),
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"已寫入 {OUT_PATH}（{len(equips)} 件，{os.path.getsize(OUT_PATH) // 1024} KB）")


if __name__ == "__main__":
    main()
