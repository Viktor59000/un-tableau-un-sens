"""Modélise la baie cryogénique C du pont 12 et ses caissons de stase.

    blender -b --python tools/baie_blender.py            # écrit assets/models/baie.glb et caisson.glb
    blender -b --python tools/baie_blender.py -- apercu  # écrit aussi tools/sources/baie-apercu.png et caisson-apercu.png

La baie est faite de pièces répétées, que app/world.js pose tous les 2,6 m le long de la coque :
  « travee » : 2,6 m de baie (sol en plaques, caniveau grillagé, alcôve technique derrière chaque caisson avec réservoirs,
               pupitre et rampe lumineuse, pan coupé et ses conduites, plafond à gaines) ;
  « couple »  : un couple de structure (montants, jambes de force, poutre de plafond) ;
  « avant »   : les 2 m sans alcôve, entre le mur des hublots et le premier couple ;
  « fond »    : la cloison du fond et sa porte étanche.
Le caisson : « caisson » (socle, flancs, lit, bloc de tête, pupitre de pied) et « capot » (armature de la verrière, origine
sur sa charnière ; le verre et le givre restent dessinés par le décor).
Cotes du décor : x en travers (murs à ±5,5), y vers le haut (plafond à 5), z le long de la baie, en mètres. Pour le caisson :
x dans la longueur (tête vers -x), z en travers. Les matières ne portent qu'un nom, repris dans app/world.js.
"""
import math
import os
import random
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, R, export, preview, reset, rot  # noqa: E402

COL = {"sol": (0.3, 0.32, 0.34, 1), "passerelle": (0.5, 0.52, 0.54, 1), "paroi": (0.36, 0.4, 0.45, 1), "structure": (0.14, 0.16, 0.19, 1), "panneau": (0.2, 0.23, 0.27, 1), "sombre": (0.05, 0.06, 0.07, 1),
       "acier": (0.75, 0.77, 0.8, 1), "cuivre": (0.55, 0.35, 0.2, 1), "givre": (0.75, 0.83, 0.88, 1), "lueur": (0.6, 0.8, 1, 1), "lueur_c": (0.3, 0.9, 1, 1), "ambre": (1, 0.7, 0.2, 1), "rouge": (0.8, 0.15, 0.1, 1),
       "jaune": (0.75, 0.55, 0.1, 1), "ecran": (0.15, 0.5, 0.6, 1), "coque": (0.17, 0.2, 0.23, 1), "matelas": (0.1, 0.12, 0.15, 1), "verre": (0.7, 0.9, 0.95, 1)}
reset(1212, COL)
M3 = rot("X", math.pi / 2)  # repère du décor (y vers le haut) -> repère de Blender (z vers le haut)
G = 0.012  # joint entre deux plaques
PI = math.pi


def new():
    P = Parts()
    P.M = M3
    return P


def B(P, mat, x0, x1, y0, y1, z0, z1, r=None):
    """Boîte donnée par ses deux coins."""
    P.box(mat, (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), r)


def plates(P, mat, xs, zs, y0, y1):
    """Dallage : une plaque par case, avec un joint creux."""
    for xa, xb in zip(xs, xs[1:]):
        for za, zb in zip(zs, zs[1:]):
            B(P, mat, xa + G, xb - G, y0, y1, za + G, zb - G)


def section(P, L, alcove):
    """Une longueur L de baie : sol, parois, pan coupé, plafond. alcove : avec la niche technique derrière le caisson."""
    zs = [0, L / 2, L]
    # passerelle centrale et ses rives
    plates(P, "passerelle", [-1.15, 0, 1.15], zs, 0.0, 0.03)
    B(P, "sombre", -1.25, 1.25, -0.03, 0.012, 0, L)
    for s in (-1, 1):
        B(P, "structure", s * 1.17, s * 1.23, 0, 0.045, 0, L)
        # sol latéral, caniveau grillagé et sa conduite
        plates(P, "sol", [s * 1.3, s * 1.95], zs, -0.02, 0.0)
        plates(P, "sol", [s * 2.25, s * 3.3, s * 4.4, s * 5.5], zs, -0.02, 0.0)
        B(P, "sombre", s * 1.25, s * 5.5, -0.035, -0.012, 0, L)
        B(P, "sombre", s * 1.95, s * 2.25, -0.11, -0.08, 0, L)
        z = 0.06
        while z < L - 0.04:
            B(P, "structure", s * 1.96, s * 2.24, -0.02, 0.0, z, z + 0.045)
            z += 0.18
        P.rod("cuivre", (s * 2.1, -0.05, 0), (s * 2.1, -0.05, L), 0.035, seg=8)
        # pan coupé à 45° entre la paroi et le plafond, avec trois conduites et un chemin de câbles
        for za, zb in zip(zs, zs[1:]):
            P.box("paroi", (2.121 - 2 * G, 0.05, zb - za - 2 * G), (s * 4.78, 4.28, (za + zb) / 2), rot("Z", -s * PI / 4))
        slope = lambda t, off: (s * (5.5 - 1.5 * t - off * 0.707), 3.5 + 1.5 * t - off * 0.707)
        for t, off, mat, r in ((0.22, 0.13, "acier", 0.06), (0.4, 0.1, "cuivre", 0.035), (0.6, 0.15, "sombre", 0.085)):
            x, y = slope(t, off)
            P.rod(mat, (x, y, 0), (x, y, L), r, seg=10)
            P.box("structure", (0.05, off + 0.04, 0.06), (x + s * off * 0.35, y + off * 0.35, L / 2), rot("Z", -s * PI / 4 + PI / 2))
        x, y = slope(0.86, 0.07)
        P.box("sombre", (0.3, 0.04, L), (x, y, L / 2), rot("Z", -s * PI / 4))
        for k in (-1, 1):
            xx, yy = slope(0.86 + k * 0.1, 0.1)
            P.box("structure", (0.02, 0.08, L), (xx, yy, L / 2), rot("Z", -s * PI / 4))
        # paroi
        if alcove:
            for ya, yb in ((0, 1.5), (1.5, 3.0)):  # fond de la niche
                for za, zb in ((0.3, 1.3), (1.3, 2.3)):
                    B(P, "paroi", s * 5.93, s * 5.98, ya + G, yb - G, za + G, zb - G)
            B(P, "sombre", s * 5.97, s * 6.0, 0, 3.0, 0.24, 2.36)
            for z0, z1 in ((0.0, 0.3), (2.3, 2.6)):  # joues de la niche, jusqu'aux couples
                B(P, "paroi", s * 5.5, s * 5.98, 0, 3.02, z0, z1)
            B(P, "panneau", s * 5.44, s * 5.98, 3.0, 3.06, 0.24, 2.36)
            B(P, "sombre", s * 5.5, s * 5.98, -0.02, 0.02, 0.3, 2.3)
            # linteau : caisson technique, ouïes, rampe lumineuse qui baigne la niche
            B(P, "panneau", s * 5.3, s * 5.6, 3.06, 3.5, 0.0, 2.6)
            for i in range(7):
                B(P, "sombre", s * 5.285, s * 5.3, 3.14 + i * 0.045, 3.165 + i * 0.045, 0.5, 1.2)
            B(P, "structure", s * 5.285, s * 5.3, 3.16, 3.4, 1.5, 2.2)
            B(P, "ambre", s * 5.28, s * 5.285, 3.33, 3.36, 2.05, 2.12)
            B(P, "lueur", s * 5.64, s * 5.7, 2.965, 2.995, 0.45, 2.15)
            # deux réservoirs de cryogène givrés, leurs vannes et leurs tubes
            for zc in (0.72, 1.16):
                P.cyl("sombre", 0.22, 0.22, 0.2, (s * 5.7, 0.1, zc), axis="Y", seg=18)
                P.cyl("givre", 0.19, 0.19, 1.45, (s * 5.7, 0.93, zc), axis="Y", seg=18)
                P.sphere("givre", 0.19, (s * 5.7, 1.655, zc), scale=(1, 0.5, 1), seg=18)
                for y in (0.45, 1.25):
                    P.cyl("acier", 0.2, 0.2, 0.04, (s * 5.7, y, zc), axis="Y", seg=18)
                P.cyl("acier", 0.04, 0.04, 0.2, (s * 5.7, 1.84, zc), axis="Y", seg=10)
                P.cyl("rouge", 0.07, 0.07, 0.02, (s * 5.62, 1.9, zc), axis="X", seg=12)
                P.rod("acier", (s * 5.7, 1.9, zc), (s * 5.62, 1.9, zc), 0.012)
                P.rod("cuivre", (s * 5.7, 1.94, zc), (s * 5.7, 2.5, zc), 0.028, seg=8)
                P.rod("cuivre", (s * 5.7, 2.5, zc), (s * 5.82, 3.0, zc), 0.028, seg=8)
                P.sphere("cuivre", 0.03, (s * 5.7, 2.5, zc), seg=8)
            P.rod("acier", (s * 5.7, 0.45, 0.72), (s * 5.7, 0.45, 1.16), 0.02)
            # pupitre mural, écran, clavier, flexibles
            B(P, "panneau", s * 5.72, s * 5.93, 0.9, 1.78, 1.55, 2.17)
            B(P, "ecran", s * 5.705, s * 5.72, 1.3, 1.68, 1.62, 2.1)
            B(P, "sombre", s * 5.69, s * 5.72, 1.0, 1.2, 1.65, 2.07)
            for i in range(4):
                B(P, "structure", s * 5.685, s * 5.69, 1.03, 1.17, 1.69 + i * 0.095, 1.75 + i * 0.095)
            B(P, "ambre", s * 5.7, s * 5.72, 1.225, 1.255, 1.63, 1.7)
            for zc in (1.7, 1.95):
                P.rod("sombre", (s * 5.82, 0.9, zc), (s * 5.84, 0.3, zc + 0.08), 0.03, seg=8)
                P.rod("sombre", (s * 5.84, 0.3, zc + 0.08), (s * 5.7, 0.04, zc + 0.12), 0.03, seg=8)
            P.cyl("rouge", 0.07, 0.07, 0.42, (s * 5.86, 0.42, 2.2), axis="Y", seg=12)
            P.cyl("acier", 0.03, 0.03, 0.08, (s * 5.86, 0.67, 2.2), axis="Y", seg=8)
            # conduit au sol vers la tête du caisson
            B(P, "sombre", s * 4.7, s * 5.6, 0.0, 0.07, 1.2, 1.4)
            for x in (4.9, 5.3):
                B(P, "structure", s * (x - 0.03), s * (x + 0.03), 0.0, 0.085, 1.17, 1.43)
        else:
            for ya, yb in ((0, 1.75), (1.75, 3.5)):
                for za, zb in zip(zs, zs[1:]):
                    B(P, "paroi", s * 5.5, s * 5.56, ya + G, yb - G, za + G, zb - G)
            B(P, "sombre", s * 5.54, s * 5.6, 0, 3.5, 0, L)
            B(P, "structure", s * 5.44, s * 5.5, 1.02, 1.1, 0, L)  # main courante
            B(P, "panneau", s * 5.36, s * 5.5, 1.5, 2.3, L * 0.3, L * 0.3 + 0.5)
            B(P, "rouge", s * 5.35, s * 5.36, 1.62, 1.74, L * 0.3 + 0.08, L * 0.3 + 0.2)
            B(P, "lueur", s * 5.35, s * 5.36, 2.0, 2.2, L * 0.3 + 0.1, L * 0.3 + 0.4)
    # plafond : dalles, chemin de câbles central, deux gaines, bouches et spots encastrés
    plates(P, "panneau", [-4.0, -2.0, 0, 2.0, 4.0], zs, 5.0, 5.04)
    B(P, "sombre", -4.1, 4.1, 5.03, 5.06, 0, L)
    B(P, "sombre", -0.5, 0.5, 4.84, 4.9, 0, L)
    z = 0.2
    while z < L:
        B(P, "structure", -0.52, 0.52, 4.83, 4.95, z, z + 0.03)
        z += 0.43
    for x, mat, r in ((-0.3, "sombre", 0.03), (-0.12, "cuivre", 0.022), (0.05, "sombre", 0.035), (0.26, "sombre", 0.025)):
        P.rod(mat, (x, 4.925, 0), (x, 4.925, L), r, seg=6)
    for s in (-1, 1):
        P.cyl("structure", 0.2, 0.2, L, (s * 3.1, 4.76, L / 2), axis="Z", seg=14)
        P.cyl("sombre", 0.225, 0.225, 0.05, (s * 3.1, 4.76, L / 2), axis="Z", seg=14)
        B(P, "structure", s * 3.08, s * 3.12, 4.95, 5.0, L / 2 - 0.15, L / 2 + 0.15)
        B(P, "sombre", s * 1.2, s * 1.9, 4.97, 5.0, L * 0.25, L * 0.25 + 0.5)
        for i in range(5):
            B(P, "structure", s * 1.22, s * 1.88, 4.96, 4.972, L * 0.25 + 0.05 + i * 0.1, L * 0.25 + 0.08 + i * 0.1)
        B(P, "lueur", s * 1.4, s * 1.6, 4.985, 5.0, L * 0.7, L * 0.7 + 0.2)


# ============ une travée ============
T = new()
section(T, 2.6, True)
travee = T.to_object("travee", sharp=40)

# ============ un couple de structure (à z = 0) ============
C = new()
for s in (-1, 1):
    B(C, "sombre", s * 4.85, s * 5.5, 0, 0.3, -0.3, 0.3)
    B(C, "jaune", s * 4.84, s * 4.85, 0.04, 0.26, -0.26, 0.26)
    B(C, "structure", s * 4.97, s * 5.03, 0.3, 3.3, -0.225, 0.225)
    B(C, "structure", s * 5.03, s * 5.5, 0.3, 3.5, -0.035, 0.035)
    for y in (1.0, 1.8, 2.6):
        B(C, "structure", s * 5.03, s * 5.5, y, y + 0.04, -0.2, 0.2)
    B(C, "lueur", s * 4.955, s * 4.97, 1.55, 3.0, -0.035, 0.035)
    C.box("structure", (1.95, 0.06, 0.45), (s * 4.325, 3.975, 0), rot("Z", -s * PI / 4))  # jambe de force
    C.box("structure", (1.95, 0.5, 0.07), (s * 4.5, 4.15, 0), rot("Z", -s * PI / 4))
    B(C, "sombre", s * 4.88, s * 5.12, 3.18, 3.46, -0.245, 0.245)
    B(C, "sombre", s * 3.5, s * 3.82, 4.52, 4.76, -0.245, 0.245)
    for y, z in ((3.24, -0.18), (3.24, 0.18), (3.4, -0.18), (3.4, 0.18)):
        C.cyl("acier", 0.018, 0.018, 0.02, (s * 4.875, y, z), axis="X", seg=6)
B(C, "structure", -3.65, 3.65, 4.62, 4.68, -0.225, 0.225)  # poutre de plafond
B(C, "structure", -3.65, 3.65, 4.68, 5.0, -0.035, 0.035)
x = -3.2
while x < 3.3:
    B(C, "structure", x - 0.02, x + 0.02, 4.68, 5.0, -0.2, 0.2)
    x += 0.8
B(C, "sombre", -1.36, 1.36, 4.56, 4.62, -0.13, 0.13)  # boîtier de la rampe lumineuse
B(C, "structure", -5.5, 5.5, -0.012, 0.01, -0.07, 0.07)
couple = C.to_object("couple", sharp=40)

# ============ les deux mètres devant le mur des hublots ============
A = new()
section(A, 2.0, False)
avant = A.to_object("avant", sharp=40)

# ============ la cloison du fond et sa porte étanche (face visible : -z) ============
F = new()
for ya, yb in ((0, 1.7), (1.7, 3.5), (3.5, 5.0)):
    for xa, xb in ((-5.5, -3.2), (-3.2, -1.62), (-1.62, 0), (0, 1.62), (1.62, 3.2), (3.2, 5.5)):
        if abs(xa + xb) / 2 < 1.62 and yb <= 3.5:
            continue  # baie de la porte
        B(F, "paroi", xa + G, xb - G, ya + G, yb - G, -0.06, 0)
B(F, "sombre", -5.5, 5.5, 0, 5.0, 0, 0.08)
for s in (-1, 1):
    B(F, "structure", s * 1.3, s * 1.62, 0, 3.72, -0.22, 0)  # huisserie
    B(F, "jaune", s * 1.3, s * 1.62, 0, 0.5, -0.225, -0.22)
    B(F, "panneau", s * 0.015, s * 1.3, 0.02, 3.4, -0.13, -0.04)  # vantail
    B(F, "sombre", s * 0.2, s * 1.1, 0.4, 1.5, -0.14, -0.13)
    B(F, "sombre", s * 0.2, s * 1.1, 2.75, 3.2, -0.14, -0.13)
    B(F, "lueur", s * 0.35, s * 0.95, 1.95, 2.35, -0.137, -0.13)
    B(F, "structure", s * 0.3, s * 1.0, 1.88, 2.42, -0.133, -0.128)
    for i in range(5):
        F.box("jaune", (0.5, 0.07, 0.006), (s * (0.3 + i * 0.2), 0.2, -0.133), rot("Z", s * 0.9))
    F.cyl("acier", 0.05, 0.05, 0.3, (s * 1.2, 1.7, -0.17), axis="Y", seg=10)  # vérins de verrouillage
    F.rod("acier", (s * 1.2, 1.7, -0.17), (s * 1.42, 1.7, -0.2), 0.02)
    # armoires à gauche, réservoir couché à droite
    if s < 0:
        for i in range(3):
            B(F, "panneau", -4.9 + i * 0.86, -4.1 + i * 0.86, 0, 2.3, -0.5, 0)
            B(F, "sombre", -4.84 + i * 0.86, -4.16 + i * 0.86, 0.15, 2.15, -0.51, -0.5)
            B(F, "acier", -4.24 + i * 0.86, -4.21 + i * 0.86, 1.0, 1.3, -0.53, -0.51)
            B(F, "ambre", -4.8 + i * 0.86, -4.74 + i * 0.86, 2.02, 2.06, -0.515, -0.51)
    else:
        F.cyl("givre", 0.48, 0.48, 2.0, (3.7, 0.72, -0.62), axis="X", seg=20)
        for x in (2.7, 4.7):
            F.sphere("givre", 0.48, (x, 0.72, -0.62), scale=(0.45, 1, 1), seg=20)
        for x in (3.0, 3.7, 4.4):
            F.cyl("acier", 0.5, 0.5, 0.06, (x, 0.72, -0.62), axis="X", seg=20)
            B(F, "sombre", x - 0.08, x + 0.08, 0, 0.3, -1.05, -0.2)
        F.rod("cuivre", (3.7, 1.2, -0.62), (3.7, 2.6, -0.3), 0.04, seg=8)
        F.rod("cuivre", (3.7, 2.6, -0.3), (3.7, 4.2, -0.12), 0.04, seg=8)
        F.cyl("rouge", 0.1, 0.1, 0.03, (3.7, 1.35, -0.72), axis="Z", seg=12)
B(F, "structure", -1.62, 1.62, 3.4, 3.72, -0.22, 0)
B(F, "sombre", -1.2, 1.2, 3.86, 4.3, -0.1, 0)  # enseigne
B(F, "rouge", -0.006, 0.006, 0.02, 3.4, -0.135, -0.13)
fond = F.to_object("fond", sharp=40)

preview("baie-apercu.png", (0.6, -4.0, 1.75), (-3.2, 2.2, 1.6), lens=18, res=(1500, 800))
export([travee, couple, avant, fond], "baie.glb")
for o in (travee, couple, avant, fond):
    o.hide_render = True

# ============ le caisson de stase ============
K = new()
B(K, "sombre", -1.15, 1.15, 0, 0.1, -0.45, 0.45)
for s in (-1, 1):
    B(K, "lueur_c", -1.1, 1.1, 0.035, 0.055, s * 0.452, s * 0.462)
B(K, "coque", -1.2, 1.2, 0.1, 0.32, -0.49, 0.49)
B(K, "coque", -1.25, 1.25, 0.3, 0.62, -0.525, 0.525)
B(K, "panneau", -1.2, 1.2, 0.6, 0.665, -0.525, 0.525)
B(K, "sombre", -1.1, 1.1, 0.645, 0.675, -0.42, 0.42)
for xa, xb in ((-1.06, -0.46), (-0.44, 0.3), (0.32, 1.06)):
    B(K, "matelas", xa, xb, 0.67, 0.722, -0.37, 0.37)
for s in (-1, 1):
    K.rod("acier", (-1.1, 0.685, s * 0.5), (1.1, 0.685, s * 0.5), 0.02, seg=8)
    B(K, "lueur_c", -1.0, 1.0, 0.70, 0.722, s * 0.425, s * 0.44)
    # flanc : ouïes, trappe de visite et sa poignée, conduite de cryogène, boulons
    B(K, "sombre", -0.95, 0.25, 0.35, 0.57, s * 0.52, s * 0.531)
    for i in range(10):
        K.box("structure", (0.07, 0.19, 0.014), (-0.88 + i * 0.12, 0.46, s * 0.533), rot("Y", s * 0.5))
    B(K, "panneau", 0.42, 1.08, 0.35, 0.57, s * 0.52, s * 0.536)
    K.rod("acier", (0.55, 0.46, s * 0.556), (0.95, 0.46, s * 0.556), 0.012)
    for x in (0.55, 0.95):
        K.rod("acier", (x, 0.46, s * 0.536), (x, 0.46, s * 0.556), 0.012)
    K.rod("cuivre", (-1.12, 0.2, s * 0.505), (1.12, 0.2, s * 0.505), 0.026, seg=8)
    for x in (-0.9, -0.3, 0.3, 0.9):
        B(K, "structure", x - 0.025, x + 0.025, 0.15, 0.25, s * 0.49, s * 0.54)
    for x in (-1.17, -0.4, 0.38, 1.17):
        K.cyl("acier", 0.014, 0.014, 0.012, (x, 0.585, s * 0.527), axis="Z", seg=6)
    B(K, "jaune", 0.44, 0.6, 0.12, 0.17, s * 0.49, s * 0.493)
# bloc de tête : assistance vitale, deux bouteilles, ouïes, prises des câbles
B(K, "panneau", -1.48, -1.12, 0.1, 1.05, -0.525, 0.525)
B(K, "coque", -1.5, -1.1, 0.1, 0.34, -0.54, 0.54)
for s in (-1, 1):
    K.cyl("givre", 0.085, 0.085, 0.42, (-1.3, 1.135, s * 0.25), axis="Z", seg=14)
    K.cyl("acier", 0.09, 0.09, 0.03, (-1.3, 1.135, s * 0.25), axis="Z", seg=14)
    K.sphere("givre", 0.085, (-1.3, 1.135, s * 0.25 + s * 0.21), scale=(1, 1, 0.5), seg=12)
    B(K, "sombre", -1.4, -1.2, 1.045, 1.075, s * 0.12, s * 0.38)
B(K, "sombre", -1.5, -1.4, 0.85, 1.06, -0.12, 0.42)
for i in range(6):
    B(K, "structure", -1.49, -1.48, 0.42 + i * 0.06, 0.45 + i * 0.06, -0.4, 0.4)
B(K, "ecran", -1.125, -1.115, 0.74, 0.98, -0.3, 0.3)
B(K, "ambre", -1.3, -1.26, 1.05, 1.058, -0.03, 0.03)
# pupitre de pied, côté allée : cadre d'écran, clavier, barre d'appui, marchepied
B(K, "panneau", 1.12, 1.4, 0.1, 0.86, -0.525, 0.525)
B(K, "coque", 1.1, 1.42, 0.1, 0.34, -0.54, 0.54)
B(K, "sombre", 1.395, 1.412, 0.5, 0.75, -0.34, 0.34)
B(K, "structure", 1.4, 1.416, 0.38, 0.46, -0.3, 0.1)
for i in range(5):
    B(K, "sombre", 1.414, 1.42, 0.395, 0.445, -0.28 + i * 0.075, -0.225 + i * 0.075)
B(K, "ambre", 1.412, 1.418, 0.4, 0.44, 0.18, 0.24)
B(K, "rouge", 1.412, 1.418, 0.4, 0.44, 0.27, 0.33)
K.rod("structure", (1.47, 0.9, -0.36), (1.47, 0.9, 0.36), 0.018, seg=8)
for s in (-1, 1):
    K.rod("structure", (1.38, 0.84, s * 0.36), (1.47, 0.9, s * 0.36), 0.018, seg=8)
    B(K, "sombre", 1.39, 1.405, 0.14, 0.3, s * 0.15, s * 0.45)
B(K, "structure", 1.4, 1.62, 0.0, 0.12, -0.4, 0.4)
for i in range(4):
    B(K, "acier", 1.43 + i * 0.05, 1.45 + i * 0.05, 0.12, 0.128, -0.38, 0.38)
K.bevel("coque", 0.03, 3)
K.bevel("panneau", 0.012, 2)
K.bevel("matelas", 0.016, 2)
pod = K.to_object("caisson", sharp=40)

# armature de la verrière : arceaux, flasques vitrés, longerons, charnières, poignée
L = new()
arc = lambda x, a, r=0.52: Vector((x, 0.66 + math.sin(a) * r, math.cos(a) * r))
for x in (-1.09, 0.0, 1.09):
    for i in range(14):
        L.rod("structure", arc(x, PI * i / 14), arc(x, PI * (i + 1) / 14), 0.024 if x else 0.016, seg=6)
for x in (-1.1, 1.1):
    L.cyl("verre", 0.505, 0.505, 0.012, (x, 0.66, 0), seg=28)
L.rod("structure", (-1.09, 1.18, 0), (1.09, 1.18, 0), 0.016, seg=6)
for s in (-1, 1):
    L.rod("structure", (-1.09, 0.672, s * 0.518), (1.09, 0.672, s * 0.518), 0.017, seg=6)
    L.rod("structure", arc(-1.09, PI / 2 + s * 0.9), arc(1.09, PI / 2 + s * 0.9), 0.009, seg=5)
for x in (-0.8, 0.0, 0.8):
    L.cyl("acier", 0.03, 0.03, 0.14, (x, 0.66, -0.52), seg=10)
B(L, "acier", -0.16, 0.16, 0.7, 0.73, 0.535, 0.565)
for x in (-0.16, 0.16):
    B(L, "acier", x - 0.012, x + 0.012, 0.7, 0.73, 0.52, 0.565)
B(L, "ambre", -0.03, 0.03, 0.76, 0.775, 0.523, 0.528)
lid = L.to_object("capot", sharp=40)
o = M3 @ Vector((0, 0.66, -0.5))
for v in lid.data.vertices:
    v.co -= o
lid.location = o

preview("caisson-apercu.png", (2.6, -2.4, 1.9), (0, 0, 0.55), lens=40, res=(1300, 800))
export([pod, lid], "caisson.glb")
