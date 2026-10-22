"""Build public/sprites/alvira2.png ("Alvira 2.0 Testing") from Zulfian's frames.

Usage: python3 tools/build_alvira2.py tools/src/alvira2 public/sprites/alvira2.png

The frames (97x206, from "sprites alvira 2.0.zip") are a standing pose and four
walk steps for each facing. The game draws at its own pixel size (the canvas is
scaled up), so to keep the details of the drawing (sunglasses, flower clip,
necklace, belt, studs, watch, bag, boots) she is drawn bigger than the
villagers: STAND_H game pixels tall in a CELL_W x CELL_H cell, one sheet pixel
per game pixel. Standing frames are scaled to one height and walk frames a
little lower (mid-step), anchored at the feet, given a dark outline, and her
skin is pulled to the drawing's light tone (the shrink darkens it next to the
outline). Side walks alternate strides with the standing pose and bob up on
it, so her legs visibly move instead of gliding.
The layout matches CHAR_FRAMES in src/art/characters.ts.
"""
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter

CELL_W, CELL_H = 22, 36  # must match HeroDef.sheet in src/data/heroes.ts
STAND_H = 32
STEP = 0.95
OUTLINE = (34, 22, 30, 255)
SKIN = (255, 220, 170)

# Which source frame is which: standing, then walk steps, per facing (as seen on screen).
STAND = {'down': 5, 'up': 6, 'left': 8, 'right': 7}
# Walk cycle per facing: (source frame, pixels lifted). Front and back play the four steps as drawn.
# All four side drawings are strides with the feet apart (played in a row she glides), so the side
# walk alternates two strides with the standing pose (None) as the passing step, lifted a pixel.
WALK = {
    'down': [(10, 0), (17, 0), (22, 0), (28, 0)],
    'up': [(11, 0), (16, 0), (23, 0), (29, 0)],
    'left': [(13, 0), (None, 1), (25, 0), (None, 1)],
    'right': [(12, 0), (None, 1), (24, 0), (None, 1)],
}
FACINGS = ['down', 'up', 'right', 'left']


def load(d, n):
    """A frame without its magenta fringe, cropped."""
    im = Image.open(os.path.join(d, 'frame_%03d.png' % n)).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 140 or (r - g > 60 and b - g > 60):
                px[x, y] = (0, 0, 0, 0)
    return im.crop(im.getbbox())


def scaled(im, s):
    im = im.filter(ImageFilter.UnsharpMask(2, 120, 2))
    out = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    alpha = out.getchannel('A').point(lambda a: 255 if a >= 110 else 0)
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(out.convert('RGB')).enhance(1.15)).enhance(1.05)
    hard = Image.new('RGBA', out.size)
    hard.paste(rgb, mask=alpha)
    return brighten_skin(hard.crop(hard.getbbox()))


def is_skin(r, g, b):
    return r > 140 and g > 90 and r - b > 30 and r >= g >= b - 10


def brighten_skin(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and is_skin(r, g, b):
                px[x, y] = tuple(round(c + (t - c) * 0.6) for c, t in zip((r, g, b), SKIN)) + (255,)
    return im


def head_center(im):
    a = im.getchannel('A')
    top = a.crop((0, 0, im.width, max(1, im.height // 3))).getbbox()
    return (top[0] + top[2]) / 2 if top else im.width / 2


def cell(im, lift=0):
    c = Image.new('RGBA', (CELL_W, CELL_H))
    c.alpha_composite(im, (round(CELL_W / 2 - head_center(im)), CELL_H - im.height - lift))
    return c


def outline(sheet):
    a = sheet.getchannel('A').load()
    px = sheet.load()
    w, h = sheet.size
    for y in range(h):
        for x in range(w):
            if a[x, y]:
                continue
            near = ((x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if any(0 <= nx < w and 0 <= ny < h and nx // CELL_W == x // CELL_W and ny // CELL_H == y // CELL_H and a[nx, ny] for nx, ny in near):
                px[x, y] = OUTLINE
    return sheet


def main(src, out):
    rows = []
    for facing in FACINGS:
        raw = load(src, STAND[facing])
        s = STAND_H / raw.height
        stand = scaled(raw, s)
        # Walk frames were drawn at other sizes: mid-step she is a little lower than standing.
        walk = []
        for n, _ in WALK[facing]:
            w = None if n is None else load(src, n)
            walk.append(stand if w is None else scaled(w, STAND_H * STEP / w.height))
        lifts = [lift for _, lift in WALK[facing]]
        rows.append([
            cell(stand), cell(stand, lift=1),  # idle: a small breath
            *(cell(w, lift) for w, lift in zip(walk, lifts)),
            cell(walk[0]), cell(walk[2]),  # tool use: wind-up, strike
            cell(stand.crop((0, 0, stand.width, int(stand.height * 0.8)))),  # sitting: the seat hides the legs
            cell(stand), cell(walk[0], lift=2), cell(stand), cell(walk[2], lift=2),  # dance: hop
        ])
    sheet = Image.new('RGBA', (CELL_W * len(rows[0]), CELL_H * len(rows)))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            sheet.alpha_composite(c, (x * CELL_W, y * CELL_H))
    sheet = outline(sheet)
    sheet.save(out, optimize=True)
    print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
