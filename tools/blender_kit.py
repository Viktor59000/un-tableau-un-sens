"""Outils communs aux scripts Blender du dépôt (arche_blender.py, pont_blender.py, fauteuil_blender.py).

Tout est construit par script, sans fichier source : des volumes simples (boîtes, cylindres, sphères, révolutions, tores)
rangés par matière, assemblés en un objet, puis exportés en glTF. Les matières ne portent qu'un nom et une couleur d'aperçu :
le vrai rendu (tôles, hublots, reflets) est écrit dans app/world.js, qui les reconnaît à leur nom.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "models")
PREVIEW = "apercu" in sys.argv
R = random.uniform
COLORS = {}


def reset(seed, colors):
    """Scène vide, hasard reproductible, une matière par nom."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(seed)
    COLORS.clear()
    COLORS.update(colors)
    for k, v in colors.items():
        bpy.data.materials.new(k).diffuse_color = v


def rot(axis, a):
    return Matrix.Rotation(a, 4, axis)


def move(x, y, z):
    return Matrix.Translation((x, y, z))


class Parts:
    """Un bmesh par matière ; self.M déplace tout ce qu'on ajoute (pour poser un sous-ensemble ailleurs)."""

    def __init__(self):
        self.bm = {k: bmesh.new() for k in COLORS}
        self.M = Matrix.Identity(4)

    def box(self, mat, size, loc, rot=None):
        bm = self.bm[mat]
        r = bmesh.ops.create_cube(bm, size=1.0)
        m = self.M @ Matrix.Translation(loc) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1))
        bmesh.ops.transform(bm, matrix=m, verts=r["verts"])

    def cyl(self, mat, r1, r2, length, loc, axis="X", seg=14, caps=True, rot=None):
        bm = self.bm[mat]
        r = bmesh.ops.create_cone(bm, cap_ends=caps, segments=seg, radius1=r1, radius2=r2, depth=length)
        base = {"X": Matrix.Rotation(math.pi / 2, 4, "Y"), "Y": Matrix.Rotation(-math.pi / 2, 4, "X"), "Z": Matrix.Identity(4)}[axis]
        bmesh.ops.transform(bm, matrix=self.M @ Matrix.Translation(loc) @ (rot or Matrix.Identity(4)) @ base, verts=r["verts"])

    def rod(self, mat, a, b, r, seg=6):
        """Tige entre deux points."""
        a, b = Vector(a), Vector(b)
        d = b - a
        self.cyl(mat, r, r, d.length, (a + b) / 2, axis="Z", seg=seg, rot=d.to_track_quat("Z", "Y").to_matrix().to_4x4())

    def sphere(self, mat, r, loc, scale=(1, 1, 1), seg=14):
        bm = self.bm[mat]
        res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        bmesh.ops.transform(bm, matrix=self.M @ Matrix.Translation(loc) @ Matrix.Diagonal((*scale, 1)), verts=res["verts"])

    def _plates(self, bm, faces, plates, share=0.55):
        pick = [f for f in faces if len(f.verts) == 4 and random.random() < share]
        bmesh.ops.inset_individual(bm, faces=pick, thickness=plates * 0.6, depth=0.0)
        for f in pick:
            bmesh.ops.translate(bm, verts=f.verts, vec=f.normal * plates * R(0.5, 1.4))

    def lathe(self, mat, profile, seg=24, plates=0.0, axis="X"):
        """Révolution d'un profil [(position le long de l'axe, rayon)…] ; plates > 0 : des plaques de blindage ressortent."""
        bm = self.bm[mat]
        put = (lambda x, c, s: (x, c, s)) if axis == "X" else (lambda x, c, s: (c, s, x))
        rings = []
        for x, r in profile:
            rings.append([bm.verts.new(self.M @ Vector(put(x, math.cos(2 * math.pi * j / seg) * r, math.sin(2 * math.pi * j / seg) * r))) for j in range(seg)] if r > 1e-6 else [bm.verts.new(self.M @ Vector(put(x, 0, 0)))])
        faces = []
        for a, b in zip(rings, rings[1:]):
            for j in range(seg):
                k = (j + 1) % seg
                vs = [a[j % len(a)], a[k % len(a)], b[k % len(b)], b[j % len(b)]]
                vs = [v for i, v in enumerate(vs) if v not in vs[:i]]
                if len(vs) >= 3:
                    try:
                        faces.append(bm.faces.new(vs))
                    except ValueError:
                        pass
        if plates:
            self._plates(bm, faces, plates)

    def grid(self, mat, pts, plates=0.0, share=0.55):
        """Nappe : pts[i][j] = point (rangées i, colonnes j)."""
        bm = self.bm[mat]
        vs = [[bm.verts.new(self.M @ Vector(p)) for p in row] for row in pts]
        faces = [bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j])) for i in range(len(vs) - 1) for j in range(len(vs[0]) - 1)]
        if plates:
            self._plates(bm, faces, plates, share)

    def ring(self, mat, radius, tube, x, seg=40, tseg=6, axis="X", scale=(1, 1, 1)):
        bm = self.bm[mat]
        put = (lambda v: Vector((v.x * scale[0], v.y * scale[1], v.z * scale[2]))) if axis == "X" else (lambda v: Vector((v.y * scale[0], v.z * scale[1], v.x * scale[2])))
        rows = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            c = Vector((x, math.cos(a) * radius, math.sin(a) * radius))
            out = Vector((0, math.cos(a), math.sin(a)))
            rows.append([bm.verts.new(self.M @ put(c + (out * math.cos(2 * math.pi * j / tseg) + Vector((1, 0, 0)) * math.sin(2 * math.pi * j / tseg)) * tube)) for j in range(tseg)])
        for i in range(seg):
            for j in range(tseg):
                bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % tseg], rows[i][(j + 1) % tseg]))

    def bevel(self, mat, width, segments=2):
        """Adoucit toutes les arêtes vives d'une matière (pour les objets vus de près)."""
        bm = self.bm[mat]
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(30)]
        bmesh.ops.bevel(bm, geom=edges, offset=width, segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)

    def to_object(self, name, sharp=34):
        me = bpy.data.meshes.new(name)
        out = bmesh.new()
        for mat, bm in self.bm.items():
            if not bm.faces:
                continue
            me.materials.append(bpy.data.materials[mat])
            i = len(me.materials) - 1
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            tmp = bpy.data.meshes.new("t")
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
        me.set_sharp_from_angle(angle=math.radians(sharp))  # arêtes vives pour les volumes, lissage pour les surfaces courbes
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def around(n, radius, phase=0.0):
    """n points sur un cercle du plan YZ : (angle, vecteur)."""
    for i in range(n):
        a = phase + 2 * math.pi * i / n
        yield a, Vector((0, math.cos(a) * radius, math.sin(a) * radius))


def export(objs, name):
    path = os.path.join(OUT, name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_animations=False, export_materials="EXPORT", export_texcoords=False, export_normals=True, export_yup=True)
    print("écrit", name, os.path.getsize(path) // 1024, "Ko,", sum(len(o.data.polygons) for o in objs), "faces")


def decimate(objs, ratio):
    for o in objs:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new("alleger", "DECIMATE")
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)


def preview(name, cam_loc, target, lens=60, res=(1400, 700)):
    """Image de contrôle (moteur Workbench) dans tools/sources/ — à regarder puis supprimer."""
    if not PREVIEW:
        return
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_cavity = True
    sc.display.shading.show_shadows = True
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.lens = lens
    cam.data.clip_end = 2000
    cam.location = cam_loc
    cam.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(ROOT, "tools", "sources", name)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
