"""Chevelure de Gladys : un carré à frange fait de mèches, à la place de la coque moulée.

    blender -b --python tools/cheveux_blender.py            # écrit assets/models/gladys-cheveux.glb
    blender -b --python tools/cheveux_blender.py -- apercu  # écrit aussi tools/sources/cheveux-*.png

Entrée : assets/models/gladys.glb (seul le maillage « visage » sert, comme surface de collision).
Chaque mèche naît sur le cuir chevelu, part du tourbillon du sommet du crâne, glisse sur la tête sous l'effet de la gravité,
puis tombe librement jusqu'à la ligne de coupe : frange au-dessus des sourcils, mèches qui encadrent le visage, carré à la mâchoire.
Deux couches : des rubans larges et opaques au ras du crâne (le fond, pour qu'on ne voie jamais la peau entre deux mèches) et des
mèches fines par-dessus (la matière : app/gladys.js y dessine les cheveux un à un et effile les pointes).

Sortie : un maillage « chevelure ». TEXCOORD_0 = (travers de la mèche 0…1, longueur 0 = racine … 1 = pointe),
TEXCOORD_1 = (nombre au hasard propre à la mèche, couche : 0 = fond, 1 = mèche).

Repère de travail = celui du fichier glTF (x vers sa gauche, y vers le haut, z vers l'avant, origine au centre de la tête).
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = "apercu" in sys.argv
random.seed(7)
sm = lambda a, b, x: (lambda k: k * k * (3 - 2 * k))(min(1.0, max(0.0, (x - a) / (b - a))))
g2b = lambda v: Vector((v.x, -v.z, v.y))  # repère glTF -> repère Blender

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "assets", "models", "gladys.glb"))
SCENE = bpy.context.scene
verts, polys, head_objs = [], [], []
for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
    head_objs.append(ob)
    me, mw = ob.data, ob.matrix_world
    base = len(verts)
    verts += [(lambda p: Vector((p.x, p.z, -p.y)))(mw @ v.co) for v in me.vertices]  # Blender -> glTF
    for p in me.polygons:
        if me.materials[p.material_index].name.startswith("visage"):
            polys.append([base + i for i in p.vertices])
bvh = BVHTree.FromPolygons(verts, polys)
G = Vector((0, -1, 0))
AXZ = -0.012  # l'axe vertical de la tête passe un peu en arrière de son centre


def skin_r(p):
    """Distance, depuis le centre, de la peau dans la direction de p (rayon lancé de l'extérieur : on touche la surface visible)."""
    d = p.normalized()
    hit = bvh.ray_cast(d * 0.5, -d)[0]
    return hit.length if hit else 0.0


def skin_h(p):
    """À la hauteur de p : axe, direction horizontale vers p, et distance de la peau sur cette horizontale."""
    ax = Vector((0, p.y, AXZ))
    d = Vector((p.x, 0, p.z - AXZ))
    d.normalize()
    hit = bvh.ray_cast(ax + d * 0.5, -d)[0]
    return ax, d, ((hit - ax).length if hit else 0.0)


def push(p, off):
    """Ramène p à `off` au-dessus de la peau s'il est dessous. Sur le crâne on mesure depuis le centre, plus bas depuis l'axe.
    Renvoie (point, normale sortante, en contact ?)."""
    w = sm(-0.05, -0.008, p.y)
    qr, nr, cr = p, p.normalized(), False
    if w > 0:
        need = skin_r(p) + off
        if p.length < need:
            qr, cr = p.normalized() * need, True
    ax, d, rh = skin_h(p)
    qh, ch = p, False
    if w < 1 and (p - ax).length < rh + off:
        qh, ch = ax + d * (rh + off), True
    return qr.lerp(qh, 1 - w), nr.lerp(d, 1 - w).normalized(), (cr if w > 0.5 else ch)


def cut_y(p, jit):
    """Hauteur de la coupe selon l'azimut : frange, mèches du visage, carré plus court sur la nuque."""
    f = abs(math.degrees(math.atan2(p.x, p.z)))
    fringe = 0.013 - 0.007 * (min(f, 34) / 34) ** 2
    side = -0.114 + 0.014 * sm(95, 150, f)
    return fringe + (side - fringe) * sm(30, 60, f) + jit * (0.35 + 0.65 * sm(30, 60, f))


def scalp(d):
    """La direction d porte-t-elle des cheveux ? (angle depuis la verticale borné selon l'azimut : 54° devant, 104° sur les côtés et la nuque)"""
    a = math.degrees(math.acos(max(-1, min(1, d.y))))
    fr = d.z / max(1e-6, math.hypot(d.x, d.z))
    return a <= 54 + 50 * (1 - sm(0.1, 0.62, fr)) + 8 * sm(-0.3, -0.9, fr)


WHORL = Vector((0.018, 1, -0.3)).normalized()  # le tourbillon : en arrière du sommet, un peu à sa gauche
WHORL = WHORL * skin_r(WHORL)


def strand(d, off, jit, wave):
    """Trace une mèche depuis la racine de direction d. Renvoie [(point, normale)]."""
    root = d * (skin_r(d) + off * 0.35)
    n = d.copy()
    v = root - WHORL
    v -= n * v.dot(n)
    if v.length < 1e-4:
        v = Vector((random.uniform(-1, 1), 0, random.uniform(-1, 1)))
    v.normalize()
    p, pts, ds, ph = root, [(root, n)], 0.005, random.uniform(0, 6.28)
    for k in range(90):
        side = v.cross(n)
        v = (v + G * 0.34 + side * wave * math.sin(k * 0.55 + ph)).normalized()
        remain = p.y - cut_y(p, jit)
        if remain < 0.035 and p.y < -0.04:  # les pointes du carré rentrent vers le cou
            ax, dh, _ = skin_h(p)
            v = (v - dh * 0.1 * (1 - remain / 0.035)).normalized()
        o = off * (0.35 + 0.65 * sm(0, 4, k))  # la mèche décolle du crâne sur ses premiers centimètres
        q, n, hit = push(p + v * ds, o)
        if hit:  # en contact : on glisse sur la peau, à pas constant
            t = q - p
            if t.length > 1e-6:
                q, n, hit = push(p + t.normalized() * ds, o)
        v = (q - p).normalized() if (q - p).length > 1e-6 else v
        p = q
        pts.append((p, n))
        if p.y <= cut_y(p, jit):
            break
    return pts


def roots(count):
    """Directions réparties régulièrement (spirale dorée) sur la calotte qui porte des cheveux."""
    out, i, ga = [], 0, math.pi * (3 - math.sqrt(5))
    total = int(count * 2.1)
    while len(out) < count and i < total * 3:
        y = 1 - (i + 0.5) / total * 1.42  # jusqu'à ~115° de la verticale
        i += 1
        if y < -0.42:
            break
        r = math.sqrt(max(0, 1 - y * y))
        d = Vector((math.cos(ga * i) * r, y, math.sin(ga * i) * r))
        if scalp(d):
            out.append(d)
    return out


bm = bmesh.new()
uv0, uv1 = bm.loops.layers.uv.new("UVMap"), bm.loops.layers.uv.new("aux")


def card(pts, width, layer, rnd, step):
    """Un ruban le long de la mèche, effilé vers la pointe (deux sommets en travers : c'est la matière qui le bombe)."""
    pts = pts[:-1:step] + [pts[-1]]
    if len(pts) < 3:
        return
    rows, L = [], len(pts) - 1
    for i, (p, n) in enumerate(pts):
        t = (pts[min(i + 1, L)][0] - pts[max(i - 1, 0)][0]).normalized()
        s = t.cross(n)
        if s.length < 1e-6:
            s = Vector((1, 0, 0))
        s.normalize()
        k = i / L
        w = width * (0.55 + 0.45 * sm(0, 0.12, k)) * (1 - 0.5 * sm(0.6, 1, k) * layer)
        rows.append([bm.verts.new(g2b(p - s * w / 2)), bm.verts.new(g2b(p + s * w / 2))])
    for i in range(L):
        for a in range(1):
            quad = (rows[i][a], rows[i][a + 1], rows[i + 1][a + 1], rows[i + 1][a])
            try:
                f = bm.faces.new(quad)
            except ValueError:
                continue
            f.smooth = True
            for lp, (ii, aa) in zip(f.loops, ((i, a), (i, a + 1), (i + 1, a + 1), (i + 1, a))):
                lp[uv0].uv = (aa, 1 - ii / L)      # l'export retourne l'axe v : on l'écrit à l'envers pour le retrouver droit
                lp[uv1].uv = (rnd, 1 - layer)


stats = [0, 0]
for d in roots(300):   # le fond : rubans larges, au ras du crâne
    pts = strand(d, 0.0045, random.uniform(0.003, 0.012), 0.0)  # un peu plus court que les mèches : ce sont elles qui dessinent le bord
    card(pts, 0.019, 0, random.random(), 3); stats[0] += 1
for d in roots(620):   # les mèches
    pts = strand(d, random.uniform(0.0065, 0.013), random.uniform(-0.007, 0.005), random.uniform(0.02, 0.07))
    card(pts, random.uniform(0.006, 0.0105), 1, random.random(), 2); stats[1] += 1
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("chevelure")
bm.to_mesh(me)
print("CHEVEUX fond %d mèches %d sommets %d faces %d" % (stats[0], stats[1], len(bm.verts), len(bm.faces)))
bm.free()
mat = bpy.data.materials.new("chevelure")
mat.diffuse_color = (0.05, 0.06, 0.08, 1)
me.materials.append(mat)
hair = bpy.data.objects.new("chevelure", me)
SCENE.collection.objects.link(hair)

if PREVIEW:
    SCENE.render.engine = "BLENDER_WORKBENCH"
    SCENE.render.resolution_x, SCENE.render.resolution_y = 760, 760
    SCENE.display.shading.light = "STUDIO"
    SCENE.display.shading.color_type = "MATERIAL"
    SCENE.display.shading.show_cavity = True
    SCENE.display.shading.show_backface_culling = False
    for ob in head_objs:
        for m in ob.data.materials:
            if m.name.startswith("chevelure"):
                m.diffuse_color = (0.8, 0.8, 0.8, 0)
                m.blend_method = "BLEND" if hasattr(m, "blend_method") else m.blend_method
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    SCENE.collection.objects.link(cam)
    SCENE.camera = cam
    cam.data.lens = 85
    for name, pos in (("face", (0, 0.0, 0.95)), ("trois-quarts", (0.62, 0.06, 0.72)), ("profil", (0.95, 0.02, 0.0)), ("dos", (0.25, 0.1, -0.92))):
        cp, tg = g2b(Vector(pos)), g2b(Vector((0, -0.03, 0)))
        cam.location = cp
        cam.rotation_euler = (tg - cp).to_track_quat("-Z", "Y").to_euler()
        SCENE.render.filepath = os.path.join(ROOT, "tools", "sources", "cheveux-" + name + ".png")
        bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action="DESELECT")
hair.select_set(True)
bpy.context.view_layer.objects.active = hair
out = os.path.join(ROOT, "assets", "models", "gladys-cheveux.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_animations=False, export_skins=False,
                          export_materials="EXPORT", export_texcoords=True, export_normals=True, export_yup=True)
print("écrit", out, os.path.getsize(out) // 1024, "Ko")
