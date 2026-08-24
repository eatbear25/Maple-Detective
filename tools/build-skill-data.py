"""把 skill.json + 名稱表組裝成網站用的技能資料檔。

用法：python tools/build-skill-data.py
輸入：reference-data/skill.json（tools/extract-skill.py）
      reference-data/name-tables/Skill.json（中文名／說明／每級敘述）
輸出：src/data/generated/skills.json
    {
      "jobs":   [ { id, name, tier, group, groupName, from } ],
      "skills": [ { id, job, name, desc, h, maxLevel, masterLevel?,
                    req?, levelDesc: [...], levels: [ {...} ] } ]
    }

## 幾個定案（2026-08-22）

實裝判斷寫死在 TIERS：**1 轉與 2 轉是現行版本，3 轉與 4 轉進「未來視」**。
原本想用「轉職任務 released」自動判斷，但實測 90 級怪的地圖已開、3 轉卻還沒開，
那個規則不可靠。遊戲開 3 轉時把 TIERS 裡的 tier 改一下即可。

**新手技能（職業 000）整個不收**——那 20 個幾乎都是活動／特殊技能
（怪物騎乘、宇宙船、肥肥的弱點攻擊…），一般玩家用不到。

每級數值只留白名單 LEVEL_SHOW。客戶端每級有 30 幾種欄位，但 LevelDesc 的中文
敘述本來就把數字寫進去了，全列會變成同一件事講兩遍。

職業中文名寫死在 **tools/jobs.py 的 JOBS**（客戶端的 String 表沒有職業名），
任務頁的職業限制也吃同一份。發現跟遊戲內不符就改那裡，改完重跑本腳本。已修正過：110 原本寫「戰士」，遊戲內是「狂戰士」（2026-08-22）。
"""

import json
import os
from datetime import datetime, timedelta, timezone

from jobs import GROUP_NAMES, JOBS

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "skills.json")

# JOBS / GROUP_NAMES（職業 id → 中文名）在 tools/jobs.py，任務頁也要用，只該有一份

# 詳情面板會顯示的每級欄位（順序即顯示順序）
LEVEL_SHOW = [
    "mpCon", "hpCon", "damage", "attackCount", "mobCount",
    "time", "cooltime", "prop", "mastery",
]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    raw = load(os.path.join(REF, "skill.json"))["skills"]
    names = load(os.path.join(REF, "name-tables", "Skill.json"))
    job_ids = {j[0] for j in JOBS}

    skills, no_name = [], []
    for sid, s in raw.items():
        if s["job"] not in job_ids:
            continue  # 新手(000)與其他非冒險家職業不收
        meta = names.get(sid) or names.get(sid.lstrip("0")) or {}
        name = meta.get("Name")
        if not name:
            no_name.append(sid)
            continue
        max_lv = s["maxLevel"]
        ld = meta.get("LevelDesc") or {}
        entry = {
            "id": sid,
            "job": s["job"],
            "name": name.strip(),
            "desc": (meta.get("Desc") or "").replace("\\n", "\n").strip(),
            "h": (meta.get("H") or meta.get("h") or "").strip(),
            "maxLevel": max_lv,
            "levelDesc": [(ld.get(str(i)) or "").strip() for i in range(1, max_lv + 1)],
            "levels": [
                {k: s["levels"].get(str(i), {}).get(k)
                 for k in LEVEL_SHOW if s["levels"].get(str(i), {}).get(k) is not None}
                for i in range(1, max_lv + 1)
            ],
        }
        if "masterLevel" in s:
            entry["masterLevel"] = s["masterLevel"]
        if "req" in s:
            entry["req"] = s["req"]
        skills.append(entry)

    order = {j[0]: i for i, j in enumerate(JOBS)}
    skills.sort(key=lambda s: (order[s["job"]], s["id"]))

    jobs = [
        {"id": jid, "name": nm, "tier": tier, "group": grp,
         "groupName": GROUP_NAMES[grp], "from": prev}
        for jid, nm, tier, grp, prev in JOBS
    ]

    data = {
        "meta": {
            "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
            "skills": len(skills),
        },
        "jobs": jobs,
        "skills": skills,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    by_tier = {}
    for s in skills:
        t = next(j[2] for j in JOBS if j[0] == s["job"])
        by_tier[t] = by_tier.get(t, 0) + 1
    print(f"{len(skills)} 個技能 → {OUT_PATH}")
    print("  每轉：" + "、".join(f"{t} 轉 {n}" for t, n in sorted(by_tier.items())))
    if no_name:
        print(f"  名稱表查不到而略過：{len(no_name)} 個 {no_name[:8]}")


if __name__ == "__main__":
    main()
