"""Reimport the shipped GLB and render it with the Blender source lighting."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'art-source/barbarian/barbarian.blend'))
for ob in list(bpy.data.objects):
    if ob.type in {'MESH', 'EMPTY'}: bpy.data.objects.remove(ob, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(root/'public/models/barbarian/barbarian.glb'))
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
assert len(meshes) > 0
assert any(o.name.startswith('HeadPivot') for o in bpy.context.scene.objects)
assert high[2] - low[2] < 2.4 and high[2] - low[2] > 2.0
assert high[0] - low[0] < 1.8
print(json.dumps({'meshCount':len(meshes), 'bounds': [low, high]}), flush=True)
bpy.context.scene.render.filepath = str(root/'art-source/barbarian/glb-roundtrip.png')
bpy.ops.render.render(write_still=True)
