"""Fabrique les versions allégées des dormeurs, affichées au-delà de quelques mètres (là où la différence ne se voit plus).

    blender -b --python tools/lod_blender.py

Part des modèles déjà exportés (assets/models/dormeuse.glb, dormeur.glb : environ 10 600 triangles chacun) et écrit
dormeuse-lod.glb et dormeur-lod.glb (environ 2 400 triangles). À relancer après tools/humains_blender.py.
Le décor (app/world.js) choisit pour chaque dormeur, à chaque image, le modèle complet ou allégé selon sa distance.
"""
import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "models")
RATIO = {"peau": 0.3, "combinaison": 0.2}  # le visage et les mains gardent un peu plus de matière

for name in ("dormeuse", "dormeur"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, name + ".glb"))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    before = sum(len(o.data.polygons) for o in meshes)
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        mat = o.data.materials[0].name if o.data.materials else ""
        mod = o.modifiers.new("alleger", "DECIMATE")
        mod.ratio = RATIO.get(mat.split(".")[0], 0.22)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, name + "-lod.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_animations=False, export_materials="EXPORT", export_texcoords=False, export_normals=True, export_yup=True)
    after = sum(len(o.data.polygons) for o in meshes)
    print("écrit", name + "-lod.glb", os.path.getsize(path) // 1024, "Ko :", before, "→", after, "faces")
