"""Cartes de la planète Alma, vue du grand hublot (acte 2).

    python tools/planete.py            # écrit assets/space/alma.jpg et assets/space/grain.jpg
    python tools/planete.py apercu     # écrit en plus tools/sources/alma-apercu.png (contrôle des continents)

Depuis une orbite basse, on ne voit qu'une calotte d'une trentaine de degrés autour du point survolé. La carte ne couvre donc
qu'un morceau de la sphère (120° de longitude sur 90° de latitude), ce qui donne trois fois la finesse d'une carte complète du
même poids. Elle ne contient pas des couleurs mais des grandeurs lisses, que la matière transforme en image :

    rouge  altitude (niveau de la mer à 0,5)      vert  humidité      bleu  couverture nuageuse

« grain.jpg » est un bruit qui se répète sans raccord ; la matière l'ajoute à plusieurs échelles pour garder des côtes et des
nuages nets, quelle que soit la distance (voir le ciel dans app/world.js).
"""
import sys

import numpy as np
from PIL import Image

W, H = 2048, 1536
LON, LAT = np.radians(60), np.radians(45)  # demi-étendues de la carte
SEED = 26


def perm(seed):
    p = np.arange(256, dtype=np.int32)
    np.random.default_rng(seed).shuffle(p)
    return np.concatenate([p, p])


def perlin3(x, y, z, p):
    xi, yi, zi = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32), np.floor(z).astype(np.int32)
    xf, yf, zf = (x - xi).astype(np.float32), (y - yi).astype(np.float32), (z - zi).astype(np.float32)
    xi &= 255; yi &= 255; zi &= 255
    u, v, w = (t * t * t * (t * (t * 6 - 15) + 10) for t in (xf, yf, zf))

    def grad(h, a, b, c):
        h = h & 15
        g1 = np.where(h < 8, a, b)
        g2 = np.where(h < 4, b, np.where((h == 12) | (h == 14), a, c))
        return np.where(h & 1, -g1, g1) + np.where(h & 2, -g2, g2)

    def corner(dx, dy, dz):
        return grad(p[p[p[xi + dx] + yi + dy] + zi + dz], xf - dx, yf - dy, zf - dz)

    x00 = corner(0, 0, 0) + u * (corner(1, 0, 0) - corner(0, 0, 0))
    x10 = corner(0, 1, 0) + u * (corner(1, 1, 0) - corner(0, 1, 0))
    x01 = corner(0, 0, 1) + u * (corner(1, 0, 1) - corner(0, 0, 1))
    x11 = corner(0, 1, 1) + u * (corner(1, 1, 1) - corner(0, 1, 1))
    y0, y1 = x00 + v * (x10 - x00), x01 + v * (x11 - x01)
    return y0 + w * (y1 - y0)


def fbm(P, freq, octaves, seed, ridged=False, gain=0.5):
    s, a, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        n = perlin3(P[0] * freq + 17.3 * o, P[1] * freq - 9.1 * o, P[2] * freq + 4.7 * o, perm(seed + o))
        if ridged:
            n = 1 - np.abs(n) * 2
            n = n * n
        s = s + a * n; tot += a; a *= gain; freq *= 2.02
    return s / tot


def sphere():
    lon = np.linspace(-LON, LON, W, dtype=np.float32)[None, :]
    lat = np.linspace(LAT, -LAT, H, dtype=np.float32)[:, None]
    return [np.cos(lat) * np.sin(lon), np.sin(lat) * np.ones_like(lon), np.cos(lat) * np.cos(lon)]


def swirl(P, centre, radius, turn):
    """Fait tourner les points autour d'un axe, d'autant plus qu'ils en sont proches : une dépression en spirale."""
    c = np.array(centre, dtype=np.float32); c /= np.linalg.norm(c)
    d = P[0] * c[0] + P[1] * c[1] + P[2] * c[2]
    ang = turn * np.exp(-np.square(np.arccos(np.clip(d, -1, 1)) / radius))
    co, si = np.cos(ang), np.sin(ang)
    cr = [c[1] * P[2] - c[2] * P[1], c[2] * P[0] - c[0] * P[2], c[0] * P[1] - c[1] * P[0]]
    return [P[i] * co + cr[i] * si + c[i] * d * (1 - co) for i in range(3)]


def cartes():
    P = sphere()
    # continents : un bruit large, déformé par un second pour casser les formes rondes, puis des chaînes de montagnes là où la terre émerge
    wx, wy, wz = (fbm(P, 2.1, 4, SEED + 100 + 7 * i) for i in range(3))
    Q = [P[0] + 0.32 * wx, P[1] + 0.32 * wy, P[2] + 0.32 * wz]
    cont = fbm(Q, 2.2, 8, SEED)
    h = 0.468 + cont * 1.05
    land = np.clip((h - 0.5) * 9, 0, 1)
    ridges = fbm(Q, 9.0, 6, SEED + 31, ridged=True)
    h = h + land * (ridges - 0.32) * 0.34
    # îles : de petits reliefs qui percent là où la mer est peu profonde
    isl = fbm(P, 26.0, 5, SEED + 57)
    h = h + np.clip(1 - np.abs(h - 0.47) * 22, 0, 1) * np.clip(isl, 0, 1) * 0.16
    moist = 0.5 + fbm(P, 3.1, 6, SEED + 77) * 1.25
    # nuages : des bancs étirés, enroulés par quelques dépressions
    C = P
    for centre, radius, turn in [((0.25, 0.18, 0.95), 0.1, 2.4), ((-0.42, -0.2, 0.88), 0.08, -2.2), ((0.05, -0.45, 0.89), 0.07, 2.0), ((-0.15, 0.5, 0.85), 0.09, -1.8), ((0.6, -0.1, 0.79), 0.08, 2.2)]:
        C = swirl(C, centre, radius, turn)
    cw = [fbm(C, 3.0, 3, SEED + 200 + 5 * i) for i in range(3)]
    C2 = [C[0] * 1.0 + 0.16 * cw[0], C[1] * 1.7 + 0.16 * cw[1], C[2] * 1.0 + 0.16 * cw[2]]  # étirés d'est en ouest
    cl = 0.43 + fbm(C2, 5.0, 7, SEED + 300) * 1.5 + fbm(C, 1.6, 3, SEED + 400) * 0.55
    return [np.clip(a, 0, 1) for a in (h, moist, cl)]


def grain(n=512):
    """Trois bruits indépendants, périodiques (ils se répètent bord à bord)."""
    out = []
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    for ch in range(3):
        rng = np.random.default_rng(SEED + 900 + ch)
        s, a, tot = np.zeros((n, n), np.float32), 1.0, 0.0
        for per in (8, 16, 32, 64, 128, 256):
            ang = rng.random((per, per), dtype=np.float32) * 2 * np.pi
            gx, gy = np.cos(ang), np.sin(ang)
            x, y = xx * per / n, yy * per / n
            xi, yi = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
            xf, yf = x - xi, y - yi
            u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)

            def c(dx, dy):
                i, j = (xi + dx) % per, (yi + dy) % per
                return gx[j, i] * (xf - dx) + gy[j, i] * (yf - dy)

            v0 = c(0, 0) + u * (c(1, 0) - c(0, 0)); v1 = c(0, 1) + u * (c(1, 1) - c(0, 1))
            val = v0 + v * (v1 - v0)
            if ch == 2:
                val = 0.35 - np.abs(val)  # bleu : bruit « en bourgeons », pour le bord des nuages
            s += a * val; tot += a; a *= 0.56
        s = (s - s.mean()) / s.std()
        out.append(np.clip(0.5 + s * 0.19, 0, 1))
    return out


def save(chans, path, q):
    Image.merge('RGB', [Image.fromarray((c * 255 + 0.5).astype(np.uint8)) for c in chans]).save(path, quality=q, subsampling=0, optimize=True)


if __name__ == '__main__':
    h, m, c = cartes()
    save([h, m, c], 'assets/space/alma.jpg', 90)
    save(grain(), 'assets/space/grain.jpg', 86)
    print('mer : %.0f %%   nuages > 0,6 : %.0f %%' % ((h < 0.5).mean() * 100, (c > 0.6).mean() * 100))
    if 'apercu' in sys.argv:
        sea = np.stack([0.02 + 0 * h, 0.2 + (h - 0.3) * 1.2, 0.3 + (h - 0.3) * 1.0], -1)
        dry, lush = np.array([0.6, 0.45, 0.3]), np.array([0.15, 0.4, 0.2])
        gr = dry + (lush - dry) * np.clip((m - 0.38) / 0.22, 0, 1)[..., None]
        gr = gr + (np.array([0.9, 0.92, 0.95]) - gr) * np.clip(((h - 0.5) * 2 - 0.55) / 0.13, 0, 1)[..., None]
        col = np.where((h < 0.5)[..., None], sea, gr)
        k = np.clip((c - 0.5) / 0.25, 0, 1)[..., None]
        col = col * (1 - k * 0.9) + k * 0.9
        Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).resize((1024, 768), Image.LANCZOS).save('tools/sources/alma-apercu.png')
