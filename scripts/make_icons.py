"""Génère les icônes de l'appli (PWA, Apple, Electron, Android) à partir du même dessin.
Usage : python3 scripts/make_icons.py   (nécessite Pillow)"""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RED = (200, 66, 58, 255)
WHITE = (255, 255, 255, 255)

def draw(size: int, rounded: bool, scale: float = 1.0, bg=None) -> Image.Image:
    """Le sceau rouge du logo. `scale` réduit le dessin (zone de sécurité des icônes « maskable »)."""
    S = size * 4  # sur-échantillonnage pour des bords lisses
    img = Image.new('RGBA', (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = S / 40  # le dessin d'origine fait 40 x 40
    if rounded:
        d.rounded_rectangle([2 * u, 2 * u, 38 * u, 38 * u], radius=9 * u, fill=RED)
    else:
        d.rectangle([0, 0, S, S], fill=RED)
    c = S / 2
    k = u * scale
    w = max(1, round(2.8 * k))
    def line(x1, y1, x2, y2):
        X1, Y1, X2, Y2 = (c + (x1 - 20) * k, c + (y1 - 20) * k, c + (x2 - 20) * k, c + (y2 - 20) * k)
        d.line([X1, Y1, X2, Y2], fill=WHITE, width=w)
        r = w / 2
        for (x, y) in ((X1, Y1), (X2, Y2)):
            d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    line(11, 14, 29, 14)
    line(14, 20, 26, 20)
    line(11, 26, 29, 26)
    line(20, 10, 20, 30)
    return img.resize((size, size), Image.LANCZOS)

pub = ROOT / 'public'
pub.mkdir(exist_ok=True)
draw(192, True).save(pub / 'icon-192.png')
draw(512, True).save(pub / 'icon-512.png')
draw(512, False, scale=0.78).save(pub / 'icon-maskable-512.png')
draw(180, False, scale=0.85).save(pub / 'apple-touch-icon.png')

desk = ROOT / 'desktop' / 'build'
desk.mkdir(parents=True, exist_ok=True)
draw(1024, True).save(desk / 'icon.png')

andr = ROOT / 'assets' / 'android'
for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    folder = andr / f'mipmap-{name}'
    folder.mkdir(parents=True, exist_ok=True)
    draw(px, True).save(folder / 'ic_launcher.png')
    draw(px, True).save(folder / 'ic_launcher_round.png')
print('icônes générées')
