"""把幾個特效各自疊在同一隻角色上，輸出一張對照表。"""
import json, base64, io, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0,'.scratch/effects')
from compose import char_pieces, navel_of

CLIENT = json.load(open('.scratch/effects/Cash0501.json',encoding='utf-8'))
KINDS = {r['i']: r['k'] for r in json.load(open('src/data/generated/fashion-catalog.json',encoding='utf-8'))['effects']}
NAMES = json.load(open('reference-data/name-tables/Item.json',encoding='utf-8'))

def looses(iid):
    eff = CLIENT[f'0{iid}']['effect']
    return [eff[k].get('loose',0) for k in sorted(eff, key=lambda s:int(s) if s.isdigit() else 99) if k.isdigit()]

def cell(iid, frame=0, book=None, action='stand1', anchor='navel'):
    d=json.load(open(f'.scratch/effects/msio/{iid}.json',encoding='utf-8'))
    fb=d['effect']['framebooks']
    key = book or (action if fb.get(action) and any(s['frames'] for s in fb[action]) else 'default')
    subs = fb.get(key) or []
    if not any(s['frames'] for s in subs):
        subs = next((v for v in fb.values() if any(s['frames'] for s in v)), [])
    ls = looses(iid)
    pieces, _ = char_pieces(frame=frame%3)
    layers=[(im,x,y,0) for im,x,y,_ in pieces]
    kind = KINDS.get(iid)
    use_navel = (anchor=='navel') or (anchor=='rule' and kind=='follow')
    ax, ay = navel_of(frame=frame%3) if use_navel else (0,0)
    for i,s in enumerate(subs):
        fr=s['frames']
        if not fr: continue
        f=fr[frame%len(fr)]
        im=Image.open(io.BytesIO(base64.b64decode(f['image']))).convert('RGBA')
        ox,oy=f['origin']['x'],f['origin']['y']
        dx = -(ls[i] if i<len(ls) else 0)
        layers.append((im, ax+dx-ox, ay-oy, int(f.get('position') or -1)))
    layers.sort(key=lambda L:L[3])
    minx=min(x for _,x,_,_ in layers); miny=min(y for _,_,y,_ in layers)
    maxx=max(x+im.width for im,x,_,_ in layers); maxy=max(y+im.height for im,_,y,_ in layers)
    c=Image.new('RGBA',(maxx-minx,maxy-miny),(0,0,0,0))
    for im,x,y,_ in layers: c.alpha_composite(im,(x-minx,y-miny))
    return c

ANCHOR=(sys.argv[1] if len(sys.argv)>1 else 'navel')
IDS=[int(x) for x in (sys.argv[2].split(',') if len(sys.argv)>2 else '5010024,5010068,5010070,5010028,5010000,5010019,5010013,5010057,5010052,5010039,5010002,5010045'.split(','))]
COLS=4; CW,CH=230,190
sheet=Image.new('RGB',(COLS*CW,((len(IDS)+COLS-1)//COLS)*CH),(250,250,252))
dr=ImageDraw.Draw(sheet)
for n,iid in enumerate(IDS):
    try: im=cell(iid, frame=2, anchor=ANCHOR)
    except Exception as e:
        print(iid,'FAIL',e); continue
    s=min((CW-20)/im.width,(CH-34)/im.height,2.5)
    im=im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))),Image.NEAREST)
    cx=(n%COLS)*CW; cy=(n//COLS)*CH
    bg=Image.new('RGBA',(im.width,im.height),(250,250,252,255)); bg.alpha_composite(im)
    sheet.paste(bg.convert('RGB'), (cx+(CW-im.width)//2, cy+26+(CH-34-im.height)//2))
    dr.text((cx+8,cy+8), f"{iid} {NAMES[str(iid)]['name']}", fill=(20,20,30))
    dr.rectangle([cx,cy,cx+CW-1,cy+CH-1], outline=(220,220,228))
sheet.save(f'.scratch/effects/sheet-{ANCHOR}.png')
print('ok', sheet.size)
