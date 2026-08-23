"""從楓之谷經典版客戶端抽取技能資料（Skill/<職業>.wzjson）。

用法：
    pip install UnityPy
    python tools/extract-skill.py

輸出 reference-data/skill.json，結構：
    { "meta": {...},
      "skills": { "<skillId>": {
          "job": "110",                 # 技能所屬職業（= wzjson 檔名）
          "maxLevel": 20,               # = level 節點筆數
          "masterLevel": 10,            # 出廠上限（只有 4 轉的精通技能有；沒有就省略）
          "req": { "1100000": 5 },      # 前置技能 → 需要的等級
          "levels": { "1": { "mpCon": 8, ... }, ... }   # 每級數值（白名單欄位）
      } } }

定位方式：掃 json_*.bundle 的 container path 找 /Json/Skill/，不寫死 bundle 檔名
（檔名帶內容雜湊，每次遊戲更新都會變）。raw bytes 直接用 wzjs.decode 解。

## 兩件跟其他抽取腳本不同的事

1. Skill 包裡「檔名是職業 ID」（000/100/110/…共 98 檔），每檔的 skill 節點底下
   才是各技能。技能所屬職業直接看它在哪個檔，不要用 skill id 前綴去推
   （1000xxx 和 1001xxx 都屬於職業 100）。
2. 技能的圖示是 canvas 節點，wzjson 裡沒有影像資料（圖在 spritesheet 包的圖集
   裡，而圖集只存矩形座標、不存名字）。圖示不走這支腳本，見
   tools/extract-skill-icons.py。
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import UnityPy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wzjs import decode as wzjs_decode  # noqa: E402

AA_W = r"C:\Program Files\Gamania\maplestory_classic\Maplestory_Classic_Data\StreamingAssets\aa\w"
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(PROJECT, "reference-data", "skill.json")

SKILL_DIR = "/Json/Skill/"

# 每級數值只留網站會顯示或可能顯示的欄位。全部欄位有 30 幾種，但中文敘述
# (LevelDesc) 本來就把數字寫進去了，全留只是同一件事講兩遍。
LEVEL_FIELDS = {
    "mpCon", "hpCon", "damage", "attackCount", "mobCount", "bulletCount",
    "time", "cooltime", "prop", "mastery", "range",
    "pad", "mad", "pdd", "mdd", "acc", "eva", "speed", "jump",
    "hp", "mp", "x", "y", "z", "criticalDamage", "fixdamage",
    "itemCon", "itemConNo", "moneyCon",
}


def find_skill_bundle():
    """掃 json_*.bundle 找 container path 含 /Json/Skill/ 的那包（小包先掃）。"""
    bundles = sorted(
        (f for f in os.listdir(AA_W) if f.startswith("json_") and f.endswith(".bundle")),
        key=lambda f: os.path.getsize(os.path.join(AA_W, f)),
    )
    for fname in bundles:
        env = UnityPy.load(os.path.join(AA_W, fname))
        if any(SKILL_DIR in p for p in env.container):
            return fname, env
    raise SystemExit(f"在 {AA_W} 的 json_*.bundle 裡找不到 {SKILL_DIR}")


def scalars(node):
    """取一層純量欄位（略過 None 與巢狀結構）。"""
    if not isinstance(node, dict):
        return {}
    return {
        k: v for k, v in node.items()
        if k in LEVEL_FIELDS and isinstance(v, (int, float)) and not isinstance(v, bool)
    }


def main():
    fname, env = find_skill_bundle()
    readers = {r.path_id: r for r in env.objects}
    skills = {}
    n_files = 0

    for cpath, pptr in env.container.items():
        if SKILL_DIR not in cpath or not cpath.endswith(".wzjson"):
            continue
        job = cpath.rsplit("/", 1)[-1].removesuffix(".wzjson")
        try:
            _, tree = wzjs_decode(bytes(readers[pptr.path_id].get_raw_data()))
        except Exception as exc:  # 少數檔結構異常，跳過不影響整體
            print(f"  略過 {job}：{exc}")
            continue
        n_files += 1
        for sid, node in (tree.get("skill") or {}).items():
            if not isinstance(node, dict):
                continue
            levels = node.get("level")
            if not isinstance(levels, dict):
                continue
            entry = {"job": job, "maxLevel": len(levels), "levels": {}}
            for lv, ldata in levels.items():
                got = scalars(ldata)
                if got:
                    entry["levels"][lv] = got
            master = node.get("masterLevel")
            if isinstance(master, int):
                entry["masterLevel"] = master
            req = node.get("req")
            if isinstance(req, dict):
                got = {k: v for k, v in req.items() if isinstance(v, int)}
                if got:
                    entry["req"] = got
            skills[sid] = entry

    meta = {
        "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "bundle": fname,
        "jobFiles": n_files,
        "skills": len(skills),
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "skills": skills}, f, ensure_ascii=False, indent=1)
    print(f"{fname}：{n_files} 個職業檔、{len(skills)} 個技能 → {OUT_PATH}")


if __name__ == "__main__":
    main()
