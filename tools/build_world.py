"""Build the hi-res world art (public/sprites/world/<texture key>.png) from Zulfian's sprites.

Usage: python3 tools/build_world.py tools/src/world public/sprites/world

tools/src/world/sprite_NN.png are the 50 cut-outs from "sprites 2.zip" (an AI
sprite sheet at roughly 4x detail: ground tiles, trees, plants, farm objects,
buildings). tools/src/world/base/<key>.png is a snapshot of the game's own
generated texture for each key (read from window.lembah.game.textures); it
gives every frame's size, the space the old drawing filled (so sizes and
positions in the game stay the same) and the shapes of tile edges.

Each output PNG is RES times the size of its base texture, frame for frame;
src/art/hires.ts swaps it in for the generated texture (HIRES_KEYS there must
list the same keys). What is done per kind:
- ground tiles: the middle of the source tile, squared to 64x64, evened out and
  made seamless; tile edges keep the old shapes (alpha and rim shading of the
  old edge tiles laid over the new texture). Water drifts by a pixel per frame.
- trees, bushes, plants, objects: fitted into the old drawing's box, standing on
  the same bottom line; sway frames lean the top by one game pixel.
- buildings: stretched to the old drawing's box so walls cover the same
  colliders; window glow overlays (the "-lit" keys) are made from their windows.
Anything not listed keeps the generated art.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

RES = 4
T = 16 * RES
RNG = np.random.default_rng(7)

SRC = sys.argv[1] if len(sys.argv) > 1 else 'tools/src/world'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites/world'


# ---------------------------------------------------------------------------
# Loading and cleanup


def sprite(n):
    """A cut-out with its magenta background fringe removed, hard alpha, trimmed."""
    a = np.array(Image.open(os.path.join(SRC, 'sprite_%02d.png' % n)).convert('RGBA')).astype(np.int32)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    for _ in range(3):
        r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
        magenta = (r > g + 50) & (b > g + 40) & (al > 0)
        edge = al > 0
        clear = np.zeros_like(edge)
        clear[1:, :] |= al[:-1, :] == 0
        clear[:-1, :] |= al[1:, :] == 0
        clear[:, 1:] |= al[:, :-1] == 0
        clear[:, :-1] |= al[:, 1:] == 0
        a[..., 3] = np.where(magenta & edge & clear, 0, a[..., 3])
    # Any magenta left inside becomes the dark outline colour.
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    inner = (r > g + 60) & (b > g + 60) & (a[..., 3] > 0)
    a[inner] = (40, 24, 32, 255)
    img = Image.fromarray(a.astype(np.uint8), 'RGBA')
    return img.crop(img.getbbox())


def split_row(img, min_pixels=400):
    """Splits a sprite holding several objects into its connected parts, left to right."""
    a = np.array(img)[..., 3] > 0
    h, w = a.shape
    label = np.zeros((h, w), np.int32)
    parts = []
    for sy, sx in zip(*np.nonzero(a)):
        if label[sy, sx]:
            continue
        n = len(parts) + 1
        stack, pts = [(sy, sx)], []
        label[sy, sx] = n
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not label[yy, xx]:
                        label[yy, xx] = n
                        stack.append((yy, xx))
        parts.append(pts)
    big = [i + 1 for i, p in enumerate(parts) if len(p) >= min_pixels]
    # Small specks (a loose leaf, a fruit) join the nearest big part.
    owner = {}
    centers = {n: np.mean(parts[n - 1], axis=0) for n in big}
    for i, p in enumerate(parts):
        n = i + 1
        if n in centers:
            owner[n] = n
        else:
            c = np.mean(p, axis=0)
            owner[n] = min(big, key=lambda b: np.hypot(*(centers[b] - c)))
    src = np.array(img)
    out = []
    for n in sorted(big, key=lambda b: centers[b][1]):
        keep = np.isin(label, [k for k, v in owner.items() if v == n])
        part = src.copy()
        part[~keep] = 0
        im = Image.fromarray(part, 'RGBA')
        out.append(im.crop(im.getbbox()))
    return out


def resize(img, w, h):
    """Smooth downscale (premultiplied), then hard alpha so edges stay crisp."""
    w, h = max(1, round(w)), max(1, round(h))
    out = img.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')
    a = np.array(out)
    a[..., 3] = np.where(a[..., 3] >= 110, 255, 0)
    return Image.fromarray(a, 'RGBA')


def base(key):
    return Image.open(os.path.join(SRC, 'base', key + '.png')).convert('RGBA')


class Sheet:
    """The hi-res sheet for one texture key, laid out like its base texture."""

    def __init__(self, key, fw, fh):
        self.key, self.fw, self.fh = key, fw, fh
        self.old = base(key)
        self.cols = self.old.width // fw
        self.count = self.cols * (self.old.height // fh)
        self.img = self.old.resize((self.old.width * RES, self.old.height * RES), Image.NEAREST)

    def origin(self, i):
        return (i % self.cols) * self.fw, (i // self.cols) * self.fh

    def old_frame(self, i):
        x, y = self.origin(i)
        return self.old.crop((x, y, x + self.fw, y + self.fh))

    def put(self, i, frame):
        x, y = self.origin(i)
        clear = Image.new('RGBA', (self.fw * RES, self.fh * RES))
        clear.alpha_composite(frame)
        self.img.paste(clear, (x * RES, y * RES))

    def save(self):
        os.makedirs(OUT, exist_ok=True)
        self.img.save(os.path.join(OUT, self.key + '.png'), optimize=True)
        print('wrote', self.key, self.img.size)


# ---------------------------------------------------------------------------
# Objects


def place(img, fw, fh, box, mode='fit', align='bottom', widen=1.2):
    """Draws img into a fw x fh (game px) frame inside box = (x0, y0, x1, y1) in game px.

    fit: uniform scale, centred on the box, standing on its bottom; may widen up to `widen`
         times toward the box width, so the drawing still covers the old collider.
    fill: stretched to the box (buildings, so walls cover the colliders).
    """
    x0, y0, x1, y1 = [v * RES for v in box]
    bw, bh = x1 - x0, y1 - y0
    if mode == 'fill':
        w, h = bw, bh
    else:
        s = min(bw / img.width, bh / img.height)
        w, h = min(bw, img.width * s * widen), img.height * s
    part = resize(img, w, h)
    frame = Image.new('RGBA', (fw * RES, fh * RES))
    px = x0 + (bw - part.width) // 2
    py = y1 - part.height if align == 'bottom' else y0 + (bh - part.height) // 2
    frame.alpha_composite(part, (int(px), int(py)))
    return frame


def old_box(key, i=0, fw=None, fh=None):
    im = base(key)
    if fw:
        cols = im.width // fw
        x, y = (i % cols) * fw, (i // cols) * fh
        im = im.crop((x, y, x + fw, y + fh))
    return im.getbbox()


def lean(frame, px, keep_rows=0):
    """Sway frame: rows shift sideways, px game pixels at the top, none at the base."""
    a = np.array(frame)
    h = a.shape[0]
    rows = np.nonzero(a[..., 3].any(axis=1))[0]
    if not len(rows) or px == 0:
        return frame
    top, bottom = rows[0], h - keep_rows * RES
    out = np.zeros_like(a)
    for y in range(h):
        t = 0 if y >= bottom else (bottom - y) / max(1, bottom - top)
        out[y] = np.roll(a[y], int(round(px * RES * min(1, t))), axis=0)
    return Image.fromarray(out, 'RGBA')


def swaying(key, img, fw, fh, keep_rows=4, frames=(-1, 0, 1)):
    sh = Sheet(key, fw, fh)
    box = old_box(key, 1, fw, fh)
    still = place(img, fw, fh, box, widen=1.0 if fw > 20 else 1.2)
    for i, px in enumerate(frames):
        sh.put(i, lean(still, px, keep_rows))
    return sh


def single(key, img, mode='fit', box=None):
    old = base(key)
    sh = Sheet(key, old.width, old.height)
    sh.put(0, place(img, old.width, old.height, box or old.getbbox(), mode))
    return sh


def inpaint(img, mask, passes=40):
    """Fills masked pixels from their unmasked neighbours (removes fruit, sprouts...)."""
    a = np.array(img).astype(np.float64)
    m = mask.copy()
    for _ in range(passes):
        if not m.any():
            break
        acc = np.zeros(a.shape[:2] + (3,))
        cnt = np.zeros(a.shape[:2])
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            src = np.roll(np.roll(a, dy, 0), dx, 1)
            ok = ~np.roll(np.roll(m, dy, 0), dx, 1) & (np.roll(np.roll(a[..., 3], dy, 0), dx, 1) > 0)
            acc += src[..., :3] * ok[..., None]
            cnt += ok
        fill = m & (cnt > 0)
        a[fill, :3] = acc[fill] / cnt[fill, None]
        m = m & ~fill
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def grow(mask, n=1):
    m = mask.copy()
    for _ in range(n):
        g = m.copy()
        g[1:] |= m[:-1]
        g[:-1] |= m[1:]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g
    return m


def shrink(mask, n=1):
    return ~grow(~mask, n)


def hue_mask(img, test):
    a = np.array(img).astype(np.int32)
    return test(a[..., 0], a[..., 1], a[..., 2]) & (a[..., 3] > 0)


def glow(img, rects, test):
    """Window glow overlay: glass pixels inside rects (fractions of the image) turned warm."""
    a = np.array(img).astype(np.int32)
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    sel = np.zeros((h, w), bool)
    for fx0, fy0, fx1, fy1 in rects:
        sel[int(fy0 * h):int(fy1 * h), int(fx0 * w):int(fx1 * w)] = True
    glass = sel & test(a[..., 0], a[..., 1], a[..., 2]) & (a[..., 3] > 0)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255
    out[..., 0] = 255
    out[..., 1] = (190 + 50 * lum).clip(0, 255)
    out[..., 2] = (90 + 80 * lum).clip(0, 255)
    out[..., 3] = np.where(glass, 255, 0)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def is_glass(r, g, b):
    return (b > 110) & (b > r + 40) & (b > g + 5)


# ---------------------------------------------------------------------------
# Ground tiles


def tile_texture(n, inset=0.08, seamless=True, flatten=True, crop=None, chunk=2):
    """The middle of a source tile, squared, evened out and seamless.

    Ground is drawn at `chunk` sheet pixels per texel (2 = twice the game's detail): at the
    full 4x the AI noise reads as glitter across a whole field.
    """
    img = sprite(n).convert('RGB')
    w, h = img.size
    if crop:
        img = img.crop(crop)
    else:
        img = img.crop((int(w * inset), int(h * inset), int(w * (1 - inset)), int(h * (1 - inset))))
    n_px = T // chunk
    img = img.resize((n_px, n_px), Image.LANCZOS)
    a = np.array(img).astype(np.float64)
    if flatten:
        # Take out large light/dark patches so repeats don't show as stripes.
        blur = np.array(img.filter(ImageFilter.GaussianBlur(n_px / 4.5))).astype(np.float64)
        a = a - blur + blur.reshape(-1, 3).mean(axis=0)
    if seamless:
        # Edges come from the middle of a half-shifted copy, cross-faded toward the middle.
        shifted = np.roll(np.roll(a, n_px // 2, 0), n_px // 2, 1)
        edge = np.minimum(np.arange(n_px), n_px - 1 - np.arange(n_px))
        d = np.minimum.outer(edge, edge)
        wgt = np.clip(d / (n_px * 0.25), 0, 1)[..., None]
        a = a * wgt + shifted * (1 - wgt)
    a = np.repeat(np.repeat(a, chunk, 0), chunk, 1)
    return a.clip(0, 255)


def luminance(a):
    return a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11


def textured(old, tex, ref_lum, roll=(0, 0)):
    """An old tile's shape and rim shading over the new texture."""
    o = np.array(old.resize((T, T), Image.NEAREST)).astype(np.float64)
    t = np.roll(np.roll(tex, roll[1], 0), roll[0], 1)
    ratio = np.clip(luminance(o) / max(1.0, ref_lum), 0.55, 1.45)[..., None]
    rgb = np.clip(t * ratio, 0, 255)
    return Image.fromarray(np.dstack([rgb, o[..., 3:4]]).astype(np.uint8), 'RGBA')


def tile_sheet(key, full_index, variants, textures, frames=1, per_frame=None, drift=None):
    """Dual-grid tiles: masks 0..14 keep their shape, full tiles take the textures.

    textures: list of T x T arrays (first = mask 15, the rest = full variants).
    """
    sh = Sheet(key, 16, 16)
    per_frame = per_frame or sh.count // frames
    for f in range(frames):
        roll = drift[f] if drift else (0, 0)
        ref = luminance(np.array(sh.old_frame(f * per_frame + full_index)).astype(np.float64)).mean()
        for m in range(per_frame):
            i = f * per_frame + m
            if m == full_index or m in variants:
                k = 0 if m == full_index else 1 + variants.index(m)
                tex = textures[k % len(textures)]
                sh.put(i, textured(Image.new('RGBA', (16, 16), (128, 128, 128, 255)), tex, 128, roll))
            else:
                sh.put(i, textured(sh.old_frame(i), textures[0], ref, roll))
    return sh


def flip(a):
    return a[:, ::-1]


def match_mean(a, ref):
    return np.clip(a - a.reshape(-1, 3).mean(axis=0) + ref.reshape(-1, 3).mean(axis=0), 0, 255)


def build_tiles():
    grass_a = tile_texture(5)
    grass_b = match_mean(tile_texture(4), grass_a)
    grass_c = match_mean(tile_texture(3), grass_a)
    sh = Sheet('tiles-grass', 16, 16)
    for i, tex in enumerate([grass_a, grass_b, flip(grass_a), grass_c, flip(grass_b), np.roll(grass_a, 24, 1)]):
        sh.put(i, textured(Image.new('RGBA', (16, 16), (128, 128, 128, 255)), tex, 128))
    sh.save()

    meadow = tile_texture(3)
    meadow_b = match_mean(tile_texture(6), meadow)
    tile_sheet('tiles-meadow', 15, [16, 17, 18, 19], [meadow, meadow_b, flip(meadow), np.roll(meadow, 32, 0), flip(meadow_b)]).save()

    path = tile_texture(7)
    tile_sheet('tiles-path', 15, [], [path]).save()
    sand = tile_texture(10)
    tile_sheet('tiles-sand', 15, [16, 17, 18, 19], [sand, flip(sand), np.roll(sand, 32, 1), np.roll(flip(sand), 32, 0), sand]).save()
    paved = tile_texture(11, flatten=False)
    tile_sheet('tiles-paved', 15, [], [paved]).save()

    # Water drifts a game pixel per frame and back.
    drift = [(0, 0), (RES, 0), (2 * RES, RES), (RES, RES)]
    water = tile_texture(12)
    tile_sheet('tiles-water', 15, [16, 17, 18, 19], [water, flip(water), np.roll(water, 32, 0), np.roll(flip(water), 32, 1), water], frames=4, drift=drift).save()
    deep = tile_texture(13)
    tile_sheet('tiles-deep-water', 15, [], [deep]).save()
    s14 = sprite(14)
    sea = tile_texture(14, crop=(6, 6, s14.width - 6, int(s14.height * 0.7)))
    tile_sheet('tiles-sea', 15, [16, 17, 18, 19], [sea, flip(sea), np.roll(sea, 32, 0), np.roll(flip(sea), 32, 1), sea], frames=4, drift=drift).save()

    # Tilled soil: the source tiles have sprouts / water marks on them; paint those out.
    sh = Sheet('tiles-soil', 16, 16)
    for wet, n in ((0, 8), (1, 9)):
        s = sprite(n)
        marks = hue_mask(s, lambda r, g, b: ((g >= r * 0.82) & (g > 70)) | ((b >= g - 4) & (b > 60)))
        s = inpaint(s, grow(marks, 2))
        img = s.convert('RGB')
        w, h = img.size
        img = img.crop((int(w * 0.06), int(h * 0.06), int(w * 0.94), int(h * 0.94))).resize((T, T), Image.LANCZOS)
        tex = np.array(img).astype(np.float64)
        ref = luminance(np.array(sh.old_frame(wet * 16 + 15)).astype(np.float64)).mean()
        for m in range(16):
            sh.put(wet * 16 + m, textured(sh.old_frame(wet * 16 + m), tex, ref))
    sh.save()


# ---------------------------------------------------------------------------


def build_plants():
    trees = split_row(sprite(27))  # apple tree, pine, banana, coconut palm, berry bush
    apple, pine, banana, palm, berry = trees

    swaying('prop-tree-round', sprite(26), 32, 46).save()
    swaying('prop-tree-fruit', apple, 32, 46).save()
    fruit = hue_mask(apple, lambda r, g, b: (r > 100) & (r > g + 45))
    fruit[int(apple.height * 0.68):] = False  # the trunk is brown-red too
    bare = inpaint(apple, grow(fruit, 2))
    swaying('prop-tree-fruit-bare', bare, 32, 46).save()
    swaying('prop-tree-slender', pine, 22, 46).save()

    # The coconut palm is drawn bare; coconuts go under the crown for the unpicked tree.
    swaying('prop-palm-bare', palm, 44, 60).save()
    nuts = palm.copy()
    a = np.array(nuts)
    cols = np.nonzero(a[..., 3].any(axis=0))[0]
    # The trunk meets the leaves where the opaque span first gets narrow, under the crown.
    widths = [(a[y, :, 3] > 0).sum() for y in range(a.shape[0])]
    crown_bottom = next(y for y in range(int(a.shape[0] * 0.3), a.shape[0]) if widths[y] < a.shape[1] * 0.25)
    trunk = np.nonzero(a[crown_bottom, :, 3])[0]
    cx = int(trunk.mean())
    from PIL import ImageDraw

    d = ImageDraw.Draw(nuts)
    r = max(4, nuts.width // 22)
    for ox, oy in ((-r * 1.6, -r * 1.2), (r * 1.4, -r * 1.1), (0, -r * 0.2)):
        x, y = cx + ox, crown_bottom + oy - r
        d.ellipse((x - r, y - r, x + r, y + r), fill=(92, 58, 30, 255), outline=(42, 26, 20, 255), width=max(1, r // 4))
        d.ellipse((x - r * 0.5, y - r * 0.6, x, y - r * 0.1), fill=(140, 96, 52, 255))
    swaying('prop-palm', nuts, 44, 60).save()

    swaying('prop-banana', banana, 44, 54).save()
    nob = inpaint(banana, hue_mask(banana, lambda r, g, b: (r > 150) & (g > 110) & (b < 90) & (r > g + 10)))
    swaying('prop-banana-bare', nob, 44, 54).save()

    swaying('prop-bush', sprite(32), 20, 16, keep_rows=2).save()
    swaying('prop-bush-berry', berry, 20, 16, keep_rows=2).save()
    swaying('decor-tuft', sprite(31), 8, 8, keep_rows=1).save()
    swaying('decor-reeds', sprite(28), 10, 14, keep_rows=2).save()

    # Crops: only the grown (harvest) stage is drawn new.
    for key, n in (('crop-matahari', 29), ('crop-mawar', 30)):
        sh = Sheet(key, 16, 24)
        sh.put(4, place(sprite(n), 16, 24, old_box(key, 4, 16, 24)))
        sh.save()


def build_objects():
    for key, n in (
        ('prop-rock', 45),
        ('prop-boulder', 39),
        ('prop-stump', 40),
        ('prop-mailbox', 35),
        ('prop-well', 33),
        ('prop-bench', 42),
        ('prop-crate', 43),
        ('farm-hay-bale', 44),
    ):
        single(key, sprite(n)).save()

    lamp = sprite(34)
    single('prop-lamp', lamp).save()
    lit = place(lamp, 16, 32, base('prop-lamp').getbbox())
    single_lit = Sheet('prop-lamp-lit', 16, 32)
    single_lit.put(0, glow(lit, [(0, 0, 1, 0.35)], lambda r, g, b: (r > 170) & (g > 130)))
    single_lit.save()

    # Fence: post plus rails toward each connected side (N 1, E 2, S 4, W 8).
    post = sprite(38)
    run = sprite(37)
    a = np.array(run)[..., 3] > 0
    full = a.sum(axis=0) > a.shape[0] * 0.8  # post columns
    xs = np.nonzero(full)[0]
    gaps = [(xs[i], xs[i + 1]) for i in range(len(xs) - 1) if xs[i + 1] - xs[i] > 3]
    gx0, gx1 = gaps[0]
    rail = run.crop((gx0 + 1, 0, gx1, run.height))
    rail = rail.crop(rail.getbbox())
    sh = Sheet('prop-fence', 16, 16)
    railbox = None
    old10 = np.array(sh.old_frame(10))[..., 3] > 0
    rows = np.nonzero(old10[:, 0])[0]
    railbox = (rows[0], rows[-1] + 1)
    for m in range(16):
        bx = old_box('prop-fence', m, 16, 16)
        frame = Image.new('RGBA', (16 * RES, 16 * RES))
        rh = (railbox[1] - railbox[0] + 1) * RES
        rw = rail.width * rh / rail.height
        r_img = resize(rail, rw, rh)
        strip = Image.new('RGBA', (8 * RES + 4, rh))
        x = 0
        while x < strip.width:
            strip.alpha_composite(r_img, (int(x), 0))
            x += r_img.width
        top = (railbox[0] - 0.5) * RES
        if m & 2:
            frame.alpha_composite(strip, (8 * RES, int(top)))
        if m & 8:
            frame.alpha_composite(strip, (-4, int(top)))
        p = place(post, 16, 16, (5, 0 if m & 1 else 2, 11, 16 if m & 4 else 15), mode='fill' if (m & 5) else 'fit')
        frame.alpha_composite(p)
        sh.put(m, frame)
    sh.save()

    # Beehive: bees buzz around the full hive.
    hive = sprite(36)
    for key, bees in (('farm-hive', True), ('farm-hive-empty', False)):
        sh = Sheet(key, 16, 22)
        still = place(hive, 16, 22, (1, 4, 15, 22))
        for f in range(3):
            fr = still.copy()
            if bees:
                from PIL import ImageDraw

                d = ImageDraw.Draw(fr)
                for k in range(3):
                    ang = f * 2.1 + k * 2.09
                    bx = 8 * RES + math.cos(ang) * 5 * RES
                    by = 4 * RES + math.sin(ang) * 2.5 * RES
                    d.ellipse((bx - 3, by - 3, bx + 3, by + 3), fill=(250, 200, 40, 255), outline=(40, 28, 20, 255))
                    d.ellipse((bx - 2, by - 6, bx + 2, by - 3), fill=(235, 245, 255, 255))
            sh.put(f, fr)
        sh.save()


def build_buildings():
    house = sprite(47)
    single('prop-house', house, 'fill').save()
    house_lit = Sheet('prop-house-lit', 80, 74)
    house_lit.put(0, glow(place(house, 80, 74, base('prop-house').getbbox(), 'fill'), [(0.15, 0.35, 0.9, 0.8)], is_glass))
    house_lit.save()

    shop = sprite(49)
    single('prop-shop', shop, 'fill').save()
    shop_lit = Sheet('prop-shop-lit', 80, 74)
    shop_lit.put(0, glow(place(shop, 80, 74, base('prop-shop').getbbox(), 'fill'), [(0.41, 0.22, 0.58, 0.33), (0.08, 0.69, 0.95, 0.95)], is_glass))
    shop_lit.save()

    barn = sprite(50)
    single('farm-animal-barn', barn, 'fill').save()
    barn_lit = Sheet('farm-animal-barn-lit', 112, 92)
    barn_lit.put(0, glow(place(barn, 112, 92, base('farm-animal-barn').getbbox(), 'fill'), [(0.4, 0.38, 0.6, 0.6)], is_glass))
    barn_lit.save()

    # sprite 48 (barn with silo) is tall and narrow; the hay barn is a long low shed, so it keeps
    # the generated art rather than being squashed.

    # Windmill: the sails are cut out of the drawing and turned (an X looks the same every
    # 90 degrees, so four frames cover a quarter turn).
    mill = sprite(46)
    a = np.array(mill).astype(np.int32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    cream = (r > 185) & (g > 160) & (b > 110) & (r - b < 110) & (al > 0)
    cream[int(a.shape[0] * 0.5):] = False
    lum = r * 0.3 + g * 0.59 + b * 0.11
    # Close the sails over their own frame lines, then take their dark outline too.
    cream = shrink(grow(cream, 4), 4) & (al > 0)
    sails = cream | (grow(cream, 3) & (lum < 95) & (al > 0))
    sail_img = np.zeros_like(a)
    sail_img[sails] = a[sails]
    body = a.copy()
    body[sails, 3] = 0
    # The tower's sides are straight: fit them on rows the sails don't cross, then fill the
    # tower behind the sails row by row (planks run sideways) and drop leftovers outside it.
    hy = int(np.median(np.nonzero(cream)[0]))
    sail_rows = sails.any(axis=1)
    rows = [y for y in range(hy, int(a.shape[0] * 0.7)) if not sail_rows[y] and (body[y, :, 3] > 0).any()]
    ls = [np.nonzero(body[y, :, 3])[0][0] for y in rows]
    rs = [np.nonzero(body[y, :, 3])[0][-1] for y in rows]
    lfit, rfit = np.polyfit(rows, ls, 1), np.polyfit(rows, rs, 1)
    hx = int(np.median(np.nonzero(cream)[1]))
    col = (a[:, hx, 3] > 0) & ~sails[:, hx]
    top = int(np.nonzero(col)[0][0])
    for y in range(a.shape[0]):
        if not sail_rows[y]:
            continue
        l, r = int(round(np.polyval(lfit, y))), int(round(np.polyval(rfit, y)))
        if y < top:
            l, r = 1, 0
        for x in range(a.shape[1]):
            if x < l or x > r:
                if sails[y, x] or not col.any():
                    body[y, x, 3] = 0
                elif y < hy + 40 and body[y, x, 3] and not (l <= x <= r):
                    body[y, x, 3] = 0
                continue
            if body[y, x, 3] == 0 or sails[y, x]:
                xs = np.nonzero((body[y, :, 3] > 0) & ~sails[y])[0]
                xs = xs[(xs >= l) & (xs <= r)]
                if len(xs):
                    body[y, x] = body[y, xs[np.argmin(np.abs(xs - x))]]
                    body[y, x, 3] = 255
    body_img = Image.fromarray(body.astype(np.uint8), 'RGBA')
    sail_img = Image.fromarray(sail_img.astype(np.uint8), 'RGBA')
    ys, xs = np.nonzero(cream)
    hub = (int(np.median(xs)), int(np.median(ys)))
    sh = Sheet('farm-windmill', 64, 104)
    box = old_box('farm-windmill', 0, 64, 104)
    # The tower fills the old tower's height; sails may reach past it sideways.
    s = (box[3] - 4) * RES / mill.height
    W, H = 64 * RES, 104 * RES
    bw, bh = mill.width * s, mill.height * s
    ox = (W - bw) / 2
    oy = H - bh
    body_s = resize(body_img, bw, bh)
    hub_s = (ox + hub[0] * s, oy + hub[1] * s)
    big = sail_img.resize((mill.width * 2, mill.height * 2), Image.NEAREST)
    for f in range(4):
        fr = Image.new('RGBA', (W, H))
        fr.alpha_composite(body_s, (int(ox), int(oy)))
        rot = big.rotate(-22.5 * f, resample=Image.NEAREST, center=(hub[0] * 2, hub[1] * 2))
        rot = resize(rot, bw, bh)
        layer = Image.new('RGBA', (W, H))
        layer.alpha_composite(rot, (int(ox), int(oy)))
        fr.alpha_composite(layer)
        sh.put(f, fr)
    sh.save()


if __name__ == '__main__':
    build_tiles()
    build_plants()
    build_objects()
    build_buildings()
