"""把角色（身體+頭）與特效用同一套座標畫在一起，驗證錨點怎麼對。"""
import json, base64, io, sys, os
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATIC = os.path.join(ROOT, 'public', 'wz-static')

def load_canvas(outlink):
    p = os.path.join(STATIC, 'images', outlink.replace('/', os.sep) + '.webp')
    return Image.open(p).convert('RGBA')

def char_pieces(action='stand1', frame=0):
    body = json.load(open(os.path.join(STATIC,'json','Character','00002000.img.json'),encoding='utf-8'))
    head = json.load(open(os.path.join(STATIC,'json','Character','00012000.img.json'),encoding='utf-8'))
    bf = body[action][str(frame)]
    out=[]; anchors={}
    b = bf['body']
    out.append((load_canvas(b['_outlink']), -b['origin']['x'], -b['origin']['y'], 'body'))
    for k,v in b.get('map',{}).items(): anchors[k]=(v['x'],v['y'])
    a = bf['arm']
    ax, ay = anchors['navel']
    out.append((load_canvas(a['_outlink']), ax - a['map']['navel']['x'] - a['origin']['x'],
                ay - a['map']['navel']['y'] - a['origin']['y'], 'arm'))
    hf = head[action][str(frame)]['head']
    nx, ny = anchors['neck']
    out.append((load_canvas(hf['_outlink']), nx - hf['map']['neck']['x'] - hf['origin']['x'],
                ny - hf['map']['neck']['y'] - hf['origin']['y'], 'head'))
    return out, anchors

def navel_of(action='stand1', frame=0):
    body = json.load(open(os.path.join(STATIC,'json','Character','00002000.img.json'),encoding='utf-8'))
    m = body[action][str(frame)]['body']['map']['navel']
    return m['x'], m['y']

def eff_frames(path, book='default'):
    d = json.load(open(path, encoding='utf-8'))
    return d['effect']['framebooks'][book], d['effect']

def render(effect_json, out_png, book='default', mode='sub', looses=None, frame=0):
    pieces = char_pieces(frame=frame % 3)
    subs, meta = eff_frames(effect_json, book)
    layers = []  # (img, x, y, z)
    for img,x,y,name in pieces:
        layers.append((img,x,y,0))
    for i, s in enumerate(subs):
        frames = s['frames']
        if not frames: continue
        f = frames[frame % len(frames)]
        img = Image.open(io.BytesIO(base64.b64decode(f['image']))).convert('RGBA')
        ox, oy = f['origin']['x'], f['origin']['y']
        dx = -(looses[i] if looses and i < len(looses) else 0)
        z = int(f.get('position') or -1)
        layers.append((img, dx - ox, -oy, z))
    layers.sort(key=lambda L: L[3])
    minx = min(x for _,x,_,_ in layers); miny = min(y for _,_,y,_ in layers)
    maxx = max(x+im.width for im,x,_,_ in layers); maxy = max(y+im.height for _,y2,y,_ in [] ) if False else max(y+im.height for im,_,y,_ in layers)
    W,H = maxx-minx+4, maxy-miny+4
    canvas = Image.new('RGBA',(W,H),(255,255,255,0))
    for im,x,y,z in layers:
        canvas.alpha_composite(im, (x-minx+2, y-miny+2))
    # 標出角色原點 (0,0)
    px, py = -minx+2, -miny+2
    for dx in range(-3,4):
        if 0<=px+dx<W: canvas.putpixel((px+dx,py),(255,0,0,255))
    for dy in range(-3,4):
        if 0<=py+dy<H: canvas.putpixel((px,py+dy),(255,0,0,255))
    canvas = canvas.resize((W*3,H*3), Image.NEAREST)
    bg = Image.new('RGBA', canvas.size, (240,240,245,255))
    bg.alpha_composite(canvas)
    bg.convert('RGB').save(out_png)
    print('寫出', out_png, W, H)

if __name__ == '__main__':
    render('.scratch/effects/r_TMS_209.json', '.scratch/effects/out-duck.png', looses=[10,27,45,66,87])
    render('.scratch/effects/wings.json', '.scratch/effects/out-wings.png')
