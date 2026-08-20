import json,os,sys,urllib.request
sys.stdout.reconfigure(encoding='utf-8')
tree=json.load(open('.scratch/effects/Cash0501.json',encoding='utf-8'))
names=json.load(open('reference-data/name-tables/Item.json',encoding='utf-8'))
comm=json.load(open('reference-data/commodity-history/2026-08-20.json',encoding='utf-8'))['commodity']
onsale={r['ItemId'] for r in comm.values() if isinstance(r.get('ItemId'),int)}
os.makedirs('.scratch/effects/msio',exist_ok=True)
rows=[]
for k in sorted(tree):
    iid=int(k)
    p=f'.scratch/effects/msio/{iid}.json'
    if not os.path.exists(p):
        try:
            with urllib.request.urlopen(urllib.request.Request(f'https://maplestory.io/api/TMS/209/item/{iid}', headers={'User-Agent':'Mozilla/5.0'}), timeout=180) as r:
                open(p,'wb').write(r.read())
        except Exception as e:
            open(p,'w').write('null'); print(iid,'ERR',e)
    try: d=json.load(open(p,encoding='utf-8'))
    except Exception: d=None
    fb=((d or {}).get('effect') or {}).get('framebooks') or {}
    total=sum(len(s['frames']) for v in fb.values() for s in v)
    books={k2:[len(s['frames']) for s in v] for k2,v in fb.items() if any(s['frames'] for s in v)}
    nm=names.get(str(iid),{}).get('name','???')
    kb=os.path.getsize(p)//1024
    rows.append((iid,nm,total,len(books),kb,iid in onsale,books))
    print(f"{iid} {nm:<12} 幀總數={total:<4} 有效book={len(books):<3} {kb}KB {'商城在售' if iid in onsale else ''}")
json.dump([{'id':r[0],'name':r[1],'frames':r[2],'books':r[6],'kb':r[4],'onSale':r[5]} for r in rows],
          open('.scratch/effects/coverage.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print('---- 沒有任何幀的：', [f'{r[0]} {r[1]}' for r in rows if r[2]==0])
print('總計 KB', sum(r[4] for r in rows))
