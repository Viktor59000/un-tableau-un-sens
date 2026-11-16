"""Modélise le poste de liaison neurale N-7 : le fauteuil où le visiteur se branche.

    blender -b --python tools/fauteuil_blender.py            # écrit assets/models/fauteuil.glb
    blender -b --python tools/fauteuil_blender.py -- apercu  # écrit aussi tools/sources/fauteuil-apercu*.png

Les cotes sont celles du décor (app/world.js, groupe « link ») : x vers la droite du visiteur assis, y vers le haut, z vers
l'arrière (l'avant du fauteuil regarde -z), en mètres. Elles suivent la posture du corps (app/corps.js, pose « seat ») :
yeux à (0, 1,42, 0,26), hanches vers z = 0,38, genoux vers z = 0, avant-bras à x = ±0,285 et y = 0,90, de z = 0,39 à 0,11.
Objets exportés : « fauteuil » (fixe), « accoudoir_g » et « accoudoir_d » (origine sur leur charnière arrière : ils
s'écartent et se referment), « casque » (origine sur son axe, au-dessus de la têtière : il se rabat sur les yeux).
Matières reprises par nom dans le décor : cuir, coque, metal, acier, lueur, ambre, ecran.
"""
import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, export, move, preview, reset, rot  # noqa: E402

reset(77, {"cuir": (0.07, 0.08, 0.1, 1), "coque": (0.72, 0.74, 0.77, 1), "metal": (0.12, 0.13, 0.15, 1), "acier": (0.8, 0.82, 0.85, 1), "lueur": (0.3, 0.9, 1, 1), "ambre": (1, 0.7, 0.2, 1), "ecran": (0.15, 0.5, 0.6, 1)})
M3 = rot("X", math.pi / 2)  # repère du décor (y vers le haut) -> repère de Blender (z vers le haut)
rx = lambda a: rot("X", a)
ry = lambda a: rot("Y", a)


def decor(P):
    P.M = M3


def tour(P, cx, cz):
    """Repère pour les pièces de révolution d'axe vertical : (hauteur, rayon)."""
    P.M = M3 @ move(cx, 0, cz) @ rot("Z", math.pi / 2)


def finish(P, name, origin=None):
    P.bevel("cuir", 0.014, 3)
    P.bevel("coque", 0.006, 2)
    P.bevel("metal", 0.004, 1)
    ob = P.to_object(name, sharp=40)
    if origin:
        o = M3 @ Vector(origin)
        for v in ob.data.vertices:
            v.co -= o
        ob.location = o
    return ob


# ============ le fauteuil ============
F = Parts()
CZ = 0.44  # axe du pied, sous l'assise
tour(F, 0, CZ)
F.lathe("metal", [(0, 0.0), (0, 0.64), (0.03, 0.64), (0.05, 0.6), (0.06, 0.36), (0.075, 0.33), (0.09, 0.2), (0.3, 0.13), (0.36, 0.13), (0.38, 0.18), (0.42, 0.18), (0.42, 0.0)], seg=44)
F.ring("lueur", 0.6, 0.008, 0.055, seg=64, tseg=6)
F.ring("lueur", 0.34, 0.006, 0.078, seg=48, tseg=6)
F.ring("acier", 0.135, 0.012, 0.2, seg=28, tseg=6)
decor(F)
for i in range(10):
    a = i * math.pi / 5 + 0.3
    F.cyl("acier", 0.017, 0.017, 0.022, (math.cos(a) * 0.5, 0.061, CZ + math.sin(a) * 0.5), axis="Y", seg=6)
F.sphere("acier", 0.11, (0, 0.425, CZ), scale=(1, 0.55, 1), seg=20)
for s in (-1, 1):  # vérins
    for a, b in (((s * 0.26, 0.07, 0.66), (s * 0.2, 0.42, 0.6)), ((s * 0.24, 0.07, 0.26), (s * 0.19, 0.41, 0.34))):
        a, b = Vector(a), Vector(b)
        F.rod("acier", a, b, 0.016, seg=10)
        F.rod("metal", a, a + (b - a) * 0.55, 0.03, seg=14)
        F.sphere("metal", 0.036, a, seg=10)
# châssis de l'assise
F.box("coque", (0.52, 0.07, 0.56), (0, 0.445, 0.46))
F.box("metal", (0.4, 0.05, 0.4), (0, 0.4, 0.46))
for s in (-1, 1):
    F.box("coque", (0.035, 0.12, 0.58), (s * 0.268, 0.475, 0.46))
    F.box("lueur", (0.004, 0.012, 0.44), (s * 0.287, 0.49, 0.46))
# assise : trois coussins en pente, bourrelets latéraux, bord avant arrondi
SL = -0.118
top = lambda z: 0.505 + (z - 0.24) * 0.118
for z in (0.6, 0.455, 0.31):
    F.box("cuir", (0.36, 0.07, 0.135), (0, top(z) - 0.035, z), rx(SL))
for s in (-1, 1):
    F.box("cuir", (0.062, 0.088, 0.42), (s * 0.214, 0.5, 0.45), rx(SL))
F.cyl("cuir", 0.043, 0.043, 0.4, (0, 0.468, 0.218), seg=18)
# dossier : coque, cinq coussins, bourrelets, filets lumineux
F.box("coque", (0.5, 0.95, 0.05), (0, 0.98, 0.745))
F.box("coque", (0.64, 0.17, 0.05), (0, 1.33, 0.745))
for y in (0.66, 0.82, 0.98, 1.14, 1.3):
    F.box("cuir", (0.34, 0.15, 0.07), (0, y, 0.69))
for s in (-1, 1):
    F.box("cuir", (0.075, 0.8, 0.1), (s * 0.214, 0.98, 0.676))
    F.box("lueur", (0.008, 0.74, 0.008), (s * 0.256, 0.98, 0.632))
    F.box("coque", (0.05, 0.12, 0.09), (s * 0.3, 1.33, 0.7), ry(s * 0.5))
# têtière : tige, coque, coussin central et deux joues qui enveloppent la tête
F.box("metal", (0.08, 0.22, 0.045), (0, 1.5, 0.7))
F.box("coque", (0.26, 0.27, 0.035), (0, 1.5, 0.6))
F.box("cuir", (0.2, 0.22, 0.05), (0, 1.5, 0.558))
for s in (-1, 1):
    F.box("coque", (0.11, 0.25, 0.03), (s * 0.168, 1.5, 0.558), ry(s * 0.7))
    F.box("cuir", (0.09, 0.2, 0.04), (s * 0.15, 1.5, 0.522), ry(s * 0.7))
# port cervical : le logement où la fiche vient se verrouiller, sous la têtière
F.box("metal", (0.13, 0.055, 0.05), (0, 1.33, 0.585))
F.cyl("acier", 0.024, 0.024, 0.03, (0, 1.33, 0.556), axis="Z", seg=16)
for s in (-1, 1):
    F.box("ambre", (0.012, 0.012, 0.004), (s * 0.042, 1.33, 0.558))
# dos du fauteuil : conduit d'échine, ailettes de refroidissement, bloc d'alimentation, enrouleur du câble, flexibles
F.box("metal", (0.16, 0.86, 0.07), (0, 0.98, 0.805))
for i in range(9):
    F.box("coque", (0.32, 0.012, 0.055), (0, 0.62 + i * 0.085, 0.8))
F.box("metal", (0.36, 0.22, 0.17), (0, 0.33, 0.87))
F.box("ambre", (0.05, 0.012, 0.004), (0.11, 0.39, 0.957))
F.box("lueur", (0.2, 0.006, 0.004), (-0.04, 0.3, 0.957))
F.box("metal", (0.05, 0.22, 0.04), (0.27, 1.5, 0.76))
F.cyl("metal", 0.075, 0.075, 0.06, (0.3, 1.6, 0.72), seg=20)
F.cyl("acier", 0.03, 0.03, 0.075, (0.3, 1.6, 0.72), seg=14)
F.box("metal", (0.1, 0.08, 0.12), (0, 0.74, 0.85))
for s in (-1, 1):
    pts = [Vector(p) for p in ((s * 0.13, 0.36, 0.94), (s * 0.22, 0.22, 1.02), (s * 0.36, 0.08, 1.06), (s * 0.56, 0.035, 1.02), (s * 0.8, 0.03, 0.9))]
    for a, b in zip(pts, pts[1:]):
        F.rod("metal", a, b, 0.02, seg=10)
        F.sphere("metal", 0.02, b, seg=8)
    F.rod("metal", (s * 0.3, 1.34, 0.775), (s * 0.74, 1.3, 0.87), 0.014, seg=8)  # bras du halo
# repose-pieds : deux bras, une plaque striée, un filet lumineux
for s in (-1, 1):
    F.rod("metal", (s * 0.17, 0.3, 0.36), (s * 0.2, 0.09, 0.12), 0.018, seg=10)
F.box("metal", (0.46, 0.025, 0.36), (0, 0.085, 0.03), rx(0.14))
for i in range(6):
    z = -0.11 + i * 0.055
    F.box("coque", (0.4, 0.006, 0.012), (0, 0.1 - z * 0.14 + 0.004, z), rx(0.14))
F.box("lueur", (0.42, 0.006, 0.008), (0, 0.124, -0.152))
seat = finish(F, "fauteuil")


# ============ les accoudoirs (ils pivotent sur leur charnière arrière) ============
def accoudoir(s):
    A = Parts()
    decor(A)
    x = s * 0.285
    A.cyl("metal", 0.03, 0.034, 0.34, (x, 0.63, 0.62), axis="Y", seg=16)
    A.cyl("acier", 0.038, 0.038, 0.02, (x, 0.77, 0.62), axis="Y", seg=16)
    A.box("coque", (0.12, 0.05, 0.76), (x, 0.795, 0.25))
    A.box("metal", (0.04, 0.03, 0.5), (x, 0.757, 0.3))
    A.box("cuir", (0.1, 0.028, 0.46), (x, 0.832, 0.36))
    A.box("lueur", (0.005, 0.012, 0.66), (s * 0.347, 0.795, 0.25))
    A.box("metal", (0.12, 0.03, 0.2), (x, 0.838, -0.02), rx(0.25))  # pupitre incliné en bout d'accoudoir
    A.box("ecran", (0.09, 0.004, 0.13), (x, 0.856, -0.024), rx(0.25))
    A.cyl("metal", 0.03, 0.036, 0.03, (s * 0.208, 0.865, 0.04), axis="Y", seg=16)  # manche de commande, contre la paume
    A.cyl("metal", 0.017, 0.02, 0.15, (s * 0.208, 0.95, 0.04), axis="Y", seg=14)
    A.sphere("acier", 0.024, (s * 0.208, 1.03, 0.04), seg=14)
    A.box("ambre", (0.006, 0.02, 0.012), (s * 0.208 - s * 0.019, 0.99, 0.04))
    for z in (0.27, 0.13):  # chapes des bracelets
        A.box("metal", (0.022, 0.09, 0.034), (s * 0.356, 0.86, z))
    return finish(A, "accoudoir_g" if s < 0 else "accoudoir_d", origin=(x, 0.6, 0.62))


arms = [accoudoir(-1), accoudoir(1)]

# ============ le casque (il se rabat sur les yeux depuis le dessus de la tête) ============
C = Parts()
decor(C)
E, PV = Vector((0, 1.42, 0.26)), Vector((0, 1.66, 0.52))
C.box("coque", (0.17, 0.115, 0.035), E + Vector((0, 0, -0.128)))
for s in (-1, 1):
    C.box("coque", (0.085, 0.115, 0.035), E + Vector((s * 0.112, 0, -0.106)), ry(-s * 0.6))
    C.box("cuir", (0.03, 0.09, 0.07), E + Vector((s * 0.128, 0, -0.05)))
    C.rod("metal", E + Vector((s * 0.146, 0.01, -0.07)), PV + Vector((s * 0.146, 0, 0)), 0.011, seg=8)
    C.cyl("acier", 0.03, 0.03, 0.022, PV + Vector((s * 0.146, 0, 0)), seg=16)
C.rod("metal", PV + Vector((-0.146, 0, 0)), PV + Vector((0.146, 0, 0)), 0.013, seg=8)
C.box("cuir", (0.25, 0.022, 0.045), E + Vector((0, 0.052, -0.088)))
C.box("cuir", (0.25, 0.022, 0.045), E + Vector((0, -0.052, -0.088)))
C.box("ecran", (0.22, 0.082, 0.004), E + Vector((0, 0, -0.106)))
C.box("lueur", (0.14, 0.006, 0.004), E + Vector((0, 0.022, -0.1465)))
C.box("ambre", (0.03, 0.006, 0.004), E + Vector((0.05, -0.03, -0.1465)))
C.box("metal", (0.06, 0.03, 0.02), E + Vector((0, 0.07, -0.13)))
helmet = finish(C, "casque", origin=tuple(PV))

preview("fauteuil-apercu.png", (1.9, -2.3, 1.7), (0, -0.3, 0.85), lens=45, res=(1100, 1000))
preview("fauteuil-apercu-dos.png", (-1.7, 2.3, 1.6), (0, -0.5, 0.9), lens=45, res=(1100, 1000))
export([seat] + arms + [helmet], "fauteuil.glb")
