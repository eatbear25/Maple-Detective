"""抓「各部位時裝佔哪幾格」的對照資料（maplestory.io 那邊的 islot／vslot），修經典版客戶端標錯的。

用法（**要連網**，第一次約十分鐘；已抓過的會跳過）：
    python tools/fetch-fashion-assets.py       # 先烤好圖（要用它記下的來源版本）
    python tools/fetch-slot-reference.py
    python tools/fetch-slot-reference.py --refetch   # 全部重抓
    python tools/build-fashion-data.py         # 對照結果併進 catalog（欄位 sl）

輸出 reference-data/fashion-slot-reference.json：
    { "<id>": { "src": 版本, "islot": "...", "vslot": "..." } | { "src": 版本, "missing": 1 } }

為什麼要有這份（2026-10-29，玩家回報「很多上衣穿了之後褲子就不見了」）：
islot 是道具佔哪幾格、vslot 是它會蓋掉哪幾格，renderer 照這兩個欄位算誰遮住誰
（跟 MapleSalon2 一模一樣的規則）。經典版客戶端把 241 件點裝上衣裡的 92 件標成
`MaPn`（上衣＋褲子，跟套服一樣），台服新舊版、美服新舊版同一件全都是 `Ma`；
圖也只畫到腰，所以褲子一被蓋掉就是光腿。玩家在遊戲商城實際試穿：**褲子還在**
——遊戲並不照這個欄位遮，網站照抄就錯了。定案是照 MapleSalon2（也就是其他版本的 WZ）
的資料走。

只問頁面會用到的那個欄位（WZ 瀏覽端點的 `<img>/info/islot`、`info/vslot`，一個回應
幾十 bytes），不抓整包單件 JSON（有的武器 26MB）。版本用 fashion-coverage.json 記的
「這件的圖借自哪一版」，結構與像素同一個來源才對得上。

髮型／臉型不問：它們的 islot／vslot 是 Hr／Fc 一族，沒有佔錯格的問題。
"""

import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("fetch_fashion_assets", os.path.join(HERE, "fetch-fashion-assets.py"))
ffa = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ffa)

OUT_PATH = os.path.join(ffa.REF, "fashion-slot-reference.json")
COVERAGE_PATH = ffa.COVERAGE_PATH

# cash-items.json 的部位 → WZ 資料夾（跟 src/data/fashion.ts 的 WZ_FOLDER 一致）
FOLDERS = {
    "cap": "Cap",
    "coat": "Coat",
    "longcoat": "Longcoat",
    "pants": "Pants",
    "shoes": "Shoes",
    "glove": "Glove",
    "cape": "Cape",
    "accessory": "Accessory",
    "weapon": "Weapon",
    "shield": "Shield",
}
WORKERS = 8


def value(url):
    node = ffa.get_json(url)
    return node.get("value") if isinstance(node, dict) and isinstance(node.get("value"), str) else None


def fetch(item_id, folder, region):
    base = f"https://maplestory.io/api/wz/{region}/Character/{folder}/{int(item_id):08d}.img/info"
    islot = value(f"{base}/islot")
    vslot = value(f"{base}/vslot")
    if islot is None and vslot is None:
        return {"src": region, "missing": 1}
    return {"src": region, "islot": islot or "", "vslot": vslot or ""}


def main():
    refetch = "--refetch" in sys.argv
    with open(ffa.CASH_PATH, encoding="utf-8") as f:
        cash = json.load(f)["items"]
    with open(COVERAGE_PATH, encoding="utf-8") as f:
        coverage = json.load(f)["items"]
    done = {}
    if os.path.exists(OUT_PATH) and not refetch:
        with open(OUT_PATH, encoding="utf-8") as f:
            done = json.load(f)["items"]

    todo = []
    for item_id, entry in cash.items():
        folder = FOLDERS.get(entry["slot"])
        src = coverage.get(item_id, {}).get("src")
        if not folder or not src or coverage[item_id].get("state") != "ok":
            continue
        if item_id in done and done[item_id].get("src") == src:
            continue
        todo.append((item_id, folder, src))
    print(f"這次要問 {len(todo)} 件")

    lock = threading.Lock()
    errors = 0
    started = time.time()
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(fetch, *job): job[0] for job in todo}
        for n, future in enumerate(as_completed(futures), 1):
            item_id = futures[future]
            try:
                entry = future.result()
            except ffa.FetchError as err:
                errors += 1
                print(f"  {item_id}: {err}")
                continue
            with lock:
                done[item_id] = entry
            if n % 200 == 0 or n == len(todo):
                print(f"[{n}/{len(todo)}] {time.time() - started:.0f} 秒")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {"updatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")},
                "items": dict(sorted(done.items(), key=lambda kv: int(kv[0]))),
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
    print(f"共 {len(done)} 件（其中查不到 {sum(1 for e in done.values() if e.get('missing'))} 件）")
    if errors:
        print(f"有 {errors} 件網路沒問成功，重跑一次會只補這些")


if __name__ == "__main__":
    sys.exit(main())
