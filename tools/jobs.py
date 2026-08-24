"""職業對照表：build-skill-data.py 與 build-quest-data.py 共用，只該有一份。

客戶端的 String 表**沒有職業名稱**（Skill.json 只有技能名），所以中文名是寫死的。
發現跟遊戲內不符就改這裡再重跑兩支腳本，已修正：110 = 狂戰士（原本誤植「戰士」）。

兩種職業編碼要分清楚：
- **職業 id**（100/110/212…）：技能表、任務的 `Check["0"].job` 用的，就是 JOBS 的第一欄。
- **職業 bitmask**（1/2050/2099202…）：任務獎勵 `Act["1"].item[].job` 用的，
  一件獎勵只發給符合的職業。**bit 編號 % 10 = 職業系列、// 10 = 轉職階段**，
  實測 19 種 mask 全部吻合（例：2099202 = bit 1/11/21 = 劍士的 1/2/3 轉）。
"""

# (職業 id, 中文名, 轉職階段, 職業系列, 前一個職業)
JOBS = [
    ("100", "劍士", 1, "warrior", None),
    ("110", "狂戰士", 2, "warrior", "100"),
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

JOB_NAME = {jid: name for jid, name, _, _, _ in JOBS}

# bitmask 的 bit 編號 % 10 → 職業系列（bit 0/10/20 是初心者，1/11/21 是劍士…）
_BIT_FAMILY = ["初心者", "劍士", "法師", "弓箭手", "盜賊", "海盜"]
ALL_FAMILIES = _BIT_FAMILY[1:]


def mask_families(mask):
    """職業 bitmask → 職業系列中文名（依 _BIT_FAMILY 順序，去重）。"""
    out = []
    for bit in range(32):
        if mask >> bit & 1:
            fam = _BIT_FAMILY[bit % 10] if bit % 10 < len(_BIT_FAMILY) else None
            if fam and fam not in out:
                out.append(fam)
    return out


def job_labels(job_ids, all_limit=20):
    """任務的 Check["0"].job（職業 id 清單）→ 顯示用的中文名清單。

    涵蓋 ≥ all_limit 種職業的就是「全職業都能接」，回空清單（前端不顯示這條限制）。
    0 = 初心者（轉職前）。JOBS 沒收的 id（騎士團 1xxx / 2xxx 等未實裝職業）直接略過。
    """
    ids = sorted(set(job_ids))
    if len(ids) >= all_limit:
        return []
    out = []
    for jid in ids:
        name = "初心者" if jid == 0 else JOB_NAME.get(str(jid))
        if name and name not in out:
            out.append(name)
    return out
