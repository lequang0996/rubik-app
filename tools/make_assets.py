"""Tạo icon Android, splash và ảnh cho Google Play từ ảnh render trong /tmp/art (xem README → 'Tài sản đồ hoạ').
Chạy:  python tools/make_assets.py <thư_mục_ảnh_render> """
import os, sys, glob
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ART = sys.argv[1] if len(sys.argv) > 1 else '/tmp/art'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android/app/src/main/res')
STORE = os.path.join(ROOT, 'store')
os.makedirs(STORE, exist_ok=True)
BG1, BG2 = (29, 34, 54), (12, 14, 22)

def load(n):
    im = Image.open(f'{ART}/{n}.png').convert('RGBA')
    return im.crop(im.getbbox())

def fit(im, box):
    s = min(box / im.width, box / im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def gradient(w, h):
    g = Image.new('RGB', (w, h), BG2)
    px = g.load()
    cx, cy, r = w / 2, h * 0.42, max(w, h) * 0.75
    for y in range(h):
        for x in range(w):
            d = min(1.0, ((x - cx) ** 2 + (y - cy) ** 2) ** .5 / r)
            px[x, y] = tuple(round(BG1[i] * (1 - d) + BG2[i] * d) for i in range(3))
    return g

def paste_center(base, im, dy=0):
    base.alpha_composite(im, ((base.width - im.width) // 2, (base.height - im.height) // 2 + dy))

def shadowed(im):
    sh = Image.new('RGBA', (im.width + 80, im.height + 80), (0, 0, 0, 0))
    a = im.split()[3].point(lambda v: int(v * 0.5))
    blk = Image.new('RGBA', im.size, (0, 0, 0, 255)); blk.putalpha(a)
    sh.alpha_composite(blk, (40, 52))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    sh.alpha_composite(im, (40, 40))
    return sh

cube = shadowed(load('cube_solved'))

# ---- icon launcher (mipmap) ----
def legacy(size, rnd):
    bg = gradient(size, size).convert('RGBA')
    c = fit(cube, size * 0.80)
    paste_center(bg, c)
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    if rnd: d.ellipse((0, 0, size - 1, size - 1), fill=255)
    else: d.rounded_rectangle((0, 0, size - 1, size - 1), radius=size * 0.22, fill=255)
    bg.putalpha(mask)
    return bg

def foreground(size):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    paste_center(im, fit(cube, size * 0.60))   # vùng an toàn adaptive icon = 66/108
    return im

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in DENS.items():
    base = os.path.join(RES, f'mipmap-{d}')
    legacy(round(48 * k), False).save(f'{base}/ic_launcher.png')
    legacy(round(48 * k), True).save(f'{base}/ic_launcher_round.png')
    foreground(round(108 * k)).save(f'{base}/ic_launcher_foreground.png')
open(os.path.join(RES, 'values/ic_launcher_background.xml'), 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#161B2E</color>\n</resources>\n')
fg_xml = os.path.join(RES, 'drawable-v24/ic_launcher_foreground.xml')
if os.path.exists(fg_xml): os.remove(fg_xml)

# ---- splash (Android < 12) ----
for f in glob.glob(os.path.join(RES, 'drawable*/splash.png')):
    w, h = Image.open(f).size
    im = gradient(w, h).convert('RGBA')
    paste_center(im, fit(cube, min(w, h) * 0.34))
    im.convert('RGB').save(f)

# ---- Google Play ----
legacy(512, False).convert('RGBA').save(f'{STORE}/icon-512.png')
icon = gradient(512, 512).convert('RGBA'); paste_center(icon, fit(cube, 410))
icon.convert('RGB').save(f'{STORE}/icon-512.png')            # Play tự bo góc → không cần bo sẵn

fg = gradient(1024, 500).convert('RGBA')
for name, x, box, dy in (('cube_mix', 640, 330, 20), ('pyra', 470, 210, 70), ('skewb', 870, 210, 70)):
    pass
def put(name, cx, cy, box):
    im = shadowed(load(name)); im = fit(im, box)
    fg.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))
put('skewb', 900, 330, 210); put('pyra', 560, 340, 210); put('cube_mix', 740, 250, 330)
dr = ImageDraw.Draw(fg)
def font(size, bold=True):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',):
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
dr.text((50, 150), 'Cube All', font=font(56), fill=(233, 236, 245))
dr.text((50, 214), 'In One', font=font(56), fill=(233, 236, 245))
dr.text((52, 300), 'Learn algorithms', font=font(28, False), fill=(142, 150, 179))
dr.text((52, 340), '& play 3D puzzles', font=font(28, False), fill=(142, 150, 179))
fg.convert('RGB').save(f'{STORE}/feature-graphic-1024x500.png')
print('Đã tạo icon, splash và ảnh Play Store →', STORE)
