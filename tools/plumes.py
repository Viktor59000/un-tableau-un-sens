"""Relève les plumes de « Plume sur Rhodoïde » (Louis Cane, 1998) sur la photo de l'œuvre.

    python tools/plumes.py

Lit assets/works/ouie.jpg, isole chaque plume (tache colorée ou sombre sur le fond clair), puis écrit
app/plumes.js : une ligne par plume — position sur la feuille, angle, longueur, largeur, couleur, famille.
L'expérience redessine ensuite chaque plume à cet endroit, en haute définition (app/galerie.js).

Repère de sortie : la feuille mesure 1 × 1 (unités = côté de la feuille, 97,5 cm), origine au centre, y vers le haut.

Prérequis : pip install numpy pillow
"""
import colorsys
import json
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SRC = "assets/works/ouie.jpg"
OUT = "app/plumes.js"
# Bords de la feuille sur la photo (pixels) : le Rhodoïde occupe presque toute la largeur.
X0, X1, Y0 = 14, 604, -6
SIDE = X1 - X0

im = Image.open(SRC).convert("RGB")
W, H = im.size
rgb = np.asarray(im, dtype=np.float32) / 255.0
bg = np.asarray(im.filter(ImageFilter.GaussianBlur(28)), dtype=np.float32) / 255.0  # fond local (éclairage inégal)
mx, mn = rgb.max(2), rgb.min(2)
sat = (mx - mn) / np.maximum(mx, 1e-3)
lum = rgb @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
lbg = bg @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
dist = np.sqrt(((rgb - bg) ** 2).sum(2))  # écart au fond local : attrape aussi les plumes grises et pâles
mask = (sat > 0.2) | (lbg - lum > 0.2) | (dist > 0.105)
mask[:, :X0 + 4] = False
mask[:, X1 - 4:] = False

# composantes connexes (8-voisins), sans dépendance à scipy
lab = np.zeros((H, W), dtype=np.int32)
blobs = []
for y0 in range(H):
    for x0 in range(W):
        if not mask[y0, x0] or lab[y0, x0]:
            continue
        idx = len(blobs) + 1
        q = deque([(y0, x0)])
        lab[y0, x0] = idx
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = idx
                        q.append((yy, xx))
        blobs.append(np.array(pts))

out = []
for pts in blobs:
    if len(pts) < 34:
        continue
    ys, xs = pts[:, 0].astype(np.float64), pts[:, 1].astype(np.float64)
    cx, cy = xs.mean(), ys.mean()
    cov = np.cov(np.stack([xs - cx, ys - cy]))
    ev, evec = np.linalg.eigh(cov)
    major = evec[:, 1]
    length = 4.0 * np.sqrt(max(ev[1], 1e-6))
    width = 4.0 * np.sqrt(max(ev[0], 1e-6))
    if length > 150:  # deux plumes collées : on garde, mais bornées
        length = 150
    col = rgb[pts[:, 0], pts[:, 1]]
    s = sat[pts[:, 0], pts[:, 1]]
    w = s + 0.05
    c = (col * w[:, None]).sum(0) / w.sum()
    h, l, sv = colorsys.rgb_to_hls(*c)
    dark = float(lum[pts[:, 0], pts[:, 1]].mean()) < 0.42 and sv < 0.3
    if dark:
        c = (0.13, 0.13, 0.15)
    else:  # la photo est délavée : on redonne aux teintures leur saturation
        c = colorsys.hls_to_rgb(h, min(0.62, max(0.36, l * 0.92)), min(1.0, sv * 1.9 + 0.25))
    elong = length / max(width, 1.0)
    # familles : 0 plume à étendard, 1 duvet (touffe), 2 plume fine et courbe, 3 fil / barbe isolée
    if elong > 4.2 and width < 9:
        kind = 3
    elif elong < 1.7:
        kind = 1
    elif width < 13:
        kind = 2
    else:
        kind = 0
    ang = np.arctan2(-major[1], major[0])  # y de l'image vers le bas
    # la pointe est du côté le plus étroit : on compare la dispersion des deux moitiés le long du grand axe
    t = (xs - cx) * major[0] + (ys - cy) * major[1]
    n = (xs - cx) * -major[1] + (ys - cy) * major[0]
    if np.abs(n[t > 0]).mean() > np.abs(n[t < 0]).mean():
        ang += np.pi
    out.append([
        round((cx - X0) / SIDE - 0.5, 4), round(0.5 - (cy - Y0) / SIDE, 4), round(float(ang), 3),
        round(max(0.028, min(0.16, length / SIDE * 1.12)), 4), round(max(0.012, min(0.07, width / SIDE * 1.25)), 4),
        [round(float(v), 3) for v in c], kind,
    ])

out = [f for f in out if abs(f[0]) < 0.49 and abs(f[1]) < 0.49]
out.sort(key=lambda f: (-f[1], f[0]))
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("// Généré par tools/plumes.py à partir de assets/works/ouie.jpg — ne pas modifier à la main.\n")
    fh.write("// [x, y, angle, longueur, largeur, [r, v, b], famille] — unités : côté de la feuille (97,5 cm), origine au centre.\n")
    fh.write("export const PLUMES = [\n")
    for f in out:
        fh.write("  " + json.dumps(f, separators=(",", ":")) + ",\n")
    fh.write("];\n")
kinds = [sum(1 for f in out if f[6] == k) for k in range(4)]
print(len(out), "plumes ->", OUT, "| étendard, duvet, fine, fil :", kinds)
