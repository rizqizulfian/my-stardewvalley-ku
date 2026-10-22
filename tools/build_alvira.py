"""Build public/sprites/alvira.png, the player sheet, from Zulfian's Alvira frames.

Usage: python3 tools/build_alvira.py <frames dir> public/sprites/alvira.png

The source frames (frame_001.png .. frame_020.png, 169x400) were drawn at a few
different scales, so every pose is scaled to a common standing height and
anchored bottom-centre (feet) in a 54x102 cell, 3x the in-game size (18x34).
The layout matches CHAR_FRAMES in src/art/characters.ts: per facing
(down, up, right, left) 2 idle, 4 walk, 2 tool-use, 1 sit, 4 dance.
There are no front/back walk drawings, so those walks lift one boot at a time.
"""
import os
import sys

from PIL import Image

RES = 3
CELL_W, CELL_H = 18 * RES, 34 * RES
STAND_H = 32 * RES  # standing height in texture px
FACINGS = ['down', 'up', 'right', 'left']


def load(d, n):
    im = Image.open(os.path.join(d, 'frame_%03d.png' % n)).convert('RGBA')
    return im.crop(im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox())


def scaled(im, height):
    s = height / im.height
    return im.resize((max(1, round(im.width * s)), round(height)), Image.LANCZOS)


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


def main(src, out):
    f = {n: load(src, n) for n in range(1, 21)}
    tall = {n: scaled(f[n], STAND_H) for n in range(1, 8)}  # front/back/side, full height
    stride = {n: scaled(f[n], STAND_H * 0.97) for n in range(8, 15)}
    small = STAND_H / f[18].height  # 015-020 share a stockier scale
    pose = {n: scaled(f[n], STAND_H) for n in range(15, 20)}
    crouch = f[20].resize((round(f[20].width * small), round(f[20].height * small)), Image.LANCZOS)
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
    sheet.save(out, optimize=True)
    print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
