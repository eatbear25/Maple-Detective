"""單一特效兩種錨點並排放大，看臉洞／地面對不對得上。"""
import json, base64, io, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0,'.scratch/effects')
from compose import char_pieces, navel_of
sys.stdout.reconfigure(encoding='utf-8')
CLIENT=json.load(open('.scratch/effects/Cash0501.json',encoding='utf-8'))
NAMES=json.load(open('reference-data/name-tables/Item.json',encoding='utf-8'))

def build(iid, frame, anchor, book=None):
    d=json.load(open(f'.scratch/effects/msio/{iid}.json',encoding='utf-8'))
    fb={k:v for k,v in d['effect']['framebooks'].items() if any(s['frames'] for s in v)}
    key=book or ('stand1' if 'stand1' in fb else ('default' if 'default' in fb else next(iter(fb))))
    subs=fb[key]
    eff=CLIENT[f'0{iid}']['effect']
    ls=[eff[k].get('loose',0) for k in sorted((x for x in eff if x.isdigit()), key=int)]
    pieces,_=char_pieces(frame=frame%3)
    ax,ay = navel_of(frame=frame%3) if anchor=='navel' else (0,0)
    layers=[(im,x,y,0) for im,x,y,_ in pieces]
    for i,s in enumerate(subs):
        fr=s['frames']
        if not fr: continue
        f=fr[frame%len(fr)]
        im=Image.open(io.BytesIO(base64.b64decode(f['image']))).convert('RGBA')
        layers.append((im, ax-(ls[i] if i<len(ls) else 0)-f['origin']['x'], ay-f['origin']['y'],
                       int(f.get('position') or -1)))
    layers.sort(key=lambda L:L[3])
    minx=min(x for _,x,_,_ in layers); miny=min(y for _,_,y,_ in layers)
    maxx=max(x+im.width for im,x,_,_ in layers); maxy=max(y+im.height for im,_,y,_ in layers)
    # 地面線畫在 y=0
    c=Image.new('RGBA',(maxx-minx,maxy-miny),(0,0,0,0))
    for im,x,y,_ in layers: c.alpha_composite(im,(x-minx,y-miny))
    return c, -miny

iid=int(sys.argv[1]); frame=int(sys.argv[2]) if len(sys.argv)>2 else 0
cells=[]
for anchor in ('origin','navel'):
    img, groundY = build(iid, frame, anchor)
    S=4
    img=img.resize((img.width*S, img.height*S), Image.NEAREST)
    bg=Image.new('RGBA', img.size, (250,250,252,255)); bg.alpha_composite(img)
    dr=ImageDraw.Draw(bg)
    dr.line([(0,groundY*S),(bg.width,groundY*S)], fill=(220,60,60,255), width=1)  # 角色原點 y=0
    cells.append((anchor,bg))
W=sum(c.width for _,c in cells)+30; H=max(c.height for _,c in cells)+26
sheet=Image.new('RGB',(W,H),(250,250,252)); dr=ImageDraw.Draw(sheet)
x=0
for anchor,c in cells:
    sheet.paste(c.convert('RGB'), (x, 24))
    dr.text((x+4,6), f"{anchor} 錨點", fill=(20,20,30)); x += c.width+30
dr.text((W-200,6), f"{iid} {NAMES[str(iid)]['name']}", fill=(20,20,30))
sheet.save(f'.scratch/effects/zoom-{iid}.png')
print('ok', sheet.size)
