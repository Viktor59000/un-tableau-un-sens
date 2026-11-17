"""Modélise le mur des hublots de la baie d'observation : cloison percée, grand hublot à volet-iris, deux hublots latéraux,
pupitre et garde-corps.

    blender -b --python tools/hublots_blender.py            # écrit assets/models/hublots.glb
    blender -b --python tools/hublots_blender.py -- apercu  # écrit aussi tools/sources/hublots-apercu*.png

Repère du décor (app/world.js) : x à droite, y vers le haut ; z = 0 est la face intérieure de la cloison (le décor pose le modèle
en z = Z0), +z vers la baie, -z vers l'espace. Les trois ouvertures reprennent WC et HOLES de world.js, à ne pas déplacer : le
soleil, son faisceau et le robot soudeur en dépendent. Le verre et les relevés projetés au-dessus du pupitre restent dessinés
par le décor. Objets exportés : « cloison » (la tôle percée) et « hublots » (tout le reste).
Matières reprises par nom (bayMats de world.js) : paroi, structure, panneau, sombre, acier, coque, cuivre, jaune, rouge, lueur, lueur_c, ecran, rampe, touche (touches à légende rétroéclairée, dessinée par le décor), ambre.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, export, move, preview, reset, rot  # noqa: E402

reset(12, {"paroi": (0.42, 0.47, 0.53, 1), "structure": (0.14, 0.16, 0.19, 1), "panneau": (0.2, 0.23, 0.27, 1), "sombre": (0.05, 0.06, 0.07, 1),
           "acier": (0.8, 0.82, 0.85, 1), "coque": (0.17, 0.2, 0.24, 1), "cuivre": (0.5, 0.33, 0.2, 1), "jaune": (0.7, 0.52, 0.08, 1),
           "rouge": (0.55, 0.12, 0.09, 1), "lueur": (0.45, 0.6, 0.8, 1), "lueur_c": (0.3, 0.9, 1, 1), "ecran": (0.15, 0.5, 0.6, 1), "rampe": (0.5, 0.53, 0.56, 1), "touche": (0.08, 0.09, 0.11, 1), "ambre": (1, 0.7, 0.2, 1)})
M3 = rot("X", math.pi / 2)  # repère du décor (y vers le haut) -> repère de Blender (z vers le haut)
rx, rz = (lambda a: rot("X", a)), (lambda a: rot("Z", a))
BW, BH, TH = 11.0, 5.0, 0.5
HOLES = [(0.0, 2.55, 2.05), (-3.95, 2.7, 0.72), (3.95, 2.7, 0.72)]  # = WC et HOLES de world.js
PI2 = 2 * math.pi

# ============ la cloison : une tôle épaisse, percée (opération booléenne) ============
C = Parts()
C.M = M3
C.box("paroi", (BW, BH, TH), (0, BH / 2, -TH / 2))
cloison = C.to_object("cloison")
K = Parts()
K.M = M3
for x, y, r in HOLES:
    K.cyl("paroi", r + 0.1, r + 0.1, TH + 0.4, (x, y, -TH / 2), axis="Z", seg=96)
cut = K.to_object("percage")
bpy.context.view_layer.objects.active = cloison
mod = cloison.modifiers.new("percage", "BOOLEAN")
mod.operation, mod.object, mod.solver = "DIFFERENCE", cut, "EXACT"
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)
cloison.data.set_sharp_from_angle(angle=math.radians(40))

P = Parts()


def centre(x, y, z=0.0):
    """Repère centré sur un hublot : anneaux et révolutions d'axe z (profils : (z, rayon))."""
    P.M = M3 @ move(x, y, z)


def tube(mat, profile, seg=72):
    """Révolution fermée (le profil revient à son point de départ) : un volume plein, donc des faces bien orientées."""
    P.lathe(mat, profile + [profile[0]], seg=seg, axis="Z")


# ============ le grand hublot ============
x0, y0, r = HOLES[0]
centre(x0, y0)
tube("sombre", [(0.04, r), (0.04, r + 0.14), (-TH - 0.04, r + 0.14), (-TH - 0.04, r + 0.03), (-0.3, r - 0.01)], seg=96)            # embrasure
tube("panneau", [(0.0, r + 0.1), (0.0, r + 0.34), (0.05, r + 0.34), (0.095, r + 0.3), (0.095, r + 0.14), (0.05, r + 0.1)], seg=96)    # cadre à gradin
tube("structure", [(0.0, r + 0.34), (0.0, r + 0.43), (0.075, r + 0.43), (0.075, r + 0.34)], seg=96)                                  # couronne du volet-iris
P.ring("acier", r + 0.07, 0.016, 0.06, seg=96, tseg=6, axis="Z")
P.ring("lueur", r - 0.03, 0.014, 0.05, seg=96, tseg=6, axis="Z")                                                                     # filet lumineux du bord
tube("sombre", [(-TH - 0.04, r + 0.03), (-TH - 0.04, r + 0.2), (-TH - 0.1, r + 0.17), (-TH - 0.1, r + 0.05)], seg=72)                # collerette extérieure
for i in range(20):                                                                                                                   # brides boulonnées
    a = i * PI2 / 20
    c, s = math.cos(a), math.sin(a)
    P.box("structure", (0.13, 0.085, 0.05), (c * (r + 0.22), s * (r + 0.22), 0.115), rz(a))
    for d in (-0.035, 0.035):
        P.cyl("acier", 0.014, 0.014, 0.02, (c * (r + 0.22 + d), s * (r + 0.22 + d), 0.145), axis="Z", seg=8)
for i in range(8):                                                                                                                    # vérins du volet-iris, tangents à la couronne
    a = (i + 0.5) * PI2 / 8
    c, s = math.cos(a), math.sin(a)
    R = r + 0.385
    t = rz(a + math.pi / 2)
    P.cyl("sombre", 0.034, 0.034, 0.36, (c * R - s * 0.12, s * R + c * 0.12, 0.115), axis="X", seg=12, rot=t)
    P.cyl("acier", 0.015, 0.015, 0.34, (c * R + s * 0.2, s * R - c * 0.2, 0.115), axis="X", seg=8, rot=t)
    for d in (-0.32, 0.38):
        P.box("structure", (0.06, 0.09, 0.09), (c * R - s * d, s * R + c * d, 0.1), t)
    P.cyl("cuivre", 0.008, 0.008, 0.3, (c * (R - 0.05) - s * 0.1, s * (R - 0.05) + c * 0.1, 0.16), axis="X", seg=6, rot=t)           # flexible hydraulique
for i in range(4):                                                                                                                    # verrous aux quatre diagonales
    a = math.pi / 4 + i * math.pi / 2
    c, s = math.cos(a), math.sin(a)
    P.box("structure", (0.2, 0.26, 0.13), (c * (r + 0.24), s * (r + 0.24), 0.14), rz(a))
    P.cyl("acier", 0.035, 0.035, 0.05, (c * (r + 0.24), s * (r + 0.24), 0.21), axis="Z", seg=12)
    P.box("jaune", (0.012, 0.2, 0.004), (c * (r + 0.24), s * (r + 0.24), 0.207), rz(a))

# ============ les deux hublots latéraux ============
for x0, y0, r in HOLES[1:]:
    sd = 1 if x0 > 0 else -1
    centre(x0, y0)
    tube("sombre", [(0.03, r), (0.03, r + 0.14), (-TH - 0.03, r + 0.14), (-TH - 0.03, r + 0.02), (-0.3, r - 0.01)], seg=64)
    tube("panneau", [(0.0, r + 0.1), (0.0, r + 0.22), (0.04, r + 0.22), (0.07, r + 0.19), (0.07, r + 0.13), (0.04, r + 0.1)], seg=64)
    P.ring("lueur", r - 0.03, 0.011, 0.04, seg=64, tseg=6, axis="Z")
    tube("sombre", [(-TH - 0.03, r + 0.02), (-TH - 0.03, r + 0.14), (-TH - 0.08, r + 0.12), (-TH - 0.08, r + 0.04)], seg=48)
    for i in range(10):
        a = i * PI2 / 10 + 0.3
        P.cyl("acier", 0.017, 0.017, 0.022, (math.cos(a) * (r + 0.16), math.sin(a) * (r + 0.16), 0.078), axis="Z", seg=8)
    wx, wy = sd * 1.0, -1.0                                                                                                           # volant de condamnation manuelle, côté angle
    P.M = M3 @ move(x0 + wx, y0 + wy, 0)
    P.ring("acier", 0.1, 0.011, 0.11, seg=28, tseg=6, axis="Z")
    for k in range(3):
        a = k * PI2 / 3
        P.rod("acier", (0, 0, 0.11), (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.11), 0.007, seg=6)
    P.cyl("structure", 0.03, 0.04, 0.11, (0, 0, 0.055), axis="Z", seg=12)
    P.box("jaune", (0.2, 0.045, 0.006), (0, -0.17, 0.004))

# ============ habillage de la cloison ============
P.M = M3
for sx in (-1, 1):
    P.box("structure", (0.16, BH, 0.12), (sx * 2.78, BH / 2, 0.06))                                   # montants entre les hublots
    P.box("structure", (0.2, BH, 0.14), (sx * 5.28, BH / 2, 0.07))                                    # montants d'angle
    for y in (0.9, 2.5, 4.1):
        P.box("sombre", (0.2, 0.06, 0.13), (sx * 2.78, y, 0.065))
    P.box("structure", (2.34, 0.12, 0.1), (sx * 4.03, 4.62, 0.05))                                    # lisse haute
    P.box("panneau", (2.2, 1.36, 0.05), (sx * 4.03, 0.78, 0.025))                                     # soubassement
    for k in range(3):
        P.box("sombre", (0.012, 1.3, 0.052), (sx * (3.3 + k * 0.73), 0.78, 0.026))                    # joints du soubassement
    for k in range(7):
        P.box("sombre", (0.56, 0.018, 0.02), (sx * 4.4, 0.32 + k * 0.05, 0.06), rx(0.5))              # ouïe de ventilation
    P.box("sombre", (0.4, 0.3, 0.035), (sx * 3.5, 1.68, 0.018))                                      # petit moniteur d'état
    P.box("ecran", (0.34, 0.24, 0.004), (sx * 3.5, 1.68, 0.038))
    P.box("jaune", (0.34, 0.025, 0.004), (sx * 3.5, 1.5, 0.004))
    for dx in (0.0, 0.09):                                                                             # descentes de fluides
        P.rod("cuivre", (sx * (3.02 + dx), 0.0, 0.1), (sx * (3.02 + dx), 1.55, 0.1), 0.026, seg=10)
        P.rod("cuivre", (sx * (3.02 + dx), 1.55, 0.1), (sx * (3.02 + dx), 1.72, 0.03), 0.026, seg=10)
    for y in (0.4, 1.1):
        P.box("structure", (0.2, 0.05, 0.07), (sx * 3.065, y, 0.1))
    P.cyl("rouge", 0.05, 0.05, 0.03, (sx * 3.065, 1.38, 0.14), axis="Z", seg=14)                      # vanne
    P.box("panneau", (2.2, 0.5, 0.04), (sx * 4.03, 4.2, 0.02))                                        # bandeau haut
    P.box("lueur", (1.6, 0.02, 0.006), (sx * 4.03, 3.96, 0.042))

# ============ le pupitre ============
P.box("sombre", (4.56, 0.12, 0.76), (0, 0.06, 0.75))                                                  # plinthe
P.box("panneau", (4.4, 0.6, 0.6), (0, 0.42, 0.72))                                                    # corps
for k in range(5):
    P.box("sombre", (0.012, 0.56, 0.61), (-1.76 + k * 0.88, 0.42, 0.72))                              # joints entre modules
for k in range(9):
    P.box("jaune" if k % 2 == 0 else "sombre", (0.5, 0.06, 0.006), (-2.0 + k * 0.5, 0.06, 1.132))     # bande de sécurité au sol
for sx in (-1, 1):
    P.box("structure", (0.12, 0.98, 0.82), (sx * 2.26, 0.49, 0.74))                                   # joues
    P.box("sombre", (0.5, 0.3, 0.02), (sx * 1.3, 0.42, 1.022))                                        # trappes de façade
    for k in range(4):
        P.box("sombre", (0.4, 0.014, 0.012), (sx * 1.3, 0.34 + k * 0.05, 1.034))
P.box("lueur_c", (4.2, 0.016, 0.02), (0, 0.735, 1.04))                                                # filet sous le plateau
P.box("sombre", (4.4, 0.34, 0.09), (0, 0.92, 0.44), rx(-0.14))                                        # dosseret
P.M = M3 @ move(0, 0.845, 0.8) @ rx(0.3)                                                               # repère du plateau incliné vers le visiteur
P.box("coque", (4.4, 0.06, 0.6), (0, 0, 0))
for sx in (-1, 1):
    P.box("sombre", (1.5, 0.012, 0.1), (sx * 1.25, 0.036, -0.21))                                     # barre d'émission des relevés projetés
    P.box("lueur_c", (1.4, 0.006, 0.02), (sx * 1.25, 0.045, -0.21))
    P.box("sombre", (0.6, 0.01, 0.3), (sx * 1.5, 0.034, 0.06))                                        # écrans encastrés
    P.box("ecran", (0.54, 0.004, 0.24), (sx * 1.5, 0.04, 0.06))
    P.box("sombre", (0.42, 0.006, 0.26), (sx * 0.7625, 0.032, 0.0))                                   # platine du clavier
    for i in range(6):                                                                                 # clavier : touches biseautées (leur légende est dessinée par le décor)
        for j in range(3):
            P.box("touche", (0.052, 0.02, 0.042), (sx * (0.6 + i * 0.065), 0.044, -0.02 + j * 0.055))
    for i in range(8):                                                                                 # rangée de fonctions
        P.box("touche", (0.038, 0.014, 0.024), (sx * (0.6 + i * 0.047), 0.041, -0.085))
    for i in range(10):                                                                                # témoins
        P.cyl(("lueur_c", "sombre", "ambre", "sombre", "lueur_c", "rouge", "sombre", "lueur_c", "sombre", "ambre")[i], 0.005, 0.005, 0.006, (sx * (0.6 + i * 0.035), 0.034, -0.125), axis="Y", seg=8)
    P.box("sombre", (0.2, 0.006, 0.25), (sx * 1.075, 0.032, 0.04))                                    # platine des réglages
    for i in range(3):                                                                                 # molettes crantées
        x = sx * (0.99 + i * 0.08)
        P.cyl("sombre", 0.03, 0.032, 0.008, (x, 0.038, -0.02), axis="Y", seg=20)
        P.cyl("acier", 0.021, 0.023, 0.028, (x, 0.056, -0.02), axis="Y", seg=18)
        for k in range(9):
            a = k * 2 * math.pi / 9
            P.box("acier", (0.004, 0.024, 0.004), (x + math.cos(a) * 0.0225, 0.056, -0.02 + math.sin(a) * 0.0225))
        P.box("lueur_c", (0.004, 0.003, 0.016), (x, 0.0715, -0.027))
    for i in range(4):                                                                                 # interrupteurs à levier ; le premier est sous capot
        x = sx * (0.985 + i * 0.058)
        P.box("structure", (0.03, 0.008, 0.044), (x, 0.038, 0.09))
        P.rod("acier", (x, 0.04, 0.09), (x, 0.072, 0.09 + (0.012 if i % 2 else -0.012)), 0.0045, seg=6)
        P.sphere("acier", 0.007, (x, 0.074, 0.09 + (0.012 if i % 2 else -0.012)), seg=8)
        if i == 0:
            for dz in (-0.024, 0.024):
                P.box("rouge", (0.036, 0.03, 0.004), (x, 0.052, 0.09 + dz))
            P.box("rouge", (0.036, 0.004, 0.052), (x, 0.068, 0.09))
    P.box("sombre", (0.014, 0.006, 0.17), (sx * 1.875, 0.033, 0.06))                                  # curseur à glissière
    P.box("touche", (0.034, 0.022, 0.022), (sx * 1.875, 0.045, 0.02))
    for k in range(7):
        P.box("lueur_c" if k == 4 else "acier", (0.01, 0.002, 0.002), (sx * 1.853, 0.035, -0.015 + k * 0.025))
    P.cyl("acier", 0.012, 0.012, 0.1, (sx * 1.98, 0.08, 0.1), axis="Y", seg=8)                        # manette
    P.sphere("rouge", 0.024, (sx * 1.98, 0.14, 0.1), seg=10)
    P.cyl("sombre", 0.04, 0.045, 0.012, (sx * 1.98, 0.036, 0.1), axis="Y", seg=12)
P.box("sombre", (0.7, 0.01, 0.36), (0, 0.034, 0.04))                                                  # écran central
P.box("ecran", (0.64, 0.004, 0.3), (0, 0.04, 0.04))
for k in range(5):
    P.cyl("jaune" if k == 2 else "sombre", 0.016, 0.018, 0.016, (-0.24 + k * 0.12, 0.04, 0.25), axis="Y", seg=10)   # voyants
P.M = M3

# ============ le garde-corps ============
ZR = 1.35
for x in (-2.3, -1.15, 0.0, 1.15, 2.3):
    P.rod("rampe", (x, 0.0, ZR), (x, 1.05, ZR), 0.022, seg=10)
    P.cyl("structure", 0.06, 0.07, 0.03, (x, 0.015, ZR), axis="Y", seg=14)
    P.cyl("structure", 0.03, 0.03, 0.05, (x, 0.58, ZR), axis="Y", seg=10)
P.rod("rampe", (-2.3, 1.05, ZR), (2.3, 1.05, ZR), 0.028, seg=12)                                      # main courante
P.rod("rampe", (-2.3, 0.58, ZR), (2.3, 0.58, ZR), 0.015, seg=8)                                       # lisse
P.box("sombre", (4.6, 0.1, 0.016), (0, 0.07, ZR))                                                     # plinthe
for sx in (-1, 1):
    P.rod("rampe", (sx * 2.3, 1.05, ZR), (sx * 2.3, 0.98, 1.12), 0.028, seg=12)                       # retours vers le pupitre
    P.sphere("rampe", 0.03, (sx * 2.3, 1.05, ZR), seg=10)

P.bevel("panneau", 0.008, 2)
P.bevel("structure", 0.006, 2)
P.bevel("coque", 0.008, 2)
P.bevel("touche", 0.0045, 2)
hublots = P.to_object("hublots", sharp=38)

preview("hublots-apercu.png", (0.6, -6.8, 1.9), (0, 0, 2.3), lens=24, res=(1500, 800))          # caméras dans le repère de Blender : (x, -z, y)
preview("hublots-apercu-pupitre.png", (1.9, -3.6, 2.0), (0.2, -0.7, 0.85), lens=35, res=(1300, 800))
preview("hublots-apercu-volet.png", (2.9, -2.4, 4.3), (1.7, 0.0, 3.7), lens=40, res=(1200, 800))
export([cloison, hublots], "hublots.glb")
