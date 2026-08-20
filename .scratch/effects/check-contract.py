"""照 renderer 的 pickEffectBook/buildEffectTrack 邏輯，把 45 件特效 × 11 個動作全跑一遍。"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
cat = json.load(open('src/data/generated/fashion-catalog.json', encoding='utf-8'))['effects']
ACTIONS = ["stand1","walk1","stand2","walk2","jump","alert","prone","sit","ladder","rope","fly"]
BACK = {"ladder","rope"}

def pick(books, action):
    for k in ([action,"backDefault","default"] if action in BACK else [action,"default","backDefault"]):
        if k in books: return k
    return next(iter(books), None)

problems, notes = [], []
for row in cat:
    iid = row['i']
    d = json.load(open(f'.scratch/effects/msio/{iid}.json', encoding='utf-8'))
    books = {k: v for k, v in (d['effect']['framebooks'] or {}).items()
             if any(s['frames'] for s in v)}
    if not books:
        problems.append(f"{iid} {row['n']}：maplestory.io 沒有任何有幀的 book")
        continue
    trail = row.get('t')
    for action in ACTIONS:
        b = pick(books, action)
        subs = books.get(b) or []
        if not subs:
            problems.append(f"{iid} {row['n']} / {action}：選到空 book {b}")
        if trail and len(subs) != len(trail):
            problems.append(f"{iid} {row['n']} / {action}：隊列 {len(trail)} 隻 但 msio 給 {len(subs)} 隻")
    # 只有 default 的 action 型特效：所有動作都會落到同一份圖（正常，UOL 連結被攤平）
    if row['k'] == 'action' and set(books) <= {'default'}:
        notes.append(f"{iid} {row['n']}：只有 default（動作變化在 msio 被攤平成同一份）")
    zo = row.get('zo') or {}
    for book in zo:
        if book not in books:
            notes.append(f"{iid} {row['n']}：z 例外的 book「{book}」msio 沒有，該動作會用主 z")

print(f"檢查 {len(cat)} 件 × {len(ACTIONS)} 動作")
print("問題：", len(problems))
for p in problems[:20]: print("  ✗", p)
print("備註：", len(notes))
for n in notes[:12]: print("  ·", n)
