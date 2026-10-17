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

實裝判斷不在這支腳本，寫死在 **src/data/skills.ts 的 RELEASED_TIERS**。
原本想用「轉職任務 released」自動判斷，但實測 90 級怪的地圖已開、3 轉卻還沒開，
那個規則不可靠。2026-10-15 的更新開了 3 轉（冰原雪域長老公館的五位 3 轉教官
與雪原聖地的神聖的石頭都上了實裝地圖），現在是 [1, 2, 3]。

**新手技能（職業 000）整個不收**——那 20 個幾乎都是活動／特殊技能
（怪物騎乘、宇宙船、肥肥的弱點攻擊…），一般玩家用不到。

每級數值只留白名單 LEVEL_SHOW。客戶端每級有 30 幾種欄位，但逐級敘述已經把
數字寫進去了，全列會變成同一件事講兩遍。

## 逐級敘述是自己代入模板產生的（2026-10-17）

2026-10-15 的更新把 Skill.json 的 **LevelDesc（每一級寫好的中文敘述）拿掉了**，
只剩帶佔位符的模板 H（例：「消耗MP#mpCon，攻擊力#damage%」），遊戲自己代數字。
所以 levelDesc 改由 render_h() 代入 skill.json 的每級數值；少數還留著 LevelDesc 的
技能照用。代入規則（拿舊版客戶端的 LevelDesc 當答案卷驗過：數值沒改過的等級
97% 一字不差，剩下的多半是舊敘述自己打錯字）：

- `#欄位` 直接代入；`#rb` 取範圍框右下角的 x（舊敘述的「攻擊範圍110%」就是它）
- 衍生寫法：`#xSubHun` = x−100、`#xAddHun` = x+100、`#absX` = |x|、
  `#timeMin` = time÷60、`#M` = mastery×5+10（熟練度）、`#MesoExM` = x÷10、
  `#MagnetRange` = range÷2。遊戲程式的字串常數裡**沒有** SubHun／abs 這些字，
  所以這些是照舊敘述反推的，遊戲內實際顯示什麼沒辦法從客戶端驗證
- 模板寫「#cooltime分鐘」但欄位單位是秒 → 換算成分鐘（楓葉淨化、復甦之光…）
- 模板本身寫錯的（變數名錯、正負號反了）收在 H_FIX，每筆都有舊敘述當證據
- 還是解不出來的佔位符印成「?」，執行時會列出來

職業中文名寫死在 **tools/jobs.py 的 JOBS**（客戶端的 String 表沒有職業名），
任務頁的職業限制也吃同一份。發現跟遊戲內不符就改那裡，改完重跑本腳本。已修正過：110 原本寫「戰士」，遊戲內是「狂戰士」（2026-08-22）。
"""

import json
import os
import re
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


# 模板 H 的衍生寫法（不是 wz 欄位名，是 Gamania 模板自己的寫法）
DERIVED = {
    "M": lambda d: d["mastery"] * 5 + 10,
    "rb": lambda d: d["rb"][0],
    "MesoExM": lambda d: d["x"] // 10,
    "MagnetRange": lambda d: d["range"] // 2,
}

# 模板本身寫錯的技能：{ skillId: { 佔位符: 算法 } }，證據都是舊版客戶端的 LevelDesc
H_FIX = {
    # 「物理防禦力#absPdd」→ 舊述「物理防禦力-3」（激勵會降防，絕對值會把負號吃掉）
    "1101006": {"absPdd": lambda d: d["pdd"]},
    # 「降低#x%」而 x 是負數 → 會印成「降低-1%」
    "1201006": {"x": lambda d: abs(d["x"])},
    # 下面三個模板沒寫負號，舊述是「物理傷害-11%」「消耗魔力-2%」「命中率-1%」
    "2301003": {"x": lambda d: -d["x"]},
    "3121008": {"x": lambda d: -d["x"]},
    "3221006": {"x": lambda d: -d["x"]},
    # 會心之眼：模板寫 #xSubHun（x 是暴擊率），舊述的暴擊傷害是 y−100
    "3121002": {"xSubHun": lambda d: d["y"] - 100},
    "3221002": {"xSubHun": lambda d: d["y"] - 100},
    # 黑暗力量：模板寫 #xAddHun（x 是 HP 門檻），舊述的殺傷力是 damage+100
    "1320006": {"xAddHun": lambda d: d["damage"] + 100},
    # 暗之靈魂的熟練度不像精通技能那樣 +10：舊述 mastery 1→5%、4→20%
    "1321007": {"M": lambda d: d["mastery"] * 5},
    # 進階鬥氣：舊述「最大鬥氣量增加 1~5」= x−5（x 是鬥氣上限 6~10）
    "1120003": {"y": lambda d: d["x"] - 5},
    # 究極突刺（聖騎士版）：殺傷力寫成 #y，同技能其他兩版都是 #damage
    "1221007": {"y": lambda d: d["damage"]},
    # 瞬步連擊「對#y個敵人」→ 舊述 2~4 個 = mobCount
    "4221007": {"y": lambda d: d["mobCount"]},
    # 鬥神降世「物理、魔法防禦力#y」→ 舊述 41~60 = pdd
    "5121003": {"y": lambda d: d["pdd"]},
}


def placeholder_value(sid, name, d):
    """模板佔位符 → 數值；解不出來回傳 None。"""
    fix = H_FIX.get(sid, {}).get(name) or DERIVED.get(name)
    if fix is None and isinstance(d.get(name), (int, float)):
        return d[name]
    if fix is None:
        if m := re.fullmatch(r"abs([A-Z][A-Za-z]*)", name):
            field = m.group(1)[0].lower() + m.group(1)[1:]
            fix = lambda d: abs(d[field])  # noqa: E731
        elif m := re.fullmatch(r"([a-z][A-Za-z]*)(SubHun|AddHun|Min)", name):
            field, op = m.groups()
            fix = {
                "SubHun": lambda d: d[field] - 100,
                "AddHun": lambda d: d[field] + 100,
                "Min": lambda d: d[field] // 60,
            }[op]
        else:
            return None
    try:
        return fix(d)
    except (KeyError, TypeError, IndexError):
        return None


def render_h(sid, h, d, unresolved):
    """把模板 H 代入一級的數值。解不出來的佔位符印「?」並記進 unresolved。"""

    def sub(m):
        name, unit = m.group(1), m.group(2) or ""
        v = placeholder_value(sid, name, d)
        if v is None:
            unresolved.add(name)
            return "?" + unit
        # 模板寫「#cooltime分鐘」但欄位是秒
        if unit == "分鐘" and name in ("time", "cooltime"):
            v //= 60
        return f"{v}{unit}"

    return re.sub(r"#([A-Za-z]+)(分鐘)?", sub, h).strip()


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    raw = load(os.path.join(REF, "skill.json"))["skills"]
    names = load(os.path.join(REF, "name-tables", "Skill.json"))
    job_ids = {j[0] for j in JOBS}

    skills, no_name = [], []
    unresolved_by_skill = {}
    n_rendered = 0
    for sid, s in raw.items():
        if s["job"] not in job_ids:
            continue  # 新手(000)與其他非冒險家職業不收
        meta = names.get(sid) or names.get(sid.lstrip("0")) or {}
        name = meta.get("Name")
        if not name:
            no_name.append(sid)
            continue
        max_lv = s["maxLevel"]
        h = (meta.get("H") or meta.get("h") or "").replace("\\n", "\n").strip()
        ld = meta.get("LevelDesc") or {}
        unresolved = set()
        level_desc = []
        for i in range(1, max_lv + 1):
            text = (ld.get(str(i)) or "").strip()
            if not text and h:
                text = render_h(sid, h, s["levels"].get(str(i), {}), unresolved)
                n_rendered += 1
            level_desc.append(text)
        if unresolved:
            unresolved_by_skill[sid] = (name.strip(), sorted(unresolved))
        levels = []
        for i in range(1, max_lv + 1):
            d = s["levels"].get(str(i), {})
            row = {k: d[k] for k in LEVEL_SHOW if d.get(k) is not None}
            # wz 的 mastery 是 1~10 的等級，不是百分比；換算跟敘述的 #M 同一套，
            # 不然表格印「熟練度 1%」、敘述寫「熟練度15%」
            if "mastery" in row:
                row["mastery"] = placeholder_value(sid, "M", d)
            levels.append(row)
        entry = {
            "id": sid,
            "job": s["job"],
            "name": name.strip(),
            "desc": (meta.get("Desc") or "").replace("\\n", "\n").strip(),
            "h": h,
            "maxLevel": max_lv,
            "levelDesc": level_desc,
            "levels": levels,
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
    print(f"  逐級敘述：{n_rendered} 級由模板代入產生")
    if unresolved_by_skill:
        print(f"  模板佔位符解不出來（印成「?」）：{len(unresolved_by_skill)} 個技能")
        for sid, (nm, keys) in unresolved_by_skill.items():
            print(f"    {sid} {nm}：{'、'.join('#' + k for k in keys)}")
    if no_name:
        print(f"  名稱表查不到而略過：{len(no_name)} 個 {no_name[:8]}")


if __name__ == "__main__":
    main()
