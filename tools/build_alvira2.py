"""Build public/sprites/alvira2.png ("Alvira 2.0 Testing") from Zulfian's sheet.

Usage: python3 tools/build_alvira2.py tools/src/alvira2-sheet.png public/sprites/alvira2.png

The source (spritesheet 3.png) holds a single front-facing standing pose on a
magenta key. It is keyed out, shrunk to villager height in an 18x30 cell and
cut to hard pixels with a dark outline. Every other pose is made from that one
drawing: walks lift one boot at a time, the back view paints hair over the
face, the side views are the front pose (there are no side drawings yet).
The layout matches CHAR_FRAMES in src/art/characters.ts.
"""
import sys

from PIL import Image, ImageEnhance

CELL_W, CELL_H = 18, 30
STAND_H = 27
WIDEN = 1.25  # the source is slimmer than the villagers
# Sampled from the drawing's face.
SKIN, SKIN_LIGHT, EYE = (250, 212, 164, 255), (255, 230, 194, 255), (40, 26, 34, 255)
OUTLINE = (34, 22, 30, 255)


def key(im):
    """Magenta background -> transparent."""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0 or (r - g > 70 and b - g > 70):
                px[x, y] = (0, 0, 0, 0)
    return im


def poses(im):
    """Split the sheet at the empty columns between drawings."""
    a = im.getchannel('A')
    cols = [a.crop((x, 0, x + 1, im.height)).getbbox() is not None for x in range(im.width)]
    out, start = [], None
    for x, used in enumerate(cols + [False]):
        if used and start is None:
            start = x
        elif not used and start is not None:
            if x - start > 20:
                part = im.crop((start, 0, x, im.height))
                out.append(part.crop(part.getbbox()))
            start = None
    return out


def shrink(im, tallest):
    s = STAND_H / tallest
    out = im.resize((max(1, round(im.width * s * WIDEN)), max(1, round(im.height * s))), Image.BOX)
    alpha = out.getchannel('A').point(lambda a: 255 if a >= 120 else 0)
    rgb = ImageEnhance.Color(out.convert('RGB')).enhance(1.15)
    hard = Image.new('RGBA', out.size)
    hard.paste(rgb, mask=alpha)
    return hard.crop(hard.getbbox())


def cell(im, lift=0):
    c = Image.new('RGBA', (CELL_W, CELL_H))
    c.alpha_composite(im, ((CELL_W - im.width) // 2, CELL_H - im.height - lift))
    return c


def step(im, side):
    """Lift the boot on one side (0 left, 1 right) by a pixel."""
    out = im.copy()
    w, h = im.size
    knee = int(h * 0.8)
    half = (0, knee, w // 2, h) if side == 0 else (w // 2, knee, w, h)
    leg = im.crop(half)
    out.paste(Image.new('RGBA', leg.size), half[:2])
    out.alpha_composite(leg, (half[0], knee - 1))
    return out


def is_skin(p):
    r, g, b, a = p
    return a and r > 150 and r >= g >= b - 12 and r - b > 25


def face(im, eyes: str | None = 'both'):
    """Flat light skin (the drawing's), then dark eyes: at this size they melt into the skin otherwise."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):  # hands too
        for x in range(out.width):
            if is_skin(px[x, y]):
                px[x, y] = SKIN_LIGHT if sum(px[x, y][:3]) > 660 else SKIN
    skin = [(x, y) for y in range(int(out.height * 0.45)) for x in range(out.width) if px[x, y] in (SKIN, SKIN_LIGHT)]
    if len(skin) < 4 or eyes is None:
        return out
    xs, ys = [x for x, _ in skin], [y for _, y in skin]
    ey = min(ys) + 2
    for ex in {'both': (min(xs) + 1, max(xs) - 1), 'right': (max(xs) - 1,), 'left': (min(xs) + 1,)}[eyes]:
        px[ex, ey] = EYE
    return out


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
    drawn = poses(key(Image.open(src)))
    assert len(drawn) == 4, f'expected 4 poses, found {len(drawn)}'
    tallest = max(d.height for d in drawn)
    front, rear, right, left = [shrink(d, tallest) for d in drawn]
    front, rear, right, left = face(front), face(rear, None), face(right, 'right'), face(left, 'left')

    def row(f):
        return [
            cell(f), cell(f),
            cell(step(f, 0)), cell(f, lift=1), cell(step(f, 1)), cell(f, lift=1),
            cell(f), cell(f, lift=1),
            cell(f.crop((0, 0, f.width, int(f.height * 0.8)))),
            cell(f), cell(step(f, 0)), cell(f, lift=1), cell(step(f, 1)),
        ]

    rows = [row(front), row(rear), row(right), row(left)]
    sheet = Image.new('RGBA', (CELL_W * len(rows[0]), CELL_H * len(rows)))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            sheet.alpha_composite(c, (x * CELL_W, y * CELL_H))
    sheet = outline(sheet)
    sheet.save(out, optimize=True)
    print(out, sheet.size, 'poses', [d.size for d in (front, rear, right, left)])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
