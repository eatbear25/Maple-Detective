"""補技能圖示：客戶端圖集比對不到的技能，改抓參考站的圖。

用法：
    python tools/fetch-skill-icons.py

輸出 public/icons/skill/<skillId>.png，並把來源記進
reference-data/skill-icon-map.json（`src: "ref"` + `file`）。已經有圖、
或 map 裡已標成 `src: "client"` 的技能一律跳過，可重複執行。

## 為什麼要有這支

客戶端圖集（`.wzspritesheet`）只有座標沒有名字，「哪張圖是哪個技能」推不出來
（原因見 tools/extract-skill-icons.py 的 docstring）。1/2 轉當初是靠像素比對
認出來的，3/4 轉（未來視）沒做過比對，所以先用參考站的圖把版面補齊。

參考站：https://jamox80.github.io/maplestory-skill-simulator/ 的 `data.js`
（UTF-8，`allProfessionsData` 裡每個技能帶 `name` 與 `imageUrl`）。它的 12 條
職業線涵蓋 316 個技能裡的大部分，但**不是全部**——本腳本結束時會列出還缺圖的
技能，那些要嘛等參考站補、要嘛回頭做客戶端圖集比對。

## 名稱對照的兩個坑

1. 參考站用「職業線 + 轉職階段」分組（例：`拳霸 (Buccaneer)` → `3轉 (格鬥家)`），
   階段標題裡的職業名跟 Artale 不一定一樣（格鬥家=拳霸、拳霸=拳王、神射手=神弓手），
   所以**不能拿階段標題去比職業名**，要用「職業線 → 4 轉職業 id」的固定對照表，
   再沿 `from` 往回走到該階段。
2. 同名技能（楓葉祝福、核爆術…）在每條職業線各有一份圖，所以比對一定要
   **限定在該職業內**，不能全域比名字。
"""

import json
import os
import re
import sys
import urllib.request

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_JSON = os.path.join(PROJECT, "src", "data", "generated", "skills.json")
MAP_PATH = os.path.join(PROJECT, "reference-data", "skill-icon-map.json")
OUT_DIR = os.path.join(PROJECT, "public", "icons", "skill")

REF_BASE = "https://jamox80.github.io/maplestory-skill-simulator/"
HEADERS = {"User-Agent": "maple-detective/1.0 (fan site asset fetch)"}

# 參考站的職業線 → 我們的 4 轉職業 id（其餘階段沿 from 往回走）
LINE_TO_JOB4 = {
    "主教": "232",
    "火毒大魔導": "212",
    "冰雷大魔導": "222",
    "英雄": "112",
    "聖騎士": "122",
    "黑騎士": "132",
    "箭神": "312",
    "神射手": "322",
    "暗影神偷": "422",
    "夜使者": "412",
    "拳霸": "512",
    "槍神": "522",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def parse_ref(js):
    """回傳 {職業線: {轉職階段(int): [(技能名, imageUrl), ...]}}。

    data.js 是手寫的 JS 字面值、格式不統一（有的一行、有的展開多行），所以不硬解
    語法：先切出職業線與階段的區塊，再在區塊裡把每個 `imageUrl` 配上它前面最近的
    `name`。
    """
    lines = [(m.start(), m.group(1)) for m in re.finditer(r'\n    "([^"]+)": \{', js)]
    out = {}
    for i, (start, title) in enumerate(lines):
        end = lines[i + 1][0] if i + 1 < len(lines) else len(js)
        seg = js[start:end]
        line_name = title.split(" (")[0]
        stages = [(m.start(), m.group(1)) for m in re.finditer(r'\n            "([^"]+)": \[', seg)]
        by_tier = {}
        for k, (s_start, s_title) in enumerate(stages):
            s_end = stages[k + 1][0] if k + 1 < len(stages) else len(seg)
            tier = int(s_title[0]) if s_title[:1].isdigit() else -1
            if tier < 1:
                continue  # 0 轉（新手）與超技能/5 轉，我們不收
            sub = seg[s_start:s_end]
            pairs = []
            for m in re.finditer(r'imageUrl:\s*["\']([^"\']+)["\']', sub):
                names = list(re.finditer(r'name:\s*["\']([^"\']+)["\']', sub[: m.start()]))
                if names:
                    pairs.append((names[-1].group(1), m.group(1)))
            by_tier[tier] = pairs
        out[line_name] = by_tier
    return out


def main():
    # Windows 主控台是 cp950，技能名有它印不出來的字，統一轉成 UTF-8 輸出
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    with open(SKILLS_JSON, encoding="utf-8") as f:
        data = json.load(f)
    jobs = {j["id"]: j for j in data["jobs"]}
    skills = data["skills"]

    icon_map = {}
    if os.path.exists(MAP_PATH):
        with open(MAP_PATH, encoding="utf-8") as f:
            icon_map = json.load(f)

    ref = parse_ref(fetch(REF_BASE + "data.js").decode("utf-8"))

    # (職業 id, 技能名) → imageUrl
    ref_by_skill = {}
    for line_name, by_tier in ref.items():
        job4 = LINE_TO_JOB4.get(line_name)
        if not job4:
            print(f"  參考站多出職業線「{line_name}」，沒有對照表，略過")
            continue
        chain = {}  # tier → job id
        cur = jobs[job4]
        while cur:
            chain[cur["tier"]] = cur["id"]
            cur = jobs.get(cur["from"]) if cur["from"] else None
        for tier, pairs in by_tier.items():
            job = chain.get(tier)
            if not job:
                continue
            for name, url in pairs:
                ref_by_skill.setdefault((job, name), url)

    os.makedirs(OUT_DIR, exist_ok=True)
    n_new, n_have, missing = 0, 0, []
    for s in skills:
        dest = os.path.join(OUT_DIR, f"{s['id']}.png")
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            n_have += 1
            continue
        url = ref_by_skill.get((s["job"], s["name"]))
        if not url:
            missing.append(s)
            continue
        try:
            blob = fetch(REF_BASE + url.lstrip("/"))
        except Exception as e:  # 參考站少圖就當沒有，不要整批中斷
            print(f"  {s['id']} {s['name']}：下載失敗 {e}")
            missing.append(s)
            continue
        with open(dest, "wb") as f:
            f.write(blob)
        icon_map[s["id"]] = {
            "job": s["job"],
            "name": s["name"],
            "src": "ref",
            "file": os.path.basename(url),
        }
        n_new += 1

    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(icon_map, f, ensure_ascii=False, indent=1, sort_keys=True)

    print(f"新抓 {n_new} 個、已存在 {n_have} 個 → {OUT_DIR}")
    if missing:
        print(f"還缺 {len(missing)} 個（參考站也沒有，UI 會顯示替代圖示）：")
        for s in missing:
            print(f"  {s['id']} {jobs[s['job']]['name']} / {s['name']}")


if __name__ == "__main__":
    sys.exit(main())
