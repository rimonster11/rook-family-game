"""Render actual Three.js avatar meshes exported by preview-avatars.mjs."""
import bpy,json,tempfile,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
data=json.loads((Path(tempfile.gettempdir())/'rook-avatar-preview-meshes.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.2,.2,.2);scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
materials={}
for i,item in enumerate(data):
    dx=(i%3-1)*1.65; dz=(1-i//3)*2.4
    for n,part in enumerate(item['meshes']):
        key=str([part['color'],part['roughness'],part['metalness']])
        if key not in materials:
            mat=bpy.data.materials.new('Avatar material');mat.use_nodes=True
            shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*part['color'],1)
            shader.inputs['Roughness'].default_value=part['roughness'];shader.inputs['Metallic'].default_value=part['metalness']
            materials[key]=mat
        mesh=bpy.data.meshes.new(part['name'] or 'Avatar mesh')
        idx=part['indices'];faces=[idx[j:j+3] for j in range(0,len(idx),3)]
        mesh.from_pydata([(x+dx,y,z+dz) for x,y,z in part['points']],[],faces);mesh.update()
        obj=bpy.data.objects.new(part['name'] or 'Avatar mesh',mesh);scene.collection.objects.link(obj);obj.data.materials.append(materials[key])
        for p in mesh.polygons:p.use_smooth=True
    text=bpy.data.curves.new('Caption','FONT');text.body=item['label'];text.align_x='CENTER';text.size=.13
    obj=bpy.data.objects.new('Caption',text);scene.collection.objects.link(obj);obj.location=(dx,-.1,dz-.61);obj.rotation_euler=(1.5708,0,0)
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((-3,-4,6),700,5),((4,-3,3),400,5),((0,3,5),800,4)]:
    light=bpy.data.lights.new('Softbox','AREA');light.energy=power;light.size=size
    obj=bpy.data.objects.new('Softbox',light);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,1.7))
cam=bpy.data.cameras.new('Camera');obj=bpy.data.objects.new('Camera',cam);scene.collection.objects.link(obj)
obj.location=(0,-10,1.8);aim(obj,(0,0,1.8));cam.type='ORTHO';cam.ortho_scale=6.0;scene.camera=obj
output=root/('art-source/melissa/character-lineup.png' if '--melissa' in sys.argv else 'art-source/avatars/character-lineup.png')
output.parent.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(output);bpy.ops.render.render(write_still=True)
