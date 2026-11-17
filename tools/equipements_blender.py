"""Modélise trois équipements de la baie : le rail des bras de maintenance, le portique de liaison N-7 et le robot soudeur de coque.

    blender -b --python tools/equipements_blender.py            # écrit assets/models/equipements.glb
    blender -b --python tools/equipements_blender.py -- apercu  # écrit aussi tools/sources/equipements-apercu*.png

Repère du décor (app/world.js) : x à droite, y vers le haut, z vers l'arrière, en mètres. Objets exportés :

  « rail »      2,6 m de rail (axe z, origine au centre de la poutre) : poutre en I, crémaillère, suspentes, chemin de câbles.
                Le décor le répète tout le long de la baie, des deux côtés (matières de bayMats).
  « portique »  l'arche derrière le fauteuil de liaison, dans le repère du groupe « link » : couronne centrée en (0, 1,5, 0,88),
                émetteurs, jambes, torons de câbles, caisson de tête (matières de seatMats).
  « soudeur »   le Veilleur agrippé à la collerette du grand hublot, vu de l'intérieur à travers le verre. Repère du groupe
                « welder » : x vers l'extérieur du hublot, +z vers la baie ; la coque est en z = +0,18, la soudure en (0,34, -0,04, 0,16).

Matières reprises par nom : structure, acier, sombre, panneau, lueur, ambre, cuivre (rail) ; coque, metal, acier, lueur, ambre (portique, soudeur).
"""
import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, export, move, preview, reset, rot  # noqa: E402

reset(57, {"structure": (0.14, 0.16, 0.19, 1), "acier": (0.8, 0.82, 0.85, 1), "sombre": (0.05, 0.06, 0.07, 1), "panneau": (0.2, 0.23, 0.27, 1),
           "lueur": (0.3, 0.9, 1, 1), "ambre": (1, 0.7, 0.2, 1), "cuivre": (0.5, 0.33, 0.2, 1), "coque": (0.6, 0.63, 0.66, 1), "metal": (0.1, 0.11, 0.13, 1)})
M3 = rot("X", math.pi / 2)  # repère du décor (y vers le haut) -> repère de Blender (z vers le haut)
rx, ry, rz = (lambda a: rot("X", a)), (lambda a: rot("Y", a)), (lambda a: rot("Z", a))
PI2 = 2 * math.pi


def new():
    P = Parts()
    P.M = M3
    return P


def tube(P, mat, profile, seg=48):
    """Révolution fermée d'axe z (profil : (z, rayon)) : un volume plein, aux faces bien orientées."""
    P.lathe(mat, profile + [profile[0]], seg=seg, axis="Z")


# ====================================================================== rail (un tronçon de 2,6 m)
R = new()
L = 2.6
R.box("structure", (0.03, 0.1, L), (0, 0, 0))                                        # âme
R.box("structure", (0.12, 0.016, L), (0, -0.05, 0))                                  # semelle basse (les galets roulent dessus)
R.box("structure", (0.14, 0.016, L), (0, 0.05, 0))
R.box("lueur", (0.02, 0.01, L - 0.1), (0, -0.063, 0))                                # rail conducteur
for k in range(52):
    R.box("acier", (0.012, 0.014, 0.026), (0.066, -0.035, -L / 2 + 0.025 + k * 0.05))  # crémaillère
for z in (-0.65, 0.65):                                                               # suspentes
    R.box("structure", (0.05, 0.3, 0.05), (0, 0.208, z))
    R.box("structure", (0.22, 0.02, 0.2), (0, 0.352, z))
    R.box("structure", (0.014, 0.16, 0.16), (0.03, 0.26, z))
    for sx in (-1, 1):
        R.rod("structure", (sx * 0.02, 0.07, z), (sx * 0.1, 0.34, z), 0.008, seg=6)   # contreventements
        for sz in (-1, 1):
            R.cyl("acier", 0.011, 0.011, 0.012, (sx * 0.08, 0.34, z + sz * 0.07), axis="Y", seg=6)  # boulons de platine
    R.box("sombre", (0.2, 0.014, 0.05), (0.13, 0.19, z))                             # console du chemin de câbles
R.box("sombre", (0.11, 0.012, L), (0.2, 0.2, 0))                                     # chemin de câbles
R.box("sombre", (0.008, 0.04, L), (0.146, 0.214, 0))
R.box("sombre", (0.008, 0.04, L), (0.254, 0.214, 0))
for x, r in ((0.172, 0.013), (0.2, 0.016), (0.229, 0.011)):
    R.rod("metal", (x, 0.206 + r, -L / 2), (x, 0.206 + r, L / 2), r, seg=6)           # câbles
R.rod("cuivre", (-0.06, 0.12, -L / 2), (-0.06, 0.12, L / 2), 0.012, seg=6)           # ligne de fluide
for z in (-1.0, 0.0, 1.0):
    R.box("structure", (0.03, 0.03, 0.03), (-0.045, 0.12, z))
R.box("panneau", (0.09, 0.12, 0.14), (-0.085, 0.24, 0.65))                           # boîte de dérivation
R.box("ambre", (0.004, 0.012, 0.03), (-0.132, 0.27, 0.65))
R.bevel("panneau", 0.004, 1)
rail = R.to_object("rail", sharp=38)

# ====================================================================== portique de liaison (repère du groupe « link »)
G = new()
CX, CY, CZ, RR = 0.0, 1.5, 0.88, 0.78
G.M = M3 @ move(CX, CY, CZ)
tube(G, "metal", [(-0.07, RR - 0.07), (-0.07, RR + 0.07), (-0.02, RR + 0.1), (0.05, RR + 0.1), (0.07, RR + 0.06), (0.07, RR - 0.05), (0.03, RR - 0.08)], seg=72)  # couronne
tube(G, "coque", [(0.07, RR - 0.03), (0.07, RR + 0.04), (0.085, RR + 0.03), (0.085, RR - 0.02)], seg=72)       # jonc avant
G.ring("acier", RR + 0.1, 0.008, -0.045, seg=72, tseg=5, axis="Z")
for i in range(24):                                                                   # segments de la couronne
    a = i * PI2 / 24
    c, s = math.cos(a), math.sin(a)
    G.box("coque" if i % 2 else "metal", (0.1, 0.15, 0.03), (c * (RR + 0.105), s * (RR + 0.105), 0.0), rz(a))
    if i % 4 == 2:                                                                    # six émetteurs tournés vers la tête
        G.box("metal", (0.14, 0.09, 0.09), (c * (RR - 0.1), s * (RR - 0.1), 0.02), rz(a))
        G.cyl("acier", 0.02, 0.03, 0.06, (c * (RR - 0.19), s * (RR - 0.19), 0.02), axis="X", seg=10, rot=rz(a))
        G.box("lueur", (0.006, 0.05, 0.05), (c * (RR - 0.225), s * (RR - 0.225), 0.02), rz(a))
        G.rod("metal", (c * (RR - 0.05), s * (RR - 0.05), -0.04), (c * (RR + 0.05), s * (RR + 0.05), -0.075), 0.009, seg=5)
for sx in (-1, 1):                                                                    # jambes : de la couronne au sol
    a = -math.pi / 2 + sx * 0.72
    top = Vector((math.cos(a) * (RR + 0.06), math.sin(a) * (RR + 0.06), 0.0))
    foot = Vector((sx * 0.66, -CY + 0.02, 0.1))
    knee = Vector((sx * 0.7, -CY + 0.45, 0.04))
    G.rod("metal", top, knee, 0.045, seg=8)
    G.rod("metal", knee, foot, 0.05, seg=8)
    G.sphere("acier", 0.055, knee, seg=10)
    G.cyl("metal", 0.13, 0.15, 0.04, foot, axis="Y", seg=14)
    for k in range(3):
        b = k * PI2 / 3
        G.cyl("acier", 0.012, 0.012, 0.012, foot + Vector((math.cos(b) * 0.1, 0.022, math.sin(b) * 0.1)), axis="Y", seg=6)
    G.rod("acier", top + Vector((0, 0, 0.05)), knee + Vector((0, 0.1, 0.05)), 0.012, seg=6)   # vérin de réglage
    for k, (dx, dz) in enumerate(((0.05, -0.05), (0.0, -0.085), (-0.05, -0.05))):     # torons qui descendent le long des jambes
        G.rod("metal", top + Vector((sx * dx, 0, dz)), knee + Vector((sx * dx, 0, dz)), 0.014, seg=5)
        G.rod("metal", knee + Vector((sx * dx, 0, dz)), foot + Vector((sx * (dx - 0.16), 0.0, dz - 0.25 - k * 0.05)), 0.014, seg=5)
G.box("metal", (0.46, 0.2, 0.2), (0, RR + 0.2, -0.01))                                # caisson de tête
G.box("coque", (0.4, 0.14, 0.02), (0, RR + 0.2, 0.095))
G.box("lueur", (0.3, 0.012, 0.006), (0, RR + 0.24, 0.108))
G.box("ambre", (0.03, 0.03, 0.006), (0.15, RR + 0.17, 0.108))
for k in range(6):
    G.box("metal", (0.012, 0.1, 0.012), (-0.14 + k * 0.04, RR + 0.19, 0.108))          # ailettes
for sx in (-1, 1):
    G.rod("acier", (sx * 0.2, RR + 0.3, 0.0), (sx * 0.26, RR + 0.52, 0.0), 0.012, seg=6)   # potences de l'enseigne
    G.cyl("metal", 0.05, 0.05, 0.16, (sx * 0.31, RR + 0.2, -0.01), axis="X", seg=12)   # condensateurs
G.rod("acier", (-0.26, RR + 0.52, 0.0), (0.26, RR + 0.52, 0.0), 0.012, seg=6)
G.M = M3
G.bevel("coque", 0.004, 1)
portique = G.to_object("portique", sharp=38)

# ====================================================================== robot soudeur (repère du groupe « welder »)
S = new()
HZ = 0.18                                                                             # la coque : plan z = +0,18
S.box("coque", (0.32, 0.24, 0.13), (0, 0, 0))                                         # corps
S.box("metal", (0.26, 0.18, 0.02), (0, 0, 0.07))                                      # ventre (la face que l'on voit depuis la baie)
S.box("ambre", (0.2, 0.012, 0.004), (0, 0.07, 0.082))
S.box("ambre", (0.2, 0.012, 0.004), (0, -0.07, 0.082))
for k in range(5):
    S.box("metal", (0.012, 0.1, 0.006), (-0.08 + k * 0.03, 0, 0.083))                 # ouïes
S.cyl("metal", 0.035, 0.03, 0.03, (0.09, 0, 0.09), axis="Z", seg=14)                 # capteur ventral
S.cyl("acier", 0.038, 0.038, 0.006, (0.09, 0, 0.078), axis="Z", seg=14)
for sy in (-1, 1):
    S.cyl("acier", 0.045, 0.045, 0.3, (-0.02, sy * 0.075, -0.1), axis="X", seg=12)    # bouteilles de gaz, sur le dos
    S.sphere("acier", 0.045, (0.13, sy * 0.075, -0.1), seg=12)
    S.sphere("acier", 0.045, (-0.17, sy * 0.075, -0.1), seg=12)
    S.box("metal", (0.03, 0.02, 0.06), (0.0, sy * 0.075, -0.07))
    for sx in (-1, 1):                                                                # tuyères d'appoint aux quatre coins
        S.cyl("metal", 0.012, 0.022, 0.035, (sx * 0.15, sy * 0.125, 0.0), axis="Y", seg=8)
pads = [(0.3, 0.2), (0.36, 0.07), (0.36, -0.2), (0.24, -0.3), (0.2, 0.31)]            # pattes : épaule sur le corps, genou relevé, ventouse sur la collerette
for i, (px, py) in enumerate(pads):
    sh = Vector((0.12 if abs(py) < 0.25 else 0.06, 0.11 * (1 if py > 0 else -1), 0.02))
    pad = Vector((px, py, HZ))
    knee = (sh + pad) / 2 + Vector((0.02, 0.03 * (1 if py > 0 else -1), -0.12))
    S.sphere("metal", 0.022, sh, seg=8)
    S.rod("coque", sh, knee, 0.013, seg=6)
    S.sphere("metal", 0.018, knee, seg=8)
    S.rod("coque", knee, pad + Vector((0, 0, -0.02)), 0.011, seg=6)
    S.cyl("metal", 0.03, 0.036, 0.022, pad + Vector((0, 0, -0.011)), axis="Z", seg=12)
    S.rod("acier", sh + Vector((0, 0, -0.03)), knee + Vector((0, 0, -0.025)), 0.005, seg=5)   # vérin
WELD = Vector((0.34, -0.04, HZ - 0.02))                                               # bras de soudage
a0, a1 = Vector((0.14, -0.03, 0.03)), Vector((0.24, -0.1, -0.06))
S.sphere("metal", 0.026, a0, seg=10)
S.rod("acier", a0, a1, 0.014, seg=8)
S.sphere("metal", 0.02, a1, seg=8)
S.rod("acier", a1, WELD + Vector((-0.02, 0.0, -0.07)), 0.011, seg=8)
S.rod("metal", WELD + Vector((-0.02, 0.0, -0.07)), WELD, 0.007, seg=6)                # torche
S.cyl("metal", 0.016, 0.01, 0.03, WELD + Vector((-0.012, 0, -0.045)), axis="Z", seg=8)
b0, b1 = Vector((0.14, 0.04, 0.03)), Vector((0.27, 0.06, -0.03))                      # second bras : il tient le métal d'apport
S.sphere("metal", 0.02, b0, seg=8)
S.rod("acier", b0, b1, 0.01, seg=6)
S.rod("acier", b1, WELD + Vector((0.01, 0.05, -0.02)), 0.008, seg=6)
S.rod("cuivre", WELD + Vector((0.01, 0.05, -0.02)), WELD + Vector((0.0, 0.01, 0.0)), 0.003, seg=4)
S.rod("metal", (-0.16, 0.0, -0.03), (-0.3, 0.06, 0.02), 0.01, seg=6)                  # longe de sécurité vers la coque
S.rod("metal", (-0.3, 0.06, 0.02), (-0.75, 0.32, 0.12), 0.01, seg=6)
S.rod("metal", (-0.75, 0.32, 0.12), (-1.6, 0.5, 0.15), 0.01, seg=6)
S.cyl("metal", 0.02, 0.02, 0.05, (-0.12, 0.06, 0.06), axis="Z", seg=8)                # embase du gyrophare
S.rod("metal", (-0.1, -0.09, -0.06), (-0.16, -0.16, -0.22), 0.003, seg=4)            # antenne
S.bevel("coque", 0.006, 2)
soudeur = S.to_object("soudeur", sharp=38)

if "apercu" in sys.argv:
    rail.location = M3 @ Vector((-2.2, 3.2, 0))
    soudeur.location = M3 @ Vector((2.4, 1.2, 0))
    preview("equipements-apercu.png", (0.4, -4.6, 1.7), (0.1, 0, 1.6), lens=30, res=(1500, 900))
    preview("equipements-apercu-soudeur.png", (2.7, -0.95, 1.35), (2.5, 0, 1.2), lens=45, res=(1100, 800))
    preview("equipements-apercu-rail.png", (-1.5, -1.5, 2.9), (-2.2, 0, 3.3), lens=40, res=(1100, 800))
    rail.location = soudeur.location = (0, 0, 0)
export([rail, portique, soudeur], "equipements.glb")
