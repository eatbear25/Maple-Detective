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

職業中文名寫死在 JOBS。maplestory.io 的 /job 端點雖然查得到，但那是 TMS/209 的
譯名（例如 110 在那邊叫「狂戰士」），跟經典版遊戲內未必一致。發現不符改這裡。
"""

import json
import os
from datetime import datetime, timedelta, timezone

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT_PATH = os.path.join(PROJECT, "src", "data", "generated", "skills.json")

# (職業 id, 中文名, 轉職階段, 職業群, 前一階段)
JOBS = [
    ("100", "劍士", 1, "warrior", None),
    ("110", "戰士", 2, "warrior", "100"),
    ("111", "十字軍", 3, "warrior", "110"),
    ("112", "英雄", 4, "warrior", "111"),
    ("120", "見習騎士", 2, "warrior", "100"),
    ("121", "騎士", 3, "warrior", "120"),
    ("122", "聖騎士", 4, "warrior", "121"),
    ("130", "槍騎兵", 2, "warrior", "100"),
    ("131", "龍騎士", 3, "warrior", "130"),
    ("132", "黑騎士", 4, "warrior", "131"),
    ("200", "法師", 1, "magician", None),
    ("210", "巫師（火、毒）", 2, "magician", "200"),
    ("211", "魔導士（火、毒）", 3, "magician", "210"),
    ("212", "大魔導士（火、毒）", 4, "magician", "211"),
    ("220", "巫師（冰、雷）", 2, "magician", "200"),
    ("221", "魔導士（冰、雷）", 3, "magician", "220"),
    ("222", "大魔導士（冰、雷）", 4, "magician", "221"),
    ("230", "僧侶", 2, "magician", "200"),
    ("231", "祭司", 3, "magician", "230"),
    ("232", "主教", 4, "magician", "231"),
    ("300", "弓箭手", 1, "bowman", None),
    ("310", "獵人", 2, "bowman", "300"),
    ("311", "遊俠", 3, "bowman", "310"),
    ("312", "箭神", 4, "bowman", "311"),
    ("320", "弩弓手", 2, "bowman", "300"),
    ("321", "狙擊手", 3, "bowman", "320"),
    ("322", "神弓手", 4, "bowman", "321"),
    ("400", "盜賊", 1, "thief", None),
    ("410", "刺客", 2, "thief", "400"),
    ("411", "暗殺者", 3, "thief", "410"),
    ("412", "夜使者", 4, "thief", "411"),
    ("420", "俠盜", 2, "thief", "400"),
    ("421", "神偷", 3, "thief", "420"),
    ("422", "暗影神偷", 4, "thief", "421"),
    ("500", "海盜", 1, "pirate", None),
    ("510", "打手", 2, "pirate", "500"),
    ("511", "拳霸", 3, "pirate", "510"),
    ("512", "拳王", 4, "pirate", "511"),
    ("520", "槍手", 2, "pirate", "500"),
    ("521", "神槍手", 3, "pirate", "520"),
    ("522", "槍神", 4, "pirate", "521"),
]
GROUP_NAMES = {
    "warrior": "劍士", "magician": "法師", "bowman": "弓箭手",
    "thief": "盜賊", "pirate": "海盜",
}

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
