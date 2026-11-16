"""Prépare les humains de l'expérience à partir des « Human Base Meshes » de la Blender Foundation (CC0).

    blender -b --python tools/humains_blender.py            # écrit les trois modèles
    blender -b --python tools/humains_blender.py -- apercu  # écrit aussi des images de contrôle dans tools/sources/

Source (non versionnée, 50 Mo) : tools/sources/human-base-meshes/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend
  https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip

Sorties :
  assets/models/gladys.glb    buste de femme pour le portrait d'appel : « visage », « yeux », « chevelure » ; origine au centre de la tête
  assets/models/dormeuse.glb  dormeurs en stase, allongés sur le dos dans le repère du caisson : tête vers -X, dos à y = 0, base du cou
  assets/models/dormeur.glb   à l'origine. Matières : « peau », « combinaison », « bonnet », « bandeau », « port », « temoin », « cable »

Le lot n'a pas de squelette : les bras, écartés dans la pose d'origine, sont ramenés le long du corps par une rotation
autour de l'épaule. Le bonnet, le bandeau et la chevelure sont moulés sur le crâne par lancer de rayons.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "sources", "human-base-meshes", "human-base-meshes-bundle-v1.4.1", "human_base_meshes_bundle.blend")
OUT = os.path.join(ROOT, "assets", "models")
PREVIEW = "apercu" in sys.argv
sm = lambda a, b, x: (lambda k: k * k * (3 - 2 * k))(min(1.0, max(0.0, (x - a) / (b - a))))

bpy.ops.wm.open_mainfile(filepath=SRC)
SCENE = bpy.context.scene


def body_bmesh(name, level):
    """Le corps évalué au niveau de subdivision demandé, recentré en x, plus ses yeux."""
    o = bpy.data.objects[name]
    next(m for m in o.modifiers if m.type == "MULTIRES").levels = level
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    bm.from_mesh(o.evaluated_get(dg).to_mesh())
    bm.transform(o.matrix_world)
    cx = sum(v.co.x for v in bm.verts) / len(bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((-cx, 0, 0)))
    eyes = []
    for c in o.children:
        if ".eye." in c.name:
            e = bmesh.new()
            e.from_mesh(c.data)
            e.transform(c.matrix_world)
            bmesh.ops.translate(e, verts=e.verts, vec=Vector((-cx, 0, 0)))
            eyes.append(e)
    bm.normal_update()
    return bm, eyes


def measure(bm):
    """Repères du corps debout : cou (tranche la plus étroite), centre de la tête, hauteur des yeux."""
    top = max(v.co.z for v in bm.verts)
    best = (9, 0)
    z = top - 0.32
    while z < top - 0.12:
        sl = [v.co.x for v in bm.verts if abs(v.co.z - z) < 0.008]
        if sl and max(sl) - min(sl) < best[0]:
            best = (max(sl) - min(sl), z)
        z += 0.005
    neck = best[1]
    head = [v.co for v in bm.verts if v.co.z > neck + 0.03]
    c = Vector((0, (min(p.y for p in head) + max(p.y for p in head)) / 2, (neck + 0.03 + top) / 2 + 0.012))
    return {"top": top, "neck": neck, "c": c, "back": max(v.co.y for v in bm.verts if 0.9 < v.co.z < neck)}


def to_object(name, parts):
    """parts : [(matière, bmesh)] -> un objet, une matière par partie."""
    me = bpy.data.meshes.new(name)
    out = bmesh.new()
    for i, (mat, bm) in enumerate(parts):
        me.materials.append(bpy.data.materials.get(mat) or bpy.data.materials.new(mat))
        tmp = bpy.data.meshes.new("tmp")
        bm.to_mesh(tmp)
        n0 = len(out.faces)
        out.from_mesh(tmp)
        out.faces.ensure_lookup_table()
        for f in out.faces[n0:]:
            f.material_index = i
            f.smooth = True
        bpy.data.meshes.remove(tmp)
    out.to_mesh(me)
    out.free()
    ob = bpy.data.objects.new(name, me)
    SCENE.collection.objects.link(ob)
    return ob


def moulage(bvh, c, alpha_max, vol, nr=22, ns=48, hang=None):
    """Coque moulée sur le crâne : pour chaque direction (alpha depuis la verticale, phi autour, 0 = face),
    un rayon part du centre de la tête ; la coque se pose à `vol` au-dessus de la peau.
    alpha_max(phi) borne la coque ; hang(phi) : longueur qui pend librement sous le crâne (chevelure)."""
    bm = bmesh.new()
    rings = []
    for i in range(nr + 1):
        ring = []
        for j in range(ns):
            phi = 2 * math.pi * j / ns
            fr = math.cos(phi)  # 1 = face, -1 = nuque
            amax = alpha_max(fr)
            a = amax * i / nr
            tip = 1.0
            if hang and a > math.radians(96):  # sous l'équateur du crâne, la matière tombe droit au lieu de suivre le cou
                tip = (a - math.radians(96)) / max(1e-6, amax - math.radians(96))
                a = math.radians(96)
            d = Vector((math.sin(a) * math.sin(phi), -math.sin(a) * math.cos(phi), math.cos(a)))
            hit = bvh.ray_cast(c, d)[0]
            r = (hit - c).length if hit else 0.1
            edge = sm(0.0, 0.16, 1 - i / nr)  # la coque s'amincit vers son bord
            p = c + d * (r + vol(fr, a) * (0.25 + 0.75 * edge))
            if hang and tip < 1.0 or (hang and a >= math.radians(96) and i / nr * amax > math.radians(96)):
                t = min(1.0, max(0.0, tip))
                p = c + d * (r + vol(fr, a)) + Vector((0, 0, -hang(fr) * t)) - Vector((d.x, d.y, 0)) * 0.012 * t * t
            ring.append(bm.verts.new(p))
        rings.append(ring)
    for i in range(nr):
        for j in range(ns):
            a, b, c2, d2 = rings[i][j], rings[i][(j + 1) % ns], rings[i + 1][(j + 1) % ns], rings[i + 1][j]
            if i == 0:
                continue
            try:
                bm.faces.new((a, b, c2, d2))
            except ValueError:
                pass
    cap = bm.verts.new(sum((v.co for v in rings[1]), Vector()) / ns + (rings[0][0].co - c).normalized() * 0.002)
    for j in range(ns):
        bm.faces.new((cap, rings[1][(j + 1) % ns], rings[1][j]))
    bmesh.ops.remove_doubles(bm, verts=[v for r in rings[:1] for v in r], dist=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bandeau(bvh, c, z, half, off=0.004, ang=1.95, n=44):
    """Bandeau de stase : ruban tendu devant les yeux, d'une tempe à l'autre."""
    bm = bmesh.new()
    pts = []
    for j in range(n + 1):
        phi = -ang + 2 * ang * j / n
        d = Vector((math.sin(phi), -math.cos(phi), 0))
        r = max(((bvh.ray_cast(Vector((0, c.y, z + dz)), d)[0] or Vector((0, c.y, z)) + d * 0.08) - Vector((0, c.y, z + dz))).length for dz in (-half, 0, half))
        pts.append((d, r))
    rs = [max(pts[max(0, j - 2):j + 3], key=lambda t: t[1])[1] for j in range(n + 1)]  # tendu par-dessus les orbites
    prev = None
    for (d, _), r in zip(pts, rs):
        k = 0.55 + 0.45 * math.cos(math.asin(max(-1, min(1, d.x))))
        base = Vector((0, c.y, z)) + d * (r + off)
        cur = [bm.verts.new(base + Vector((0, 0, half * k))), bm.verts.new(base + d * 0.004 + Vector((0, 0, half * k * 0.9))), bm.verts.new(base + d * 0.004 - Vector((0, 0, half * k * 0.9))), bm.verts.new(base - Vector((0, 0, half * k)))]
        if prev:
            for a in range(3):
                bm.faces.new((prev[a], cur[a], cur[a + 1], prev[a + 1]))
        prev = cur
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def tube(points, radius, seg=8):
    cu = bpy.data.curves.new("c", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = max(1, seg // 4)
    sp = cu.splines.new("NURBS")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (co[0], co[1], co[2], 1)
    sp.use_endpoint_u = True
    sp.order_u = 3
    sp.resolution_u = 6
    ob = bpy.data.objects.new("c", cu)
    SCENE.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get())))
    bpy.data.objects.remove(ob)
    return bm


def cylinder(p, axis, r, h, seg=14):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    bm.transform(Matrix.Translation(p) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4())
    return bm


def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_animations=False, export_skins=False,
                              export_materials="EXPORT", export_texcoords=False, export_normals=True, export_yup=True)
    print("écrit", path, os.path.getsize(path) // 1024, "Ko")


def render(objs, cam_pos, target, name, lens=70):
    if not PREVIEW:
        return
    for o in bpy.data.objects:
        o.hide_render = o not in objs
    SCENE.render.engine = "BLENDER_WORKBENCH"
    SCENE.render.resolution_x, SCENE.render.resolution_y = 900, 620
    SCENE.display.shading.light = "STUDIO"
    SCENE.display.shading.color_type = "MATERIAL"
    SCENE.display.shading.show_cavity = True
    cam = bpy.data.objects.get("apercu_cam")
    if not cam:
        cam = bpy.data.objects.new("apercu_cam", bpy.data.cameras.new("apercu_cam"))
        SCENE.collection.objects.link(cam)
    SCENE.camera = cam
    cam.data.lens = lens
    cam.location = cam_pos
    cam.rotation_euler = (Vector(target) - Vector(cam_pos)).to_track_quat("-Z", "Y").to_euler()
    SCENE.render.filepath = os.path.join(ROOT, "tools", "sources", name)
    bpy.ops.render.render(write_still=True)


COLORS = {"visage": (0.82, 0.8, 0.78, 1), "yeux": (0.2, 0.75, 0.85, 1), "chevelure": (0.05, 0.06, 0.08, 1), "peau": (0.78, 0.6, 0.5, 1), "combinaison": (0.36, 0.42, 0.5, 1),
          "bonnet": (0.16, 0.19, 0.23, 1), "bandeau": (0.03, 0.035, 0.04, 1), "port": (0.3, 0.32, 0.35, 1), "temoin": (0.3, 0.9, 1, 1), "cable": (0.05, 0.05, 0.06, 1)}
for k, v in COLORS.items():
    bpy.data.materials.new(k).diffuse_color = v

# ============================================================== Gladys : buste, yeux, chevelure
bm, eyes = body_bmesh("GEO-body_female_realistic", 1)
M = measure(bm)
C = M["c"]
bvh = BVHTree.FromBMesh(bm)
prof = {}
for v in bm.verts:  # profil du visage (x proche de 0) : point le plus en avant par hauteur
    if abs(v.co.x) < 0.006 and v.co.z > M["neck"]:
        k = round(v.co.z - C.z, 2)
        prof[k] = min(prof.get(k, 9), v.co.y - C.y)
print("GLADYS cou z=%.3f centre=%s haut=%.3f" % (M["neck"], tuple(round(c, 3) for c in C), M["top"]))
print("GLADYS profil (hauteur: avancée)", {k: round(-v, 3) for k, v in sorted(prof.items())})
print("GLADYS yeux", [tuple(round(c, 3) for c in (sum((v.co for v in e.verts), Vector()) / len(e.verts) - C)) for e in eyes], "rayon", round(max((v.co - sum((w.co for w in eyes[0].verts), Vector()) / len(eyes[0].verts)).length for v in eyes[0].verts), 4))
bmesh.ops.delete(bm, geom=[f for f in bm.faces if min(v.co.z for v in f.verts) < M["neck"] - 0.2], context="FACES")
# chevelure : carré court, raie au milieu — dégage le front, couvre les oreilles et la nuque
hair = moulage(bvh, C, lambda fr: math.radians(50 + 96 * sm(0.62, 0.1, fr)), lambda fr, a: 0.011 + 0.008 * sm(0.6, -0.4, fr), nr=30, ns=64, hang=lambda fr: 0.075 * sm(0.5, -0.2, fr) + 0.02)
ey = bmesh.new()
for e in eyes:
    tmp = bpy.data.meshes.new("t")
    e.to_mesh(tmp)
    ey.from_mesh(tmp)
for b in (bm, hair, ey):
    bmesh.ops.translate(b, verts=b.verts, vec=-C)
gl = to_object("gladys", [("visage", bm), ("yeux", ey), ("chevelure", hair)])
render([gl], (0, -0.95, 0.02), (0, 0, -0.02), "gladys-face.png", 85)
render([gl], (0.6, -0.78, 0.05), (0, 0, -0.02), "gladys-trois-quarts.png", 85)
render([gl], (0.95, 0.1, 0.03), (0, 0, -0.02), "gladys-profil.png", 85)
export([gl], os.path.join(OUT, "gladys.glb"))

# ============================================================== dormeurs : corps allongé, bras le long du corps, équipement de stase
for src, out, angle in (("GEO-body_female_realistic", "dormeuse", 15.0), ("GEO-body_male_realistic", "dormeur", 14.0)):
    bm, eyes = body_bmesh(src, 1)
    M = measure(bm)
    C, neck = M["c"], M["neck"]
    # 1. les bras : sous l'aisselle un vide sépare le bras du flanc (on coupe au milieu) ; au-dessus, la rotation se fond dans l'épaule
    gaps, z = {}, 0.55
    while z < neck:
        xs = sorted(abs(v.co.x) for v in bm.verts if abs(v.co.z - z) < 0.01)
        g = max(((b - a, (a + b) / 2) for a, b in zip(xs, xs[1:]) if a > 0.08), default=(0, 0))
        if g[0] > 0.012:
            gaps[round(z, 2)] = g[1]
        z += 0.01
    armpit = max(gaps)
    sx = gaps[armpit]
    pivot_z = armpit + 0.085
    for v in bm.verts:
        ax, z = abs(v.co.x), v.co.z
        if z < 0.5:
            continue
        if z <= armpit:
            w = 1.0 if ax > gaps.get(round(z, 2), gaps[min(gaps, key=lambda k: abs(k - z))]) else 0.0
        else:
            w = sm(sx - 0.035, sx + 0.03, ax) * sm(pivot_z + 0.05, pivot_z - 0.02, z) + sm(sx + 0.0, sx + 0.05, ax) * sm(pivot_z - 0.02, pivot_z + 0.05, z) * 0.4
        if w > 0:
            s = 1 if v.co.x > 0 else -1
            piv = Vector((s * (sx - 0.012), v.co.y, pivot_z))
            v.co = piv + Matrix.Rotation(math.radians(s * angle * w), 3, "Y") @ (v.co - piv)
    bm.normal_update()
    wrist_z = min(gaps) + (armpit - min(gaps)) * 0.2
    hands = [v for v in bm.verts if v.co.z < wrist_z + 0.02 and abs(v.co.x) > gaps[min(gaps)] - 0.06 and v.co.z > 0.5]
    hand_z = max(v.co.z for v in hands) - 0.045 if hands else 0
    # 2. peau (tête, cou, mains) et combinaison
    skin, suit = bmesh.new(), bmesh.new()
    vm = ({}, {})
    for f in bm.faces:
        ce = f.calc_center_median()
        is_skin = ce.z > neck - 0.012 or (0.5 < ce.z < hand_z and abs(ce.x) > 0.16)
        tgt, m = (skin, vm[0]) if is_skin else (suit, vm[1])
        vs = []
        for v in f.verts:
            if v.index not in m:
                m[v.index] = tgt.verts.new(v.co)
            vs.append(m[v.index])
        tgt.faces.new(vs)
    # 3. équipement de stase, moulé sur la tête
    bvh = BVHTree.FromBMesh(bm)
    eye_z = sum(v.co.z for e in eyes for v in e.verts) / sum(len(e.verts) for e in eyes)
    cap = moulage(bvh, C, lambda fr: math.radians(58 + 44 * sm(0.55, 0.0, fr)), lambda fr, a: 0.006, nr=14, ns=36)
    band = bandeau(bvh, C, eye_z, 0.026)
    collar = bandeau(bvh, C, neck - 0.006, 0.016, off=0.003, ang=math.pi, n=40)  # col de la combinaison : cache le raccord avec la peau
    side = Vector((1, 0, 0))
    hit = bvh.ray_cast(Vector((0, C.y + 0.02, neck + 0.012)), side)[0]
    port = cylinder(hit + side * 0.004, side, 0.011, 0.012)
    led = cylinder(hit + side * 0.0105, side, 0.0075, 0.002)
    led2 = cylinder(Vector((0, C.y, eye_z)) + Vector((math.sin(1.35), -math.cos(1.35), 0)) * 0.085, Vector((math.sin(1.35), -math.cos(1.35), 0)), 0.004, 0.004, 8)
    cable = tube([hit + side * 0.01, hit + side * 0.06, Vector((hit.x + 0.1, M["back"] - 0.02, neck + 0.03)), Vector((hit.x + 0.14, M["back"] - 0.006, neck + 0.12)), Vector((hit.x + 0.13, M["back"] - 0.006, M["top"] + 0.06)), Vector((hit.x + 0.1, M["back"] - 0.006, M["top"] + 0.2))], 0.0045)
    ob = to_object(out, [("peau", skin), ("combinaison", suit), ("bonnet", cap), ("bandeau", band), ("bandeau", collar), ("port", port), ("temoin", led), ("temoin", led2), ("cable", cable)])
    # 4. allègement, puis passage dans le repère du caisson
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new("alleger", "DECIMATE")
    mod.ratio = 0.17
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in ob.data.polygons:
        p.use_smooth = True
    render([ob], (0.9, -1.6, neck + 0.1), (0, 0, neck - 0.25), out + "-debout.png", 50)
    render([ob], (0.25, -0.5, neck + 0.2), (0, C.y, C.z - 0.03), out + "-tete.png", 60)
    back = M["back"]
    for v in ob.data.vertices:  # (x, y, z) debout -> glTF (X = -(z - cou), Y = dos - y, Z = -x), écrit dans le repère Blender (X, -Z, Y)
        x, y, z = v.co
        v.co = (-(z - neck), x, back - y)
    ob.data.update()
    print(out.upper(), "faces", len(ob.data.polygons), "cou", round(neck, 3), "aisselle", round(armpit, 3), "taille", round(M["top"], 3), "tête (repère caisson) x=%.3f y=%.3f" % (-(C.z - neck), back - C.y))
    export([ob], os.path.join(OUT, out + ".glb"))


# ============================================================== le corps du visiteur, vu à la première personne
# Le lot n'a pas de squelette : on découpe le corps en segments rigides (torse, bras, avant-bras, cuisses, jambes), chacun
# avec son origine sur l'articulation, et on cache les raccords sous des coques de combinaison (épaules, coudes, hanches, genoux).
# Hiérarchie exportée : corps > torse > bras_haut_g > avant_bras_g, … > cuisse_g > jambe_g. La tête est retirée (c'est la caméra).
bm, eyes = body_bmesh("GEO-body_male_realistic", 1)
M = measure(bm)
C, neck, H = M["c"], M["neck"], M["top"]
bvh = BVHTree.FromBMesh(bm)
ys = [v.co.y for v in bm.verts if 0.86 < v.co.z < 0.98 and abs(v.co.x) < 0.2]
yc = (min(ys) + max(ys)) / 2  # axe du bassin
crotch = bvh.ray_cast(Vector((0, yc, 0.25)), Vector((0, 0, 1)))[0].z  # un rayon qui monte entre les jambes s'arrête à l'entrejambe


def detached(v):
    """Vrai si, depuis l'intérieur de la chair en ce sommet, on ressort du corps avant d'atteindre son axe : c'est un membre."""
    s = 1 if v.co.x > 0 else -1
    p = v.co - v.normal * 0.006
    hit = bvh.ray_cast(p, Vector((-s, 0, 0)))[0]
    return hit is not None and (p - hit).length < abs(p.x) - 0.025


flag = {v.index: detached(v) and abs(v.co.x) > 0.155 and (v.co.z > crotch + 0.04 or abs(v.co.x) > 0.26) and v.co.z > 0.5 for v in bm.verts}
armpit = max(v.co.z for v in bm.verts if flag[v.index])
sx = min(abs(v.co.x) for v in bm.verts if flag[v.index] and v.co.z > armpit - 0.03)
pivot_z = armpit + 0.085
arm = {}
for v in bm.verts:  # même abaissement des bras que pour les dormeurs ; on retient à quel bras appartient chaque sommet
    ax, z = abs(v.co.x), v.co.z
    ax0 = ax
    w = 0.0
    if z <= armpit:
        w = 1.0 if flag[v.index] else 0.0
    elif z < neck:
        w = sm(sx - 0.035, sx + 0.03, ax) * sm(pivot_z + 0.05, pivot_z - 0.02, z) + sm(sx + 0.0, sx + 0.05, ax) * sm(pivot_z - 0.02, pivot_z + 0.05, z) * 0.4
    s = 1 if v.co.x > 0 else -1
    if w > 0:
        piv = Vector((s * (sx - 0.012), v.co.y, pivot_z))
        v.co = piv + Matrix.Rotation(math.radians(s * 14.0 * w), 3, "Y") @ (v.co - piv)
    arm[v.index] = s if (flag[v.index] if z <= armpit else (ax0 > sx + 0.03 and z < neck - 0.02)) else 0  # au-dessus de l'aisselle : coupe nette, par un plan vertical dans l'épaule
eye_z = sum(v.co.z for e in eyes for v in e.verts) / sum(len(e.verts) for e in eyes)
eye_y = sum(v.co.y for e in eyes for v in e.verts) / sum(len(e.verts) for e in eyes)
knee_z, hip_z, hip_x = 0.287 * H, crotch + 0.075, 0.092
J = {}
for s, tag in ((1, "g"), (-1, "d")):
    av = [v.co for v in bm.verts if arm[v.index] == s]
    tip = min(av, key=lambda p: p.z)
    sh = Vector((s * (sx + 0.028), sum(p.y for p in av if p.z > armpit) / max(1, sum(1 for p in av if p.z > armpit)), armpit - 0.012))  # articulation de l'épaule, dans le deltoïde (les bras ont été abaissés)
    d = Vector((tip.x, sh.y, tip.z)) - sh
    L = d.length
    d.normalize()
    J["bras_haut_" + tag] = sh
    J["avant_bras_" + tag] = sh + d * L * 0.41
    J["poignet_" + tag] = sh + d * L * 0.74
    J["cuisse_" + tag] = Vector((s * hip_x, yc, hip_z))
    kv = [v.co for v in bm.verts if abs(v.co.z - knee_z) < 0.03 and v.co.x * s > 0.02 and not arm[v.index]]
    J["jambe_" + tag] = Vector((sum(p.x for p in kv) / len(kv), (min(p.y for p in kv) + max(p.y for p in kv)) / 2, knee_z))
    J["dir_" + tag] = d
parts = {k: (bmesh.new(), bmesh.new(), {}, {}) for k in ["torse"] + [n + t for n in ("bras_haut_", "avant_bras_", "cuisse_", "jambe_") for t in ("g", "d")]}
for f in bm.faces:
    ce = f.calc_center_median()
    if ce.z > neck - 0.004:
        continue  # la tête : c'est la caméra
    side = max((arm[v.index] for v in f.verts), key=abs)
    skin = False
    if side:
        tag = "g" if side > 0 else "d"
        t = (ce - J["bras_haut_" + tag]).dot(J["dir_" + tag])
        name = ("avant_bras_" if t > (J["avant_bras_" + tag] - J["bras_haut_" + tag]).length else "bras_haut_") + tag
        skin = t > (J["poignet_" + tag] - J["bras_haut_" + tag]).length
    elif ce.z < crotch + 0.01:
        name = ("jambe_" if ce.z < knee_z else "cuisse_") + ("g" if ce.x > 0 else "d")
    else:
        name = "torse"
    suit, sk, m0, m1 = parts[name]
    tgt, m = (sk, m1) if skin else (suit, m0)
    vs = []
    for v in f.verts:
        if v.index not in m:
            m[v.index] = tgt.verts.new(v.co)
        vs.append(m[v.index])
    tgt.faces.new(vs)


def sphere(center, r, sz=1.0):
    b = bmesh.new()
    bmesh.ops.create_uvsphere(b, u_segments=18, v_segments=12, radius=r)
    bmesh.ops.scale(b, verts=b.verts, vec=(1, 1, sz))
    bmesh.ops.translate(b, verts=b.verts, vec=center)
    return b


collar = bandeau(bvh, C, neck - 0.012, 0.02, off=0.004, ang=math.pi, n=40)
cap = bmesh.new()
bmesh.ops.create_circle(cap, cap_ends=True, segments=24, radius=0.075)
bmesh.ops.translate(cap, verts=cap.verts, vec=Vector((0, C.y + 0.03, neck - 0.02)))
PADS = {"bras_haut_": 0.076, "avant_bras_": 0.047, "cuisse_": 0.09, "jambe_": 0.06}
objs = {}
root = bpy.data.objects.new("corps", None)
SCENE.collection.objects.link(root)
for name, (suit, sk, _, _) in parts.items():
    piv = J.get(name, Vector((0, 0, 0)))
    lst = [("combinaison", suit)]
    if len(sk.verts):
        lst.append(("peau", sk))
    ob = to_object(name, lst)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new("alleger", "DECIMATE")
    mod.ratio = 0.5 if name.startswith("avant") else 0.3  # les mains restent fines : on les regarde de près
    bpy.ops.object.modifier_apply(modifier=mod.name)
    extra = [("bandeau", collar), ("combinaison", cap)] if name == "torse" else [("bandeau" if name.startswith(("avant", "jambe")) else "combinaison", sphere(piv, PADS[name[:-1]], 1.15 if name.startswith("cuisse") else 1.0))]
    add = to_object(name + "_x", extra)
    bpy.ops.object.select_all(action="DESELECT")
    add.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    for p in ob.data.polygons:
        p.use_smooth = True
    for v in ob.data.vertices:
        v.co = v.co - piv
    ob.location = piv
    objs[name] = ob
for name, ob in objs.items():
    par = root if name == "torse" else objs["bras_haut_" + name[-1]] if name.startswith("avant_bras") else objs["cuisse_" + name[-1]] if name.startswith("jambe") else objs["torse"]
    ob.parent = par
    if par is not root:
        ob.location = J[name] - J.get(par.name, Vector((0, 0, 0)))
bpy.context.view_layer.update()
render(list(objs.values()), (1.2, -2.6, 1.2), (0, 0, 0.85), "corps-debout.png", 50)
print("CORPS yeux (glTF, m) y=%.3f z=%.3f | taille %.3f | entrejambe %.3f genou %.3f aisselle %.3f | épaule %s coude %s poignet %s hanche %s | faces %d" % (eye_z, -eye_y, H, crotch, knee_z, armpit, tuple(round(c, 3) for c in J["bras_haut_g"]), tuple(round(c, 3) for c in J["avant_bras_g"]), tuple(round(c, 3) for c in J["poignet_g"]), tuple(round(c, 3) for c in J["cuisse_g"]), sum(len(o.data.polygons) for o in objs.values())))
export([root] + list(objs.values()), os.path.join(OUT, "corps.glb"))
