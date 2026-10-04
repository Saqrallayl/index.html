#!/usr/bin/env python3
"""Contact sheet of the offline previews -> assets/walkthrough-stills.jpg"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'preview')
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'walkthrough-stills.jpg')

PICK = [
    ('01-aerial-sw', 'The whole floor, from the south-west'),
    ('17-stair', 'Top of the stairs — down to the foyer below'),
    ('02-aerial-se', 'Roof off: living, dining and kitchen read as one'),
    ('11-living2', 'Living room, looking back at the kitchen'),
    ('05-kitchen', 'Kitchen: back-wall run, island, pantry'),
    ('06-master', 'Master suite with the ensuite beyond'),
    ('19-evening-living', 'Evening: interior lights and the fireplace'),
    ('07-balcony', 'Covered balcony off the living room'),
]

def main():
    cols, rows = 2, 4
    cw, ch = 640, 410
    pad, top = 14, 74
    W = cols * cw + pad * (cols + 1)
    H = rows * ch + pad * (rows + 1) + top
    sheet = Image.new('RGB', (W, H), (244, 241, 234))
    d = ImageDraw.Draw(sheet)
    try:
        fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
        fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    except Exception:
        fb = fs = ImageFont.load_default()
    d.text((pad + 4, 20), 'Your plan, walkable — upper floor', fill=(27, 26, 24), font=fb)
    d.text((pad + 4, 48), '1,319 sq ft · 2 bedroom · 2½ bath · covered patio + balcony · stair to the foyer below',
           fill=(110, 104, 96), font=fs)
    for i, (name, cap) in enumerate(PICK):
        p = os.path.join(SRC, name + '.jpg')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGB').resize((cw, ch))
        cx = pad + (i % cols) * (cw + pad)
        cy = top + pad + (i // cols) * (ch + pad)
        sheet.paste(im, (cx, cy))
        d.rectangle([cx, cy, cx + cw - 1, cy + ch - 1], outline=(210, 205, 196))
        d.rectangle([cx, cy + ch - 26, cx + cw - 1, cy + ch - 1], fill=(24, 23, 22))
        d.text((cx + 10, cy + ch - 21), cap, fill=(240, 236, 228), font=fs)
    sheet.save(OUT, quality=88)
    print('wrote', OUT, sheet.size)

if __name__ == '__main__':
    main()
