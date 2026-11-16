"""Modélise ce qu'on voit de SPES-07 par le grand hublot, et la navette qui passe devant.

    blender -b --python tools/pont_blender.py            # écrit assets/models/pont.glb et navette.glb
    blender -b --python tools/pont_blender.py -- apercu  # écrit aussi tools/sources/pont-apercu.png et navette-apercu.png

« pont » : le pont avant de notre arche, qui file vers la proue en contrebas à droite du hublot (tablier de tôles, galerie
technique, conduites, mâts, plateforme d'appontage avec une navette posée) et une perche d'instruments au premier plan.
Repère Blender : x vers la droite, y vers l'avant (distance au mur des hublots), z vers le haut depuis le plancher de la baie,
en mètres. « navette » : nez vers +X, environ 12 m. Matières reprises par nom dans app/world.js : coque, clair, sombre,
panneau, moteur, feu_r, feu_v, feu_b, vitre.
"""
import math
import os
import random
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, R, export, move, preview, reset, rot  # noqa: E402

reset(707, {"coque": (0.6, 0.63, 0.66, 1), "clair": (0.82, 0.83, 0.82, 1), "sombre": (0.2, 0.22, 0.25, 1), "panneau": (0.06, 0.1, 0.2, 1), "moteur": (0.6, 0.85, 1, 1), "feu_r": (1, 0.2, 0.15, 1), "feu_v": (0.2, 0.9, 0.45, 1), "feu_b": (1, 1, 1, 1), "vitre": (1, 0.8, 0.5, 1)})


def navette(P):
    """Petit cargo de liaison : cabine, soute en conteneurs, deux nacelles."""
    P.box("clair", (6.6, 2.5, 2.0), (-0.4, 0, 0))
    P.box("coque", (5.2, 2.7, 0.5), (-0.6, 0, 1.05))
    P.cyl("clair", 1.42, 0.4, 3.6, (4.65, 0, -0.12), seg=8, rot=rot("X", math.pi / 8))
    P.box("vitre", (1.3, 1.5, 0.3), (3.3, 0, 0.9), rot("Y", 0.5))
    P.box("sombre", (0.5, 2.3, 0.75), (2.75, 0, 0.92))
    for s in (-1, 1):
        P.box("sombre", (4.4, 1.12, 1.0), (-0.7, s * 0.66, -1.45))  # conteneurs
        for dx in (-1.6, 0, 1.6):
            P.box("coque", (0.12, 1.16, 1.04), (-0.7 + dx, s * 0.66, -1.45))
        P.box("coque", (2.6, 1.3, 0.22), (-2.2, s * 1.75, 0.3))  # pylône
        P.cyl("sombre", 0.62, 0.62, 4.4, (-2.4, s * 2.55, 0.3), seg=12)
        P.cyl("coque", 0.68, 0.5, 0.7, (0.1, s * 2.55, 0.3), seg=12)
        P.cyl("sombre", 0.52, 0.7, 0.9, (-5.0, s * 2.55, 0.3), seg=12, caps=False)
        P.cyl("moteur", 0.5, 0.5, 0.04, (-4.75, s * 2.55, 0.3), seg=12)
        P.box("panneau", (2.2, 0.06, 1.3), (-1.4, s * 1.28, 0.1))
        P.sphere("feu_r" if s < 0 else "feu_v", 0.11, (0.5, s * 3.2, 0.3), seg=6)
        P.box("sombre", (0.5, 0.5, 0.3), (1.2, s * 1.0, -1.1))
    P.box("coque", (1.9, 0.14, 1.5), (-2.9, 0, 1.75), rot("Y", -0.35))
    P.sphere("feu_b", 0.1, (-3.4, 0, 2.6), seg=6)
    P.cyl("sombre", 0.03, 0.02, 1.6, (1.5, 0.6, 1.9), axis="Z", seg=5)
    P.cyl("sombre", 0.4, 0.55, 0.7, (-4.0, 0, 0), seg=10, caps=False)
    P.cyl("moteur", 0.38, 0.38, 0.04, (-3.85, 0, 0), seg=10)
    for i in range(26):  # petits volumes de surface
        P.box("coque" if i % 3 else "sombre", (R(0.3, 1.1), R(0.2, 0.7), R(0.06, 0.16)), (R(-3.2, 2.2), R(-1.0, 1.0), 1.33))


# ============ la navette seule ============
N = Parts()
navette(N)
nav = N.to_object("navette")
preview("navette-apercu.png", (13, -15, 7), (0, 0, 0), lens=55, res=(1100, 620))
export([nav], "navette.glb")
nav.hide_render = True

# ============ le pont avant ============
D = Parts()
LEN, TOP = 196.0, -3.3
xl = lambda d: 1.2 + 0.078 * d  # bord gauche : il s'écarte pour laisser la Terre dégagée
xr = lambda d: xl(d) + (33.0 + 0.02 * d) * (1.0 if d < 150 else max(0.04, 1 - ((d - 150) / 46) ** 2))  # bord droit, qui se referme en proue
zt = lambda d, u: TOP - 1.5 * (2 * u - 1) ** 4 - 0.00006 * d * d  # dessus légèrement bombé, qui plonge vers la proue
at = lambda d, u, h=0.0: Vector((xl(d) + (xr(d) - xl(d)) * u, d, zt(d, u) + h))

ROWS, COLS = 58, 12
D.grid("coque", [[at(1.0 + (LEN - 1.0) * i / ROWS, j / COLS) for j in range(COLS + 1)] for i in range(ROWS + 1)], plates=0.16, share=0.6)
D.grid("sombre", [[at(1.0 + (LEN - 1.0) * i / ROWS, 0) + Vector((0.9 * k, 0, -4.5 * k)) - Vector((0, 0, 0.02)) for k in range(4)] for i in range(ROWS + 1)], plates=0.12)  # flanc gauche
for d in range(8, 190, 13):  # couples : des nervures en travers du tablier
    D.grid("sombre", [[at(d + e, j / COLS, 0.22 if 0 < j < COLS else -0.1) for j in range(COLS + 1)] for e in (0, 0.5)])

# galerie technique le long du pont, avec ses rangées de hublots tournées vers nous
d = 9.0
while d < 172:
    ln, w, h, u = R(6, 15), R(2.4, 4.2), R(0.9, 2.4), 0.46 + R(-0.03, 0.03)
    c = at(d + ln / 2, u)
    D.box("coque", (w, ln, h), c + Vector((0, 0, h / 2)))
    D.box("sombre", (w * 0.6, ln * 0.7, 0.3), c + Vector((0, 0, h + 0.15)))
    if h > 1.3:
        for k in range(int(ln / 1.1)):
            if random.random() < 0.7:
                D.box("vitre", (0.06, 0.6, 0.26), c + Vector((-w / 2 - 0.02, -ln / 2 + 0.8 + k * 1.1, h * 0.62)))
    d += ln + R(0.6, 5)
# accastillage : un millier de petits volumes, pour l'échelle
for _ in range(1000):
    d, u = R(4, 186), R(0.03, 0.97)
    s = (R(0.3, 2.8), R(0.3, 3.4), R(0.08, 0.75))
    D.box(random.choice(("coque", "coque", "sombre", "clair")), s, at(d, u, s[2] / 2 - 0.03))
# conduites
for _ in range(11):
    u, d0, ln, r = R(0.06, 0.94), R(4, 90), R(25, 95), R(0.1, 0.24)
    d1 = min(d0 + ln, 184)
    n = max(2, int((d1 - d0) / 6))
    pts = [at(d0 + (d1 - d0) * i / n, u, 0.42) for i in range(n + 1)]
    for a, b in zip(pts, pts[1:]):
        D.rod("clair" if r > 0.17 else "sombre", a, b, r, seg=7)
        D.box("sombre", (r * 3.2, 0.2, 0.44), a - Vector((0, 0, 0.2)))
# mâts : fût, vergues, coffrets, feu rouge en tête
for d, u, h in ((30, 0.2, 9), (66, 0.62, 17), (104, 0.28, 12), (142, 0.55, 15), (176, 0.5, 8)):
    b = at(d, u)
    D.box("sombre", (1.6, 1.6, 0.9), b + Vector((0, 0, 0.45)))
    D.cyl("coque", 0.28, 0.12, h, b + Vector((0, 0, h / 2)), axis="Z", seg=8)
    for k in (0.45, 0.7, 0.88):
        D.box("sombre", (h * 0.26 * (1.2 - k), 0.08, 0.08), b + Vector((0, 0, h * k)))
        D.box("clair", (0.5, 0.36, 0.3), b + Vector((h * 0.12 * (1.2 - k), 0, h * k + 0.12)))
    for a in (0.6, 2.7, 4.8):
        D.rod("sombre", b + Vector((math.cos(a) * 2.6, math.sin(a) * 2.6, 0.1)), b + Vector((0, 0, h * 0.62)), 0.03, seg=4)  # haubans
    D.sphere("feu_r", 0.2, b + Vector((0, 0, h + 0.2)), seg=6)
# parabole sur le deuxième mât, coupole d'observation
b = at(66, 0.62)
D.M = move(b.x + 1.2, b.y, b.z + 10.5) @ rot("Y", 0.9) @ rot("Z", -0.6)
D.lathe("clair", [(0, 0.0), (0.12, 1.1), (0.5, 2.1), (1.15, 2.8)], seg=20, axis="Z")
D.cyl("sombre", 0.05, 0.05, 1.5, (0, 0, 0.75), axis="Z", seg=5)
b = at(88, 0.8)
D.M = move(b.x, b.y, b.z)
D.cyl("coque", 3.2, 3.0, 1.2, (0, 0, 0.6), axis="Z", seg=18)
D.sphere("clair", 2.9, (0, 0, 1.2), scale=(1, 1, 0.55), seg=18)
for i in range(18):
    if i % 3:
        a = i * math.pi / 9
        D.box("vitre", (0.5, 0.06, 0.3), (math.cos(a) * 3.14, math.sin(a) * 3.14, 0.75), rot("Z", a + math.pi / 2))
# plateforme d'appontage : dalle octogonale, balises, navette posée
b = at(47, 0.72)
D.M = move(b.x, b.y, b.z)
D.cyl("sombre", 7.6, 7.9, 0.5, (0, 0, 0.25), axis="Z", seg=8)
D.cyl("clair", 7.0, 7.0, 0.06, (0, 0, 0.53), axis="Z", seg=8)
D.cyl("sombre", 5.2, 5.2, 0.07, (0, 0, 0.535), axis="Z", seg=24)
for i in range(8):
    a = i * math.pi / 4 + math.pi / 8
    D.sphere("feu_b" if i % 2 else "feu_v", 0.16, (math.cos(a) * 7.1, math.sin(a) * 7.1, 0.62), seg=6)
D.box("coque", (2.2, 3.4, 1.8), (-9.2, 1.5, 0.9))
D.box("vitre", (0.06, 2.4, 0.4), (-10.32, 1.5, 1.2))
D.M = move(b.x, b.y, b.z + 2.6) @ rot("Z", 2.2)
navette(D)
for s in (-1, 1):  # patins
    D.rod("sombre", (1.6, s * 1.2, -1.9), (2.0, s * 1.5, -2.05), 0.08)
    D.rod("sombre", (-2.6, s * 1.2, -1.9), (-3.0, s * 1.5, -2.05), 0.08)
D.M = move(0, 0, 0)

# perche d'instruments au premier plan : elle sort de la coque à droite du hublot et pointe vers l'avant
A, B = Vector((3.3, 0.5, 0.9)), Vector((5.0, 9.6, 3.3))
ax = (B - A).normalized()
side = ax.cross(Vector((0, 0, 1))).normalized()
up = side.cross(ax)
corner = lambda t, k: A + (B - A) * t + (side * math.cos(k * 2.094) + up * math.sin(k * 2.094)) * 0.2
SEG = 12
for i in range(SEG):
    for k in range(3):
        D.rod("coque", corner(i / SEG, k), corner((i + 1) / SEG, k), 0.022)
        D.rod("sombre", corner(i / SEG, k), corner((i + 1) / SEG, k + 1), 0.012, seg=4)
        D.rod("sombre", corner(i / SEG, k), corner(i / SEG, k + 1), 0.012, seg=4)
D.rod("clair", A + up * 0.02, B, 0.035)
D.M = move(*B) @ ax.to_track_quat("Y", "Z").to_matrix().to_4x4()
D.box("coque", (0.5, 0.42, 0.4), (0, 0.2, 0))
D.box("sombre", (0.3, 0.5, 0.22), (0, 0.6, 0.02))
D.cyl("sombre", 0.09, 0.12, 0.34, (0.16, 0.9, 0), axis="Y", seg=10)
D.cyl("vitre", 0.085, 0.085, 0.01, (0.16, 1.075, 0), axis="Y", seg=10)
D.box("panneau", (0.9, 0.02, 0.5), (-0.72, 0.15, 0))
D.box("panneau", (0.9, 0.02, 0.5), (0.72, 0.15, 0))
D.cyl("sombre", 0.008, 0.004, 0.9, (-0.1, 0.3, 0.6), axis="Z", seg=4)
D.sphere("feu_r", 0.035, (-0.1, 0.3, 1.06), seg=6)
D.M = move(0, 0, 0)
D.box("sombre", (0.9, 0.9, 0.6), A - ax * 0.3)

deck = D.to_object("pont")
preview("pont-apercu.png", (-14, -12, 9), (16, 60, -3), lens=30, res=(1500, 760))
export([deck], "pont.glb")
