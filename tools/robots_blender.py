"""Modélise les Veilleurs, les robots de la baie cryogénique : bras de maintenance sur rail, drone de surveillance, robot d'entretien.

    blender -b --python tools/robots_blender.py            # écrit assets/models/robots.glb
    blender -b --python tools/robots_blender.py -- apercu  # écrit aussi tools/sources/robots-apercu*.png

Repère du décor (app/world.js) : x à droite, y vers le haut, z vers l'arrière, en mètres. Chaque pièce mobile est un objet à part,
dont l'origine est posée sur son articulation ; le décor les raccroche à ses propres pivots et les anime.

  bras sur rail   « chariot » (roule sous le rail, origine au centre du chariot)
                  « bras1 »   (origine sur l'épaule, s'étend de 1,3 m vers -y, pivote autour de z)
                  « bras2 »   (origine sur le coude, 1,3 m vers -y, pivote autour de z)
                  « outil »   (origine sur le poignet : tête de relevé, objectif vers -y)
  drone           « drone » (avant vers +z, objectif sous le ventre) et « helice » (une hélice, origine sur son moyeu : le décor en pose quatre)
  robot au sol    « rover » (avant vers +x, origine au sol), « roue » (origine sur l'essieu, axe z : le décor en pose six), « mat » (tourelle de relevé, origine sur son pivot)

Matières reprises par nom dans le décor : coque, metal, acier, cable, verre, lueur, ambre.
"""
import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, export, move, preview, reset, rot  # noqa: E402

reset(31, {"coque": (0.55, 0.58, 0.61, 1), "metal": (0.09, 0.1, 0.12, 1), "acier": (0.8, 0.82, 0.85, 1), "cable": (0.03, 0.03, 0.04, 1),
           "verre": (0.02, 0.04, 0.07, 1), "lueur": (0.3, 0.9, 1, 1), "ambre": (1, 0.7, 0.2, 1)})
M3 = rot("X", math.pi / 2)  # repère du décor (y vers le haut) -> repère de Blender (z vers le haut)
rx, ry, rz = (lambda a: rot("X", a)), (lambda a: rot("Y", a)), (lambda a: rot("Z", a))
SHOW = Vector((0, 0, 0))  # décalage de présentation : les pièces sont exportées à l'origine, mais étalées pour l'aperçu


def new():
    P = Parts()
    P.M = M3
    return P


def tour(P, x, y, z):
    """Repère des pièces de révolution d'axe vertical posées en (x, y, z) : profils (hauteur, rayon), anneaux à la hauteur donnée."""
    P.M = M3 @ move(x, y, z) @ rot("Z", math.pi / 2)


def finish(P, name, origin=(0, 0, 0), bevel=True):
    if bevel:
        P.bevel("coque", 0.004, 2)
        P.bevel("metal", 0.0025, 1)
    ob = P.to_object(name, sharp=38)
    o = M3 @ Vector(origin)
    for v in ob.data.vertices:
        v.co -= o
    return ob


# ====================================================================== bras de maintenance sur rail
# --- chariot : il enserre le rail (section 0,12 × 0,10 centrée en y = +0,14) et porte l'épaule en (0, -0,12, 0)
C = new()
C.box("coque", (0.44, 0.15, 0.38), (0, 0.0, 0))
C.box("metal", (0.46, 0.05, 0.3), (0, 0.085, 0))                                   # berceau sous le rail
for s in (-1, 1):
    C.box("metal", (0.04, 0.2, 0.34), (s * 0.105, 0.16, 0))                        # joues de part et d'autre du rail
    C.box("metal", (0.4, 0.12, 0.05), (0, 0.0, s * 0.215))                         # flasques d'extrémité
    C.box("metal", (0.012, 0.09, 0.24), (s * 0.226, 0.0, 0))                       # trappes de visite
    for k in range(5):
        C.box("cable", (0.006, 0.07, 0.014), (s * 0.233, 0.0, -0.08 + k * 0.04))   # ouïes
    C.box("coque", (0.028, 0.2, 0.15), (0, -0.14, s * 0.088))                      # chape de l'épaule
    C.cyl("acier", 0.034, 0.034, 0.012, (0, -0.12, s * 0.108), axis="Z", seg=18)
    for z in (-0.13, 0.13):
        C.cyl("acier", 0.03, 0.03, 0.05, (s * 0.03, 0.222, z), axis="X", seg=14)   # galets porteurs, sur le rail
        C.cyl("acier", 0.018, 0.018, 0.07, (s * 0.078, 0.14, z), axis="Y", seg=12)  # galets de guidage, contre le rail
    C.cyl("metal", 0.055, 0.055, 0.1, (s * 0.15, 0.03, 0.0), axis="Z", seg=16)     # moteurs de translation
    C.cyl("acier", 0.02, 0.02, 0.13, (s * 0.15, 0.03, 0.0), axis="Z", seg=10)
C.box("ambre", (0.36, 0.014, 0.012), (0, -0.045, 0.242))                           # filets de signalisation
C.box("ambre", (0.36, 0.014, 0.012), (0, -0.045, -0.242))
C.box("lueur", (0.1, 0.01, 0.006), (0, 0.035, 0.242))
tour(C, 0, -0.085, 0)
C.lathe("metal", [(0.0, 0.16), (-0.02, 0.165), (-0.035, 0.12), (-0.035, 0.0)], seg=24)  # couronne d'orientation
C.M = M3
for s in (-1, 1):                                                                   # chaîne porte-câbles vers le plafond
    C.rod("cable", (s * 0.19, 0.06, -0.16), (s * 0.24, 0.2, -0.17), 0.018, seg=8)
    C.rod("cable", (s * 0.24, 0.2, -0.17), (s * 0.25, 0.34, -0.12), 0.018, seg=8)
chariot = finish(C, "chariot")

# --- bras1 : de l'épaule (origine) au coude (0, -1,3, 0)
A = new()
A.cyl("metal", 0.09, 0.09, 0.126, (0, 0, 0), axis="Z", seg=22)                     # tambour de l'épaule
A.cyl("acier", 0.05, 0.05, 0.15, (0, 0, 0), axis="Z", seg=16)
for s in (-1, 1):
    A.box("coque", (0.062, 1.16, 0.022), (0, -0.66, s * 0.05))                      # longerons
    A.box("lueur", (0.012, 0.42, 0.004), (0, -0.62, s * 0.0625))                    # filet lumineux
    A.box("coque", (0.085, 0.16, 0.022), (0, -1.25, s * 0.058))                     # chape du coude
    for y in (-0.22, -0.52, -0.82, -1.08):
        A.box("metal", (0.068, 0.045, 0.026), (0, y, s * 0.05))                     # éclisses
A.box("metal", (0.03, 1.0, 0.078), (0, -0.62, 0))                                   # âme
for y in (-0.3, -0.62, -0.94):
    A.cyl("metal", 0.016, 0.016, 0.1, (0, y, 0), axis="Z", seg=10)                  # entretoises
A.cyl("metal", 0.026, 0.026, 0.46, (0.062, -0.4, 0), axis="Y", seg=12)             # vérin : corps…
A.cyl("acier", 0.013, 0.013, 0.5, (0.062, -0.86, 0), axis="Y", seg=10)             # … et tige
A.box("metal", (0.05, 0.05, 0.04), (0.045, -0.16, 0))
A.box("metal", (0.05, 0.05, 0.04), (0.045, -1.1, 0))
for s in (-1, 1):                                                                    # torons de câbles, au dos
    A.rod("cable", (-0.05, -0.1, s * 0.018), (-0.055, -1.2, s * 0.018), 0.011, seg=6)
for y in (-0.3, -0.6, -0.9, -1.15):
    A.box("metal", (0.02, 0.022, 0.07), (-0.05, y, 0))                              # colliers
A.box("ambre", (0.004, 0.05, 0.03), (0.0325, -0.2, 0))                              # plaque d'identification
bras1 = finish(A, "bras1")

# --- bras2 : du coude (origine) au poignet (0, -1,3, 0)
B = new()
B.cyl("metal", 0.078, 0.078, 0.092, (0, 0, 0), axis="Z", seg=20)
B.cyl("acier", 0.04, 0.04, 0.14, (0, 0, 0), axis="Z", seg=14)
B.cyl("coque", 0.034, 0.05, 1.12, (0, -0.66, 0), axis="Y", seg=8)                  # fût octogonal, qui s'affine vers le poignet
for y, r in ((-0.18, 0.058), (-0.6, 0.05), (-1.02, 0.043)):
    B.cyl("metal", r, r, 0.05, (0, y, 0), axis="Y", seg=16)                         # bagues
B.rod("acier", (0.056, -0.2, 0), (0.046, -1.0, 0), 0.007, seg=8)                    # tige de commande
B.rod("cable", (-0.055, -0.12, 0.012), (-0.045, -1.14, 0.012), 0.009, seg=6)
B.box("lueur", (0.004, 0.3, 0.012), (0.0, -0.78, 0.044))
for s in (-1, 1):
    B.box("coque", (0.06, 0.12, 0.016), (0, -1.26, s * 0.042))                      # chape du poignet
bras2 = finish(B, "bras2")

# --- outil : tête de relevé (origine sur le poignet, objectif en y = -0,22)
T = new()
T.cyl("metal", 0.05, 0.05, 0.068, (0, 0, 0), axis="Z", seg=18)
T.cyl("acier", 0.026, 0.026, 0.1, (0, 0, 0), axis="Z", seg=12)
tour(T, 0, 0, 0)
T.lathe("metal", [(-0.03, 0.0), (-0.03, 0.04), (-0.1, 0.05), (-0.1, 0.0)], seg=18)                                      # col
T.lathe("coque", [(-0.1, 0.0), (-0.1, 0.07), (-0.12, 0.078), (-0.17, 0.074), (-0.19, 0.06), (-0.19, 0.0)], seg=24)      # boîtier
T.lathe("metal", [(-0.19, 0.0), (-0.19, 0.046), (-0.222, 0.04), (-0.222, 0.03), (-0.205, 0.027), (-0.205, 0.0)], seg=24)  # pare-soleil de l'objectif
T.lathe("verre", [(-0.207, 0.0), (-0.207, 0.027)], seg=20)
T.ring("lueur", 0.064, 0.0045, -0.186, seg=36, tseg=6)                                                                   # couronne d'éclairage
T.M = M3
for i in range(3):                                                                   # trois palpeurs autour de l'objectif
    a = i * 2 * math.pi / 3 + 0.5
    c, s = math.cos(a), math.sin(a)
    T.rod("acier", (c * 0.066, -0.15, s * 0.066), (c * 0.082, -0.25, s * 0.082), 0.006, seg=8)
    T.rod("acier", (c * 0.082, -0.25, s * 0.082), (c * 0.066, -0.31, s * 0.066), 0.005, seg=8)
    T.sphere("metal", 0.009, (c * 0.066, -0.31, s * 0.066), seg=8)
T.box("metal", (0.034, 0.05, 0.05), (0.085, -0.135, 0))                             # caméra latérale
T.cyl("verre", 0.014, 0.014, 0.01, (0.085, -0.163, 0), axis="Y", seg=12)
T.rod("metal", (-0.06, -0.11, 0.03), (-0.1, -0.02, 0.05), 0.003, seg=5)             # antenne
T.sphere("ambre", 0.006, (-0.1, -0.02, 0.05), seg=8)
outil = finish(T, "outil")

# ====================================================================== drone de surveillance (avant vers +z)
ROT = [(sx * 0.215, 0.02, sz * 0.165) for sx in (-1, 1) for sz in (-1, 1)]
D = new()
D.sphere("coque", 0.1, (0, 0, 0), scale=(1.25, 0.6, 1.75), seg=24)                  # fuselage
D.box("metal", (0.13, 0.03, 0.17), (0, 0.055, -0.03))                               # trappe de batterie
D.box("coque", (0.09, 0.012, 0.1), (0, 0.073, -0.03))
for k in range(4):
    D.box("cable", (0.1, 0.006, 0.008), (0, 0.058, -0.155 + k * 0.014), rx(-0.5))   # ouïes arrière
D.cyl("metal", 0.04, 0.034, 0.04, (0, 0, 0.162), axis="Z", seg=18)                 # logement de l'œil
D.cyl("acier", 0.044, 0.044, 0.008, (0, 0, 0.146), axis="Z", seg=18)
D.sphere("metal", 0.052, (0, -0.058, 0.02), scale=(1, 0.8, 1), seg=18)              # tourelle ventrale
tour(D, 0, 0, 0.02)
D.lathe("acier", [(-0.092, 0.0), (-0.092, 0.034), (-0.106, 0.031), (-0.106, 0.022), (-0.098, 0.02), (-0.098, 0.0)], seg=20)
D.lathe("verre", [(-0.099, 0.0), (-0.099, 0.02)], seg=16)
D.M = M3
for x, y, z in ROT:
    sx, sz = (1 if x > 0 else -1), (1 if z > 0 else -1)
    D.rod("coque", (sx * 0.07, 0.012, sz * 0.07), (x, y - 0.012, z), 0.013, seg=8)   # bras
    D.rod("cable", (sx * 0.07, 0.03, sz * 0.06), (x - sx * 0.03, y + 0.006, z - sz * 0.02), 0.004, seg=5)
    tour(D, x, y, z)
    D.ring("coque", 0.088, 0.011, 0.0, seg=32, tseg=8, scale=(2.2, 1, 1))            # carénage (anneau étiré en hauteur)
    D.ring("lueur", 0.0995, 0.0028, 0.012, seg=32, tseg=5)
    D.lathe("metal", [(-0.026, 0.0), (-0.026, 0.017), (0.014, 0.02), (0.022, 0.012), (0.022, 0.0)], seg=12)  # moteur
    D.M = M3
    for i in range(3):
        a = i * 2 * math.pi / 3 + 0.3
        D.rod("metal", (x + math.cos(a) * 0.018, y - 0.016, z + math.sin(a) * 0.018), (x + math.cos(a) * 0.085, y - 0.016, z + math.sin(a) * 0.085), 0.004, seg=5)
for s in (-1, 1):                                                                    # patins
    D.rod("acier", (s * 0.085, -0.115, -0.11), (s * 0.085, -0.115, 0.12), 0.006, seg=6)
    for z in (-0.07, 0.08):
        D.rod("acier", (s * 0.06, -0.04, z), (s * 0.085, -0.115, z), 0.005, seg=6)
D.rod("metal", (-0.05, 0.05, -0.11), (-0.07, 0.24, -0.15), 0.0028, seg=5)           # antenne
D.sphere("ambre", 0.006, (-0.07, 0.24, -0.15), seg=8)
D.box("ambre", (0.05, 0.008, 0.006), (0, 0.012, -0.176))                            # feu arrière
drone = finish(D, "drone")

H = new()                                                                            # une hélice tripale (origine sur le moyeu)
tour(H, 0, 0, 0)
H.lathe("acier", [(0.0, 0.0), (0.0, 0.014), (0.012, 0.011), (0.018, 0.0)], seg=10)
H.M = M3
for i in range(3):
    m = ry(i * 2 * math.pi / 3)
    H.box("metal", (0.062, 0.0028, 0.02), m @ Vector((0.045, 0.004, 0)), m @ rx(0.32))
helice = finish(H, "helice", bevel=False)

# ====================================================================== robot d'entretien (avant vers +x, origine au sol)
WHEELS = [(x, 0.056, s * 0.172) for x in (-0.19, 0.0, 0.19) for s in (-1, 1)]
V = new()
V.box("metal", (0.5, 0.06, 0.25), (0, 0.105, 0))                                    # châssis
V.box("coque", (0.4, 0.065, 0.24), (-0.03, 0.172, 0))                               # capot
V.box("coque", (0.13, 0.05, 0.22), (0.205, 0.158, 0), rz(-0.5))                     # nez incliné
V.box("metal", (0.03, 0.055, 0.31), (0.272, 0.095, 0))                              # pare-chocs
V.box("cable", (0.012, 0.03, 0.3), (0.29, 0.095, 0))
V.box("metal", (0.1, 0.085, 0.2), (-0.245, 0.16, 0))                                # bloc de batterie
V.rod("acier", (-0.285, 0.205, -0.07), (-0.285, 0.235, -0.07), 0.005, seg=6)         # poignée
V.rod("acier", (-0.285, 0.205, 0.07), (-0.285, 0.235, 0.07), 0.005, seg=6)
V.rod("acier", (-0.285, 0.235, -0.07), (-0.285, 0.235, 0.07), 0.005, seg=6)
for s in (-1, 1):
    V.box("ambre", (0.3, 0.008, 0.004), (-0.03, 0.178, s * 0.1215))                 # filets latéraux
    V.rod("metal", (-0.19, 0.056, s * 0.142), (0.0, 0.1, s * 0.142), 0.011, seg=6)   # balanciers de suspension
    V.rod("metal", (0.0, 0.1, s * 0.142), (0.19, 0.056, s * 0.142), 0.011, seg=6)
    V.cyl("acier", 0.016, 0.016, 0.02, (0.0, 0.1, s * 0.142), axis="Z", seg=10)
    for k in range(4):
        V.box("cable", (0.03, 0.004, 0.05), (-0.13 + k * 0.045, 0.2065, s * 0.07))  # ouïes du capot
V.cyl("cable", 0.03, 0.03, 0.3, (0.215, 0.034, 0), axis="Z", seg=12)               # brosse rotative
V.cyl("metal", 0.036, 0.04, 0.016, (0.12, 0.208, 0), axis="Y", seg=14)             # embase du gyrophare
tour(V, -0.08, 0.2, 0)
V.lathe("metal", [(0.0, 0.0), (0.0, 0.05), (0.012, 0.045), (0.012, 0.0)], seg=16)   # embase de la tourelle
V.M = M3
V.rod("metal", (0.02, 0.21, -0.06), (0.1, 0.24, -0.09), 0.008, seg=6)               # bras de prélèvement replié
V.rod("metal", (0.1, 0.24, -0.09), (0.19, 0.21, -0.085), 0.007, seg=6)
V.sphere("acier", 0.011, (0.1, 0.24, -0.09), seg=8)
V.box("acier", (0.03, 0.012, 0.03), (0.2, 0.207, -0.085))
rover = finish(V, "rover")

W = new()                                                                            # une roue (origine sur l'essieu, axe z)
W.cyl("cable", 0.056, 0.056, 0.04, (0, 0, 0), axis="Z", seg=20)
W.cyl("acier", 0.03, 0.03, 0.046, (0, 0, 0), axis="Z", seg=12)
for i in range(10):
    a = i * 2 * math.pi / 10
    W.box("cable", (0.012, 0.008, 0.042), (math.cos(a) * 0.057, math.sin(a) * 0.057, 0), rz(a + math.pi / 2))  # crampons
for i in range(5):
    a = i * 2 * math.pi / 5
    W.sphere("metal", 0.005, (math.cos(a) * 0.018, math.sin(a) * 0.018, 0.0235), seg=6)
    W.sphere("metal", 0.005, (math.cos(a) * 0.018, math.sin(a) * 0.018, -0.0235), seg=6)
roue = finish(W, "roue", bevel=False)

S = new()                                                                            # tourelle de relevé (origine sur son pivot)
S.rod("acier", (0, 0.0, 0), (0, 0.2, 0), 0.008, seg=8)
S.box("metal", (0.085, 0.045, 0.06), (0.01, 0.215, 0))
S.cyl("metal", 0.02, 0.023, 0.03, (0.062, 0.215, 0), axis="X", seg=14)
S.cyl("verre", 0.016, 0.016, 0.004, (0.078, 0.215, 0), axis="X", seg=12)
S.box("lueur", (0.004, 0.006, 0.04), (0.053, 0.237, 0))
S.rod("metal", (-0.02, 0.238, 0.02), (-0.03, 0.3, 0.02), 0.0025, seg=5)
S.sphere("ambre", 0.005, (-0.03, 0.3, 0.02), seg=6)
mat = finish(S, "mat")

objs = [chariot, bras1, bras2, outil, drone, helice, rover, roue, mat]
if "apercu" in sys.argv:  # planche de contrôle : le bras déplié, le drone avec ses hélices, le robot avec ses roues
    import bpy
    put = lambda ob, x, y, z: setattr(ob, "location", M3 @ Vector((x, y, z)))
    put(chariot, -1.2, 2.9, 0); put(bras1, -1.2, 2.78, 0); put(bras2, -1.2, 1.48, 0); put(outil, -1.2, 0.18, 0)
    put(drone, 0.1, 1.5, 0); put(rover, 0.1, 0, 0); put(mat, 0.02, 0.2, 0)
    extra = []
    for x, y, z in ROT:
        c = helice.copy(); bpy.context.scene.collection.objects.link(c); c.location = M3 @ Vector((0.1 + x, 1.5 + y + 0.004, z)); extra.append(c)
    for x, y, z in WHEELS:
        c = roue.copy(); bpy.context.scene.collection.objects.link(c); c.location = M3 @ Vector((0.1 + x, y, z)); extra.append(c)
    helice.location = roue.location = (50, 0, 0)
    preview("robots-apercu.png", (2.6, -3.6, 2.2), (-0.5, 0, 1.45), lens=50, res=(1300, 1100))
    preview("robots-apercu-drone.png", (0.75, -0.7, 1.85), (0.1, 0, 1.47), lens=50, res=(1200, 800))
    preview("robots-apercu-rover.png", (0.9, -0.75, 0.5), (0.1, 0, 0.12), lens=50, res=(1200, 800))
    preview("robots-apercu-outil.png", (-0.6, -0.9, 0.35), (-1.2, 0, 0.05), lens=50, res=(1000, 800))
    for c in extra:
        bpy.data.objects.remove(c)
    for o in objs:
        o.location = (0, 0, 0)
export(objs, "robots.glb")
