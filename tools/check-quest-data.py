"""把 generated/quests.json 逐筆對回客戶端原始資料，抓「漏掉」與「多算」。

用法：python tools/check-quest-data.py   （只讀不寫，跑完印報告）
前置：tools/extract-quest.py → tools/build-quest-data.py 都跑過。

為什麼要有這支：任務資料的欄位語意全是逆向猜出來的，猜錯不會報錯、只會安靜地
印出錯的獎勵——#1034 的「送 10 顆蘑菇糖果」就是這樣混進去的（Act 的兩個階段
被當成同一包）。所以把「每個欄位怎麼算」寫成獨立的一份斷言，跟 build 腳本互相
對照；build 腳本改壞了這裡就會叫。

報告分兩區：
1. **逐筆比對**：獎勵/需求/打怪/前置…重算一次，跟輸出檔比對，不一致就列出來。
2. **欄位涵蓋率**：客戶端 Check/Act 出現過的每個欄位，標「已用」或「刻意不用」。
   出現沒登記過的欄位就是遊戲更新加了東西，會被列成 UNKNOWN 要人去看。
"""

import json
import os

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(PROJECT, "reference-data")
OUT = os.path.join(PROJECT, "src", "data", "generated", "quests.json")

# 客戶端欄位 → 我們怎麼處理。改動 build-quest-data.py 的取用方式時，這裡要一起改。
FIELD_USE = {
    "check.0": {
        "npc": "用：詳情的任務 NPC、實裝判斷、地區",
        "quest": "用：state 1/2 → prereq、其餘 → exclude",
        "lvmin": "用：lv（需求等級）",
        "lvmax": "用：lvMax（等級上限）",
        "job": "用：jobs（職業限制）",
        "item": "用：have（身上要有的道具，只進 JSON 不上畫面）；count<=0 是「不能有」",
        "interval": "用：repeat（可重複的間隔，分鐘）",
        "startscript": "用：scripted 旗標（獎勵在伺服器端）",
        "skill": "不用：需要學過某技能才能接，27 個任務，多半是未實裝的 4 轉線",
        "normalAutoStart": "不用：自動接取的觸發設定",
        "infoNumber": "不用：任務進度計數器的 UI 設定",
        "info": "不用：同上",
        "infoex": "不用：同上",
        "end": "不用：活動任務的截止日",
        "start": "不用：活動任務的開始日",
        "fieldEnter": "不用：要站在某張地圖才能接",
        "pet": "不用：寵物任務條件",
        "pop": "不用：名聲門檻（1 個任務）",
        "equipSelectNeed": "不用：裝備欄位條件（1 個任務）",
    },
    "check.1": {
        "npc": "用：交任務的 NPC（實裝判斷、地區的備援）",
        "item": "用：need（要繳交的道具）",
        "mob": "用：kill（要打倒的怪）",
        "endscript": "用：scripted 旗標",
        "quest": "不用：完成時要求別的任務處於某狀態（16 筆）",
        "infoNumber": "不用：進度計數器",
        "info": "不用：同上",
        "infoex": "不用：同上",
        "pet": "不用：寵物條件",
        "pettamenessmin": "不用：寵物親密度",
        "mbmin": "不用：怪物圖鑑張數",
    },
    "act.0": {
        "item": "用：give（接任務時 NPC 先給的道具）",
        "money": "用：cost（負數＝接任務就收錢）",
        "npc": "不用：對話中切換 NPC 立繪",
        "quest": "不用：連動改別的任務狀態",
        "lvmin": "不用：分支條件",
        "info": "不用：進度計數器",
        # 下面這些是對話文字的節點，Gamania 把字掏空搬去本地化了，值都是 "0_yes_0" 這種殼
        "0": "不用：對話文字（客戶端已掏空）",
        "1": "不用：對話文字（客戶端已掏空）",
        "2": "不用：對話文字（客戶端已掏空）",
        "3": "不用：對話文字（客戶端已掏空）",
        "yes": "不用：對話文字（客戶端已掏空）",
        "no": "不用：對話文字（客戶端已掏空）",
        "ask": "不用：對話文字（客戶端已掏空）",
        "stop": "不用：對話文字（客戶端已掏空）",
    },
    "info": {
        "viewMedalItem": "用：稱號勳章獎勵（Act 裡沒有，只有這裡有）",
        "parent": "不用：值被掏空了，系列名改從 String/TW/QuestData.json 拿",
        "name": "不用：同上",
        "area": "不用：遊戲內任務分頁的分區代碼（10/20/30/47/50/51），粒度對攻略沒用",
        "order": "不用：系列內順序，任務鏈已用前後關聯排好",
        "sortkey": "不用：清單排序用",
        "rewardSummary": "不用：值被掏空了（只剩欄位名本身）",
        "demandSummary": "不用：同上",
        "summary": "不用：同上",
        "medalCategory": "不用：勳章分類（1/2）",
        "autoStart": "不用：自動接取",
        "autoAccept": "不用：自動接取",
        "autoComplete": "不用：自動完成",
        "autoPreComplete": "不用：自動完成",
        "timeLimit": "不用：限時任務的秒數",
        "timeLimit2": "不用：同上",
        "timerUI": "不用：限時 UI",
        "dailyPlayTime": "不用：每日遊玩時間任務（1 個）",
        "selectedMob": "不用：指定怪物的 UI 設定（1 個）",
        "showLayerTag": "不用：畫面圖層標記（james1/2/3）",
        "0": "不用：對話文字（客戶端已掏空）",
        "1": "不用：對話文字（客戶端已掏空）",
        "2": "不用：對話文字（客戶端已掏空）",
    },
    "act.1": {
        "exp": "用：exp",
        "money": "用：money（正數）/ cost（負數）",
        "pop": "用：pop（名聲）",
        "item": "用：rewards（含職業/性別限制）",
        "skill": "用：skills（技能獎勵）",
        "nextQuest": "用：任務鏈的後續邊",
        "npcAct": "不用：完成動畫",
        "pettameness": "不用：寵物親密度獎勵（1 筆）",
    },
}


def load(*parts):
    with open(os.path.join(REF, *parts), encoding="utf-8") as f:
        return json.load(f)


def pos_items(node):
    return sorted(
        (e["id"], e.get("count", 1))
        for e in (node or {}).values()
        if isinstance(e, dict) and isinstance(e.get("id"), int)
        and isinstance(e.get("count", 1), int) and e.get("count", 1) > 0
    )


def out_items(rows):
    return sorted((r["id"], r["n"]) for r in rows or [])


def main():
    raw = load("quest.json")
    with open(OUT, encoding="utf-8") as f:
        site = json.load(f)
    quests = {q["id"]: q for q in site["quests"]}
    supplement = {k for k in load("quest-supplement.json") if not k.startswith("_")}

    problems = []

    def bad(qid, what, expect, got):
        name = quests.get(qid, {}).get("name", "?")
        problems.append(f"#{qid} {name}｜{what}：客戶端 {expect} / 網站 {got}")

    for qid, check in raw["check"].items():
        q = quests.get(qid)
        if q is None:
            problems.append(f"#{qid} 客戶端有這個任務，網站沒有輸出")
            continue
        act = raw["act"].get(qid, {})
        start = check.get("0") or {}
        end = check.get("1") or {}
        on_start = act.get("0") if isinstance(act.get("0"), dict) else {}
        on_end = act.get("1") if isinstance(act.get("1"), dict) else {}

        # 獎勵 = Act["1"] 的道具 ＋ QuestInfo 的稱號勳章；Act["0"] 的道具是 give
        want_rewards = pos_items(on_end.get("item"))
        medal = (raw["info"].get(qid) or {}).get("viewMedalItem")
        if isinstance(medal, int) and not any(i == medal for i, _ in want_rewards):
            want_rewards = sorted(want_rewards + [(medal, 1)])
        if out_items(q["rewards"]) != want_rewards:
            bad(qid, "獎勵道具", want_rewards, out_items(q["rewards"]))
        if out_items(q.get("give")) != pos_items(on_start.get("item")):
            bad(qid, "接任務拿到", pos_items(on_start.get("item")), out_items(q.get("give")))
        # 需求 / 打怪 / 身上要有
        if out_items(q["need"]) != pos_items(end.get("item")):
            bad(qid, "需求道具", pos_items(end.get("item")), out_items(q["need"]))
        if out_items(q.get("have")) != pos_items(start.get("item")):
            bad(qid, "身上要有", pos_items(start.get("item")), out_items(q.get("have")))
        kill = sorted(
            (e["id"], e.get("count", 1))
            for e in (end.get("mob") or {}).values()
            if isinstance(e, dict)
        )
        if out_items(q.get("kill")) != kill:
            bad(qid, "打倒怪物", kill, out_items(q.get("kill")))

        # 數值獎勵（人工補充過的跳過，那本來就會覆蓋客戶端）
        if qid not in supplement:
            if q.get("exp", 0) != (on_end.get("exp") or 0):
                bad(qid, "經驗", on_end.get("exp") or 0, q.get("exp", 0))
            if q.get("pop", 0) != (on_end.get("pop") or 0):
                bad(qid, "名聲", on_end.get("pop") or 0, q.get("pop", 0))
            money_end = on_end.get("money") or 0
            cost = max(-money_end, 0) + max(-(on_start.get("money") or 0), 0)
            if q.get("money", 0) != max(money_end, 0):
                bad(qid, "楓幣獎勵", max(money_end, 0), q.get("money", 0))
            if q.get("cost", 0) != cost:
                bad(qid, "花費", cost, q.get("cost", 0))

        # 前置 vs 互斥
        want_pre = sorted(
            str(e["id"]) for e in (start.get("quest") or {}).values()
            if isinstance(e, dict) and "id" in e and e.get("state") in (1, 2)
        )
        want_ex = sorted(
            str(e["id"]) for e in (start.get("quest") or {}).values()
            if isinstance(e, dict) and "id" in e and e.get("state") not in (1, 2)
        )
        if sorted(q["prereq"]) != want_pre:
            bad(qid, "前置任務", want_pre, sorted(q["prereq"]))
        if sorted(q.get("exclude") or []) != want_ex:
            bad(qid, "互斥任務", want_ex, sorted(q.get("exclude") or []))

    # 名稱表要蓋得住所有引用（缺了畫面上會出現 #4031792 這種東西）
    for q in site["quests"]:
        for row in q["need"] + q["rewards"] + (q.get("give") or []) + (q.get("have") or []):
            if str(row["id"]) not in site["items"]:
                problems.append(f"#{q['id']} {q['name']}｜道具 {row['id']} 不在名稱表")
        for row in q.get("kill") or []:
            if str(row["id"]) not in site["mobs"]:
                problems.append(f"#{q['id']} {q['name']}｜怪物 {row['id']} 不在名稱表")
        for row in q.get("skills") or []:
            if str(row["id"]) not in site["skills"]:
                problems.append(f"#{q['id']} {q['name']}｜技能 {row['id']} 不在名稱表")
        if q.get("npcMap") is not None and str(q["npcMap"]) not in site["maps"]:
            problems.append(f"#{q['id']} {q['name']}｜地圖 {q['npcMap']} 不在名稱表")
        if q.get("region") and q["region"] not in site["regions"]:
            problems.append(f"#{q['id']} {q['name']}｜地區 {q['region']} 不在 chips 清單")
        if bool(q.get("region")) != bool(q["released"]):
            problems.append(f"#{q['id']} {q['name']}｜region 與 released 不一致")

    # 欄位涵蓋率：出現沒登記的欄位 = 遊戲更新加了東西
    unknown = []
    known_info = FIELD_USE["info"]
    for v in raw["info"].values():
        unknown += [f"info.{k}" for k in v if k not in known_info]
    for name in ("check", "act"):
        for stage in ("0", "1"):
            known = FIELD_USE[f"{name}.{stage}"]
            for v in raw[name].values():
                b = v.get(stage)
                if isinstance(b, dict):
                    unknown += [f"{name}[{stage}].{k}" for k in b if k not in known]

    print(f"逐筆比對 {len(raw['check'])} 個任務")
    if problems:
        print(f"  ✗ {len(problems)} 個問題：")
        for line in problems[:40]:
            print("   ", line)
        if len(problems) > 40:
            print(f"    …還有 {len(problems) - 40} 個")
    else:
        print("  ✓ 全部一致")

    print()
    print("欄位涵蓋率：")
    for key, uses in FIELD_USE.items():
        used = [k for k, v in uses.items() if v.startswith("用")]
        print(f"  {key}：登記 {len(uses)} 個欄位，其中 {len(used)} 個有用到")
    if unknown:
        print(f"  ✗ UNKNOWN {len(set(unknown))} 個沒登記過的欄位（遊戲更新加的？去看一下）：")
        for k in sorted(set(unknown)):
            print("   ", k)
    else:
        print("  ✓ 沒有沒登記過的欄位")

    return 1 if problems or unknown else 0


if __name__ == "__main__":
    raise SystemExit(main())
