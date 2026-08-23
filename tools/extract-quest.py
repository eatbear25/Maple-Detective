"""從楓之谷經典版客戶端抽取任務資料與 NPC 出沒地圖。

用法：
    pip install UnityPy
    python tools/extract-quest.py

輸出：
    reference-data/quest.json    任務原始資料（QuestInfo/Check/Act + 中文名稱表）
    reference-data/npc-map.json  NPC id → 出沒地圖 id 清單

定位方式：掃 json_*.bundle 的 container path（Assets/WzAssets/Json/...）。
bundle 檔名帶內容雜湊、每次遊戲更新都會變，所以絕對不能寫死檔名。

## 任務資料在哪

一個 <1MB 的小包裡（掃描時是 json_d0204d27...）裝了整組 Quest/：

    Quest/QuestInfo.wzjson  area / order
    Quest/Check.wzjson      npc / lvmin / lvmax / item / quest(前置) / job / mob
    Quest/Act.wzjson        item(可負數) / exp / money / skill / pop / nextQuest
    Quest/Say.wzjson        NPC 對話（本專案不用，不抽）

中文在另一包（掃描時是 json_a2909ccd...）的 String/TW/QuestData.json。

## 兩個踩過的坑

1. QuestInfo 的字串值池只有 12 筆，內容是「欄位名本身」（name/parent/demandSummary…）。
   Gamania 把文字掏空搬去本地化檔了，所以 QuestInfo 的 name/parent 是垃圾，
   中文一律從 QuestData.json 拿。連帶 rewardSummary/demandSummary 在客戶端是空的。
2. QuestData.json 雖然是 TextAsset，UnityPy 給的 m_Script 是用 surrogateescape 解過的 str，
   要 encode('utf-8','surrogateescape') 再 decode('utf-8') 才拿得回原文。它是 UTF-8 不是 Big5。

## NPC → 地圖

Check 只給 NPC id。Map 包（掃描時 json_573635e...，44MB）裡數字命名的
Map/MapN/<9碼>.wzjson 共 705 張（另外 79/75/72 個 container 是 Back/Tile/Obj 素材），
每張的 life 節點列出該圖的怪與 NPC，type == "n" 的就是 NPC。

實測：任務用到 155 個 NPC，97 個查得到地圖。查不到的 58 個裡 57 個屬於未實裝任務，
另 14 個是正常號段但不在任何地圖 life 上（腳本動態生成的劇情 NPC）——這是資料本身如此，
不是漏掃，705 已確認是全部地圖。
"""

import json
import os

import UnityPy

from wzjs import decode as wzjs_decode

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")

QUEST_FILES = ["QuestInfo", "Check", "Act"]
QUEST_MARK = "/Quest/QuestInfo.wzjson"
NAME_MARK = "/String/TW/QuestData.json"
MAP_MARK = "/Map/Map"


def bundles():
    """小的先掃：Quest 包 <1MB、名稱表包 2.4MB，Map 包 44MB 擺最後。"""
    return sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )


def raw_of(env, pptr):
    """MonoBehaviour 的 raw bytes。不能用 pptr.read()——這些是 IL2CPP 混淆過的自訂類別，
    沒有 typetree，read() 會炸 'Expected to read N bytes'。"""
    for reader in env.objects:
        if reader.path_id == pptr.path_id:
            return bytes(reader.get_raw_data())
    raise KeyError(pptr.path_id)


def text_of(pptr):
    """TextAsset 原文（UnityPy 的 m_Script 是 surrogateescape 過的 str）。"""
    return pptr.read().m_Script.encode("utf-8", "surrogateescape").decode("utf-8")


def extract_quests():
    """回傳 (bundle 檔名, {QuestInfo/Check/Act: tree}, QuestData dict)。"""
    trees, names, src_bundle = None, None, None
    for fname in bundles():
        env = UnityPy.load(os.path.join(AA_W, fname))
        cont = env.container
        if trees is None and any(c.endswith(QUEST_MARK) for c in cont):
            src_bundle = fname
            trees = {}
            for cpath, pptr in cont.items():
                stem = cpath.rsplit("/", 1)[-1].removesuffix(".wzjson")
                if stem in QUEST_FILES:
                    root, tree = wzjs_decode(raw_of(env, pptr))
                    assert root == stem, f"{stem} 根節點異常: {root}"
                    trees[stem] = tree
        if names is None:
            for cpath, pptr in cont.items():
                if cpath.endswith(NAME_MARK):
                    names = json.loads(text_of(pptr))
                    break
        if trees is not None and names is not None:
            break
    if trees is None:
        raise SystemExit(f"在 {AA_W} 找不到 {QUEST_MARK}")
    if names is None:
        raise SystemExit(f"在 {AA_W} 找不到 {NAME_MARK}")
    missing = set(QUEST_FILES) - set(trees)
    if missing:
        raise SystemExit(f"Quest 包缺少 {missing}")
    return src_bundle, trees, names


def extract_npc_maps():
    """掃全部地圖的 life 節點，建 npc id → 地圖 id 清單。"""
    npc_map: dict[str, set[str]] = {}
    n_maps = 0
    for fname in bundles():
        env = UnityPy.load(os.path.join(AA_W, fname))
        targets = [
            (c, p)
            for c, p in env.container.items()
            if MAP_MARK in c and c.rsplit("/", 1)[-1].removesuffix(".wzjson").isdigit()
        ]
        if not targets:
            continue
        for cpath, pptr in targets:
            map_id = cpath.rsplit("/", 1)[-1].removesuffix(".wzjson")
            try:
                _, tree = wzjs_decode(raw_of(env, pptr))
            except Exception:
                continue  # 少數地圖檔結構異常，跳過不影響整體
            n_maps += 1
            life = tree.get("life")
            if not isinstance(life, dict):
                continue
            for entry in life.values():
                if not isinstance(entry, dict) or entry.get("type") != "n":
                    continue
                oid = entry.get("id")
                if oid is None:
                    continue
                npc_map.setdefault(str(int(oid)), set()).add(str(int(map_id)))
    return n_maps, {k: sorted(v, key=int) for k, v in sorted(npc_map.items(), key=lambda kv: int(kv[0]))}


def main():
    os.makedirs(REF, exist_ok=True)

    src_bundle, trees, names = extract_quests()
    print(f"Quest 包：{src_bundle}")
    for k in QUEST_FILES:
        print(f"  {k}: {len(trees[k])} 筆")
    print(f"  QuestData.json: {len(names)} 筆中文名")

    quest_path = os.path.join(REF, "quest.json")
    with open(quest_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "source": f"{src_bundle} -> Assets/WzAssets/Json/Quest/",
                    "note": "QuestInfo 的字串值是空殼佔位符，中文請用 strings 這份",
                },
                "info": trees["QuestInfo"],
                "check": trees["Check"],
                "act": trees["Act"],
                "strings": names,
            },
            f,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    print(f"→ {quest_path}")

    n_maps, npc_map = extract_npc_maps()
    npc_path = os.path.join(REF, "npc-map.json")
    with open(npc_path, "w", encoding="utf-8") as f:
        json.dump(npc_map, f, ensure_ascii=False, separators=(",", ":"))
    print(f"掃過 {n_maps} 張地圖，{len(npc_map)} 個 NPC 有出沒地圖")
    print(f"→ {npc_path}")


if __name__ == "__main__":
    main()
