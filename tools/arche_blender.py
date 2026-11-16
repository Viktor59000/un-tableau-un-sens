"""Modélise une arche du programme HOPE (les vaisseaux vus par les hublots).

    blender -b --python tools/arche_blender.py            # écrit assets/models/arche.glb et arche-lod.glb
    blender -b --python tools/arche_blender.py -- apercu  # écrit aussi tools/sources/arche-apercu.png

Tout est construit par script, sans fichier source. L'arche mesure 1 unité de long (mise à l'échelle dans app/world.js),
axe le long de X, proue vers +X. Objets exportés : « arche » (structure fixe) et « anneau » (habitat tournant, origine sur
l'axe). Matières, reprises par nom dans le décor : coque, clair, sombre, panneau, moteur, feu_r, feu_v, feu_b.
"""
import math
import os
import random
import sys

import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_kit import Parts, R, around, decimate, export, preview, reset  # noqa: E402

reset(2500, {"coque": (0.6, 0.63, 0.66, 1), "clair": (0.82, 0.83, 0.82, 1), "sombre": (0.2, 0.22, 0.25, 1), "panneau": (0.06, 0.1, 0.2, 1), "moteur": (0.6, 0.85, 1, 1), "feu_r": (1, 0.2, 0.15, 1), "feu_v": (0.2, 0.9, 0.45, 1), "feu_b": (1, 1, 1, 1)})

P = Parts()
rx = lambda a: Matrix.Rotation(a, 4, "X")

# --- épine dorsale et treillis
P.cyl("sombre", 0.0105, 0.0105, 0.8, (-0.03, 0, 0), seg=10)
for a, o in around(4, 0.031, math.pi / 4):
    P.box("sombre", (0.4, 0.0028, 0.0028), Vector((-0.14, 0, 0)) + o)
for i in range(11):
    x = -0.335 + i * 0.039
    P.ring("sombre", 0.031, 0.0016, x, seg=16, tseg=4)
    for a, o in around(4, 0.031, math.pi / 4):  # diagonales du treillis
        b = Vector((0, math.cos(a + math.pi / 2) * 0.031, math.sin(a + math.pi / 2) * 0.031))
        mid, d = (o + b) / 2 + Vector((x + 0.0195, 0, 0)), (b - o) + Vector((0.039, 0, 0))
        if i < 10:
            P.box("sombre", (d.length, 0.0015, 0.0015), mid, d.to_track_quat("X", "Z").to_matrix().to_4x4())

# --- coque avant : fuselage à plaques, ceintures sombres, passerelle, antennes
P.lathe("coque", [(0.02, 0.0), (0.02, 0.033), (0.055, 0.05), (0.1, 0.0545), (0.2, 0.0545), (0.3, 0.052), (0.37, 0.045), (0.43, 0.034), (0.475, 0.019), (0.497, 0.007), (0.5, 0.0)], seg=28, plates=0.0022)
for x, r in ((0.085, 0.0575), (0.205, 0.0575), (0.325, 0.053)):
    P.lathe("sombre", [(x - 0.007, r - 0.004), (x - 0.007, r), (x + 0.007, r), (x + 0.007, r - 0.004)], seg=28)
P.box("coque", (0.07, 0.022, 0.016), (0.3, 0, 0.057))
P.box("clair", (0.04, 0.014, 0.012), (0.315, 0, 0.07))
P.box("sombre", (0.012, 0.02, 0.004), (0.345, 0, 0.066))
for dx, h in ((0.0, 0.05), (0.012, 0.03), (-0.015, 0.022)):
    P.cyl("sombre", 0.0007, 0.0003, h, (0.31 + dx, R(-0.004, 0.004), 0.076 + h / 2), axis="Z", seg=5)
P.cyl("sombre", 0.0009, 0.0002, 0.07, (0.53, 0, 0), seg=5)
P.lathe("clair", [(0.36, 0.0), (0.362, 0.012), (0.368, 0.022), (0.377, 0.028)], seg=18)  # parabole (repositionnée ci-dessous)
bm = P.bm["clair"]
dish = [v for v in bm.verts if 0.359 < v.co.x < 0.378 and v.co.yz.length < 0.03]
bmesh.ops.transform(bm, matrix=Matrix.Translation((0.36, 0, -0.085)) @ Matrix.Rotation(-0.9, 4, "Y") @ Matrix.Translation((-0.36, 0, 0)), verts=dish)
P.cyl("sombre", 0.0014, 0.0014, 0.035, (0.36, 0, -0.068), axis="Z", seg=6)

# --- accastillage : des centaines de petits volumes sur la coque, pour donner l'échelle
for _ in range(520):
    x = R(0.06, 0.42)
    r = 0.0545 if x < 0.3 else 0.0545 - (x - 0.3) / 0.13 * 0.021
    a = R(0, 2 * math.pi)
    s = (R(0.004, 0.02), R(0.003, 0.011), R(0.0012, 0.0045))
    P.box("coque" if random.random() < 0.6 else "sombre", s, Vector((x, math.cos(a) * (r + s[2] / 2), math.sin(a) * (r + s[2] / 2))), rx(a - math.pi / 2))

# --- modules de fret et réservoirs autour de l'épine
for k, x in enumerate((-0.07, -0.135, -0.2, -0.265)):
    for a, o in around(6, 0.052, k * math.pi / 6):
        if k % 2:
            P.sphere("clair", 0.021, Vector((x, 0, 0)) + o, scale=(1.25, 1, 1))
            P.ring("sombre", 0.0212, 0.0011, x, seg=4, tseg=3) if False else None
        else:
            P.cyl("clair", 0.016, 0.016, 0.05, Vector((x, 0, 0)) + o, seg=12)
            P.cyl("sombre", 0.0166, 0.0166, 0.004, Vector((x, 0, 0)) + o, seg=12)
        P.box("sombre", (0.003, 0.003, 0.022), Vector((x, 0, 0)) + o * 0.72, rx(a - math.pi / 2))

# --- radiateurs (arrière) et panneaux solaires (avant) : grandes voilures fines sur leurs bômes
for s in (-1, 1):
    for x, w, d, off in ((-0.15, 0.25, 0.085, 0.092), (-0.15, 0.25, 0.085, 0.185)):
        P.box("panneau", (w, 0.0014, d), (x, 0, s * off))
        for fx in (-w / 2, 0, w / 2):
            P.box("sombre", (0.0024, 0.0028, d), (x + fx, 0, s * off))
        P.box("sombre", (w, 0.0028, 0.0024), (x, 0, s * (off - d / 2)))
    P.box("sombre", (0.004, 0.004, 0.24), (-0.15, 0, s * 0.125))
    P.box("panneau", (0.075, 0.0012, 0.13), (0.255, s * 0.004, s * 0.125))
    P.box("sombre", (0.003, 0.003, 0.075), (0.255, 0, s * 0.09))
    for dz in (-0.043, 0, 0.043):
        P.box("sombre", (0.075, 0.002, 0.0016), (0.255, s * 0.004, s * (0.125 + dz)))

# --- bloc propulseur : cloison, bâti, cinq tuyères et leur lueur
P.lathe("sombre", [(-0.3, 0.0), (-0.3, 0.03), (-0.345, 0.047), (-0.44, 0.051), (-0.468, 0.045), (-0.468, 0.0)], seg=24, plates=0.002)
P.lathe("coque", [(-0.39, 0.0525), (-0.39, 0.056), (-0.375, 0.056), (-0.375, 0.0525)], seg=24)
for a, o in [(0, Vector((0, 0, 0)))] + list(around(4, 0.027, math.pi / 4)):
    c = Vector((-0.495, 0, 0)) + o
    P.cyl("sombre", 0.021, 0.008, 0.055, c, seg=16, caps=False)
    P.cyl("moteur", 0.0195, 0.0195, 0.001, c + Vector((-0.02, 0, 0)), seg=16)
    P.ring("coque", 0.0215, 0.0012, c.x - 0.027, seg=16, tseg=4) if o.length == 0 else None
for a, o in around(8, 0.05):
    P.box("sombre", (0.07, 0.003, 0.003), Vector((-0.43, 0, 0)) + o)

# --- feux de position
P.sphere("feu_r", 0.0032, (0.3, -0.058, 0), seg=6)
P.sphere("feu_v", 0.0032, (0.3, 0.058, 0), seg=6)
P.sphere("feu_b", 0.0032, (-0.3, 0, 0.055), seg=6)
P.sphere("feu_b", 0.0026, (0.498, 0, 0.004), seg=6)
hull = P.to_object("arche")

# --- anneau d'habitat : couronne de modules, tube de liaison, six rayons carénés
A = Parts()
RX, RR = 0.2, 0.136
A.ring("coque", RR, 0.0065, RX, seg=56, tseg=6)
for i, (a, o) in enumerate(around(28, RR)):
    w = 0.024 if i % 2 else 0.017
    A.box("coque" if i % 4 else "clair", (0.03 if i % 2 else 0.022, 0.026, w), Vector((RX, 0, 0)) + o, rx(a - math.pi / 2))
    if i % 2:
        A.box("sombre", (0.012, 0.012, 0.004), Vector((RX + R(-0.008, 0.008), 0, 0)) + o * (1 + (w / 2 + 0.002) / RR), rx(a - math.pi / 2))
for a, o in around(6, RR / 2 + 0.028):
    A.box("sombre", (0.006, 0.0045, RR - 0.058), Vector((RX, 0, 0)) + o, rx(a - math.pi / 2))
    A.box("coque", (0.014, 0.008, 0.03), Vector((RX, 0, 0)) + o * 0.55, rx(a - math.pi / 2))
A.lathe("coque", [(RX - 0.02, 0.0575), (RX - 0.02, 0.063), (RX + 0.02, 0.063), (RX + 0.02, 0.0575)], seg=28)
ring = A.to_object("anneau")
for v in ring.data.vertices:
    v.co.x -= RX
ring.location = (RX, 0, 0)


preview("arche-apercu.png", (0.55, -1.15, 0.42), (0.02, 0, -0.01))
export([hull, ring], "arche.glb")
decimate([hull, ring], 0.22)  # version allégée, pour les arches lointaines et les téléphones
export([hull, ring], "arche-lod.glb")
