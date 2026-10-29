"""Separa as 4 poses da imagem de referência em PNGs individuais com fundo transparente.
Convenção do projeto: TODOS os sprites olham para a DIREITA (o código inverte no CSS quando for para a esquerda)."""
import sys
from PIL import Image, ImageOps
import numpy as np

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
a = np.array(im)
solid = a[..., 3] > 40

# (nome, caixa de busca x0,y0,x1,y1, inverter_horizontalmente)
regions = [
    ("idle",  (0,   0,   775, 515),  True),   # em pé: na referência olha p/ esquerda -> inverte
    ("walk",  (775, 0,   1536, 515), False),
    ("happy", (0,   515, 775, 1024), False),
    ("sleep", (775, 515, 1536, 1024), False),
]
PAD = 4
for name, (x0, y0, x1, y1), flip in regions:
    sub = solid[y0:y1, x0:x1]
    ys, xs = np.where(sub)
    box = (x0 + xs.min() - PAD, y0 + ys.min() - PAD, x0 + xs.max() + PAD + 1, y0 + ys.max() + PAD + 1)
    sprite = im.crop(box)
    if flip:
        sprite = ImageOps.mirror(sprite)
    sprite.save(f"{out}/sprites/{name}.png", optimize=True)
    print(name, sprite.size)

# ícones da barra de menus (22 px e 44 px de altura) a partir da pose sentada
happy = Image.open(f"{out}/sprites/happy.png")
for h, suffix in ((22, ""), (44, "@2x")):
    w = round(happy.width * h / happy.height)
    happy.resize((w, h), Image.LANCZOS).save(f"{out}/icons/tray{suffix}.png")
