"""Prépare le visiteur animé de la galerie à partir du mannequin Xbot (Mixamo, exemples three.js).

    blender -b --python tools/visiteur_blender.py

Lit tools/sources/Xbot.glb, ne garde que les animations « idle » et « walk », allège le maillage,
puis écrit assets/models/visiteur.glb (squelette + deux animations), chargé par app/galerie.js.
"""
import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "sources", "Xbot.glb")
OUT = os.path.join(ROOT, "assets", "models", "visiteur.glb")
KEEP = {"idle", "walk"}
RATIO = 0.2

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

for act in list(bpy.data.actions):
    if act.name not in KEEP:
        bpy.data.actions.remove(act)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
for o in [o for o in bpy.context.scene.objects if o.type == "MESH" and o not in meshes]:
    bpy.data.objects.remove(o)  # formes d'os créées par l'importeur
for o in meshes:
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("alleger", "DECIMATE")
    mod.ratio = RATIO
    # le modificateur de décimation doit passer avant l'armature pour être appliqué sur la pose de repos
    while o.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("maillage", o.name, len(o.data.polygons), "faces")

# un seul maillage : moins d'appels de rendu
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()

bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
    export_frame_step=2, export_optimize_animation_size=True, export_skins=True,
    export_materials="NONE", export_texcoords=False, export_normals=True, export_yup=True,
)
print("écrit", OUT, os.path.getsize(OUT) // 1024, "Ko")
