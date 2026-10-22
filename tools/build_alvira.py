"""Build public/sprites/alvira.png, the player sheet, from Zulfian's Alvira frames.

Usage: python3 tools/build_alvira.py <frames dir> public/sprites/alvira.png

The source frames (frame_001.png .. frame_020.png, 169x400) were drawn at a few
different scales, so every pose is scaled to a common standing height and
anchored bottom-centre (feet) in an 18x30 cell at game resolution. To match the
villagers (16x24, big heads) she is 26 px tall, a little wider than the source
and her head is drawn larger than her body; then she is cut to hard pixels with
a dark outline.
The layout matches CHAR_FRAMES in src/art/characters.ts: per facing
(down, up, right, left) 2 idle, 4 walk, 2 tool-use, 1 sit, 4 dance.
There are no front/back walk drawings, so those walks lift one boot at a time.
"""
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter

RES = 1  # sheet pixels per game pixel
CELL_W, CELL_H = 18, 30
STAND_H = 26  # standing height; villagers are 24
WIDEN = 1.2  # the source is slimmer than the villagers
HEAD = 0.24  # top share of a pose that is the head
HEAD_SCALE = 1.8  # head drawn this much larger than the body
OUTLINE = (34, 22, 30, 255)
SKIN, SKIN_LIGHT, EYE = (226, 168, 132, 255), (246, 206, 170, 255), (40, 26, 34, 255)
FACINGS = ['down', 'up', 'right', 'left']


def load(d, n):
    im = Image.open(os.path.join(d, 'frame_%03d.png' % n)).convert('RGBA')
    return im.crop(im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox())


def shrink(im, s):
    im = im.filter(ImageFilter.UnsharpMask(6, 200, 2))  # keep eyes and edges through the big downscale
    return im.resize((max(1, round(im.width * s * WIDEN)), max(1, round(im.height * s))), Image.LANCZOS)


def scaled(im, height, head_scale=HEAD_SCALE):
    """Shrink a pose to `height` px with the head enlarged, so it reads at villager size."""
    hh = int(im.height * HEAD)
    head, body = im.crop((0, 0, im.width, hh)), im.crop((0, hh, im.width, im.height))
    s = (height + 1) / (hh * head_scale + body.height)  # head overlaps the body by 1 px
    h, b = shrink(head, s * head_scale), shrink(body, s)
    w = max(h.width, b.width)
    out = Image.new('RGBA', (w, h.height + b.height - 1))
    out.alpha_composite(b, ((w - b.width) // 2, h.height - 1))
    out.alpha_composite(h, ((w - h.width) // 2, 0))
    return out.crop(out.getbbox())


def pixelate(sheet):
    """Hard alpha, livelier colours and a 1 px outline, like the code-drawn villagers."""
    alpha = sheet.getchannel('A').point(lambda a: 255 if a >= 110 else 0)
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(sheet.convert('RGB')).enhance(1.3)).enhance(1.05)
    out = Image.new('RGBA', sheet.size)
    out.paste(rgb, mask=alpha)
    w, h = sheet.size
    a, px = alpha.load(), out.load()
    for y in range(h):
        for x in range(w):
            if a[x, y]:
                continue
            near = ((x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if any(0 <= nx < w and 0 <= ny < h and nx // CELL_W == x // CELL_W and a[nx, ny] for nx, ny in near):
                px[x, y] = OUTLINE
    return out


def head_center(im):
    """X centre of the top quarter (the head), so the head stays put between poses."""
    a = im.getchannel('A')
    top = a.crop((0, 0, im.width, max(1, im.height // 4))).getbbox()
    return (top[0] + top[2]) / 2 if top else im.width / 2


def cell(im, lift=0, center=None):
    c = Image.new('RGBA', (CELL_W, CELL_H))
    cx = head_center(im) if center is None else center
    c.alpha_composite(im, (round(CELL_W / 2 - cx), CELL_H - im.height - lift))
    return c


def step(im, side):
    """Front/back walk: lift the boot on one side (0 left, 1 right) by one game pixel."""
    out = im.copy()
    w, h = im.size
    knee = int(h * 0.8)
    half = (0, knee, w // 2, h) if side == 0 else (w // 2, knee, w, h)
    leg = im.crop(half)
    out.paste(Image.new('RGBA', leg.size), half[:2])
    out.alpha_composite(leg, (half[0], knee - RES))
    return out


def seated_back(im):
    """Back view on a chair: drop the legs, the seat hides them."""
    return im.crop((0, 0, im.width, int(im.height * 0.62)))


def is_skin(p):
    r, g, b, a = p
    return a and r > 150 and r >= g >= b - 12 and (r - b > 25 or r + g + b > 600)


def paint_faces(sheet):
    """At this size the eyes melt into the skin, so redraw the face: flat skin tones, then the eyes."""
    px = sheet.load()
    for row in (0, 2, 3):  # down, right, left (the back view shows no face)
        for col in range(sheet.width // CELL_W):
            x0, y0 = col * CELL_W, row * CELL_H
            body = sheet.crop((x0, y0, x0 + CELL_W, y0 + CELL_H)).getbbox()
            if not body:
                continue
            top = y0 + body[1]
            skin = [(x, y) for y in range(top, top + 11) for x in range(x0, x0 + CELL_W) if is_skin(px[x, y])]
            if len(skin) < 4:
                continue
            for x, y in skin:
                px[x, y] = SKIN_LIGHT if sum(px[x, y][:3]) > 660 else SKIN
            xs, ys = [x for x, _ in skin], [y for _, y in skin]
            fx0, fx1, ey = min(xs), max(xs), min(ys) + 2
            eyes = {0: (fx0 + 1, fx1 - 1), 2: (fx1 - 1,), 3: (fx0 + 1,)}[row]
            for ex in eyes:
                if is_skin(px[ex, ey]) or px[ex, ey] in (SKIN, SKIN_LIGHT):
                    px[ex, ey] = EYE
    return sheet


def main(src, out):
    f = {n: load(src, n) for n in range(1, 21)}
    tall = {n: scaled(f[n], STAND_H) for n in range(1, 8)}  # front/back/side, full height
    stride = {n: scaled(f[n], STAND_H * 0.97) for n in range(8, 15)}
    small = STAND_H / f[18].height  # 015-020 share a stockier scale
    pose = {n: scaled(f[n], STAND_H) for n in range(15, 20)}
    crouch = scaled(f[20], f[20].height * small, head_scale=1)  # head is not on top here
    mid = lambda im: im.width / 2

    down = [
        cell(tall[1]), cell(tall[7]),
        cell(step(tall[1], 0)), cell(tall[5], lift=1), cell(step(tall[1], 1)), cell(tall[5], lift=1),
        cell(tall[4]), cell(tall[5]),
        cell(crouch, center=mid(crouch)),
        cell(tall[4]), cell(pose[15]), cell(pose[19]), cell(pose[18]),
    ]
    up = [
        cell(tall[2]), cell(tall[3]),
        cell(step(tall[2], 0)), cell(tall[3], lift=1), cell(step(tall[2], 1)), cell(tall[3], lift=1),
        cell(tall[3]), cell(tall[2]),
        cell(seated_back(pose[17])),
        cell(tall[2]), cell(tall[3]), cell(pose[17]), cell(tall[3]),
    ]
    right = [
        cell(tall[6]), cell(tall[6]),
        cell(stride[9]), cell(tall[6], lift=1), cell(stride[12]), cell(tall[6], lift=1),
        cell(tall[6]), cell(stride[10]),
        cell(crouch.transpose(Image.FLIP_LEFT_RIGHT), center=mid(crouch)),
        cell(tall[6]), cell(pose[16]), cell(tall[6]), cell(pose[16]),
    ]
    left = [c.transpose(Image.FLIP_LEFT_RIGHT) for c in right]
    left[8] = cell(crouch, center=mid(crouch))
    rows = [down, up, right, left]

    sheet = Image.new('RGBA', (CELL_W * len(down), CELL_H * len(rows)))
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            sheet.alpha_composite(c, (x * CELL_W, y * CELL_H))
    sheet = paint_faces(pixelate(sheet))
    sheet.save(out, optimize=True)
    print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
