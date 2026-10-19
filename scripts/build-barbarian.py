"""Build and render the first Blender Barbarian prototype. Run with Blender -b -P.

The skin is voxel fused and relaxed into continuous surfaces. Hair, leather,
and metal use shaped meshes and embedded image textures. No runtime modeling.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/barbarian'
SOURCE = ROOT / 'art-source/barbarian'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.world.color = (.20, .20, .20)

def linear(c):
    c = c / 255
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def material(name, color, rough=.6, metal=0, texture=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    rgb = tuple(linear(int(color[i:i+2], 16)) for i in (1, 3, 5))
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if texture:
        size = 512
        y, x = np.mgrid[0:size, 0:size].astype(float)
        rng = np.random.default_rng(42)
        noise = rng.normal(0, 1, (size, size))
        if texture == 'hair':
            pat = .08*np.sin(x*.16 + np.sin(y*.014)*2) + .035*np.sin(x*.61) + noise*.012
        elif texture == 'leather':
            pat = noise*.045 + .04*np.sin(x*.05)*np.sin(y*.07) + .015*np.sin(x*1.3)*np.sin(y*1.2)
        elif texture == 'skin':
            pat = noise*.012 + .025*np.sin(x*.025)*np.cos(y*.023)
        else:
            pat = noise*.018 + .025*np.sin(y*.9)
        pixels = np.ones((size, size, 4), dtype=np.float32)
        for k in range(3): pixels[:,:,k] = np.clip((int(color[1+k*2:3+k*2],16)/255)*(1+pat), 0, 1)
        im = bpy.data.images.new(name+'_albedo', width=size, height=size, alpha=False)
        im.colorspace_settings.name = 'sRGB'
        im.pixels.foreach_set(pixels.ravel())
        im.pack()
        node = m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = im
        m.node_tree.links.new(node.outputs['Color'], p.inputs['Base Color'])
    return m

skin = material('Warm skin', '#eab187', .55, texture='skin')
ear = material('Ear warmth', '#c98166', .68)
hair = material('Golden hair', '#efb600', .54, texture='hair')
hair_dark = material('Hair grooves', '#b57815', .55)
leather = material('Worn saddle leather', '#76503a', .84, texture='leather')
leather_dark = material('Leather edges', '#3a2925', .9, texture='leather')
leather_light = material('Leather seams', '#b98c5a', .8)
gold = material('Brass fittings', '#d5a651', .3, .68, 'metal')
steel = material('Brushed steel', '#a8b8c8', .29, .7, 'metal')
steel_edge = material('Steel edge', '#e0e9ed', .23, .75)
white = material('Ivory', '#fff4db', .35)
iris = material('Amber iris', '#736b3e', .35)
pupil = material('Pupils', '#1c1917', .25)
mouth = material('Mouth', '#623325', .8)

def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def finish(obj, name, mat):
    obj.name = name
    if mat: obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth = True
    return obj

def shape(name, loc, scale, mat, power=1, seg=40, rings=24):
    # Superellipsoid surface; exponent below one gives broad planes and rounded corners.
    verts=[]; faces=[]
    def sp(v): return math.copysign(abs(v)**power, v)
    for j in range(rings+1):
        lat=-math.pi/2 + math.pi*j/rings
        for i in range(seg):
            a=2*math.pi*i/seg
            verts.append((loc[0]+scale[0]*sp(math.cos(lat))*sp(math.cos(a)),
                          loc[1]+scale[1]*sp(math.cos(lat))*sp(math.sin(a)),
                          loc[2]+scale[2]*sp(math.sin(lat))))
    for j in range(rings):
        for i in range(seg):
            a=j*seg+i; b=j*seg+(i+1)%seg
            faces.append((a,b,b+seg,a+seg))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj)
    return finish(obj,name,mat)

def loft(name, sections, mat, sides=24, power=1):
    # Each cross-section: x, y, z, half-width, half-depth.
    verts=[]; faces=[]
    for x,y,z,w,d in sections:
        for i in range(sides):
            a=2*math.pi*i/sides
            c=math.cos(a); s=math.sin(a)
            verts.append((x+w*math.copysign(abs(c)**power,c), y+d*math.copysign(abs(s)**power,s), z))
    for j in range(len(sections)-1):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(sections)-1)*sides+i for i in range(sides)))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj)
    finish(obj,name,mat)
    sub=obj.modifiers.new('Sculpted surface','SUBSURF'); sub.levels=2
    active(obj); bpy.ops.object.modifier_apply(modifier=sub.name)
    return obj

def tube(name, pts, radius, mat):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'
    curve.resolution_u=12; curve.bevel_depth=radius; curve.bevel_resolution=3
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(pts)-1)
    for b,p in zip(spline.bezier_points,pts):
        b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve); scene.collection.objects.link(obj)
    active(obj); bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat)

def fuse(name, parts, voxel=.012):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join(); obj=bpy.context.object; obj.name=name
    rem=obj.modifiers.new('Unified sculpt','REMESH'); rem.mode='VOXEL'; rem.voxel_size=voxel; rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=obj.modifiers.new('Relax sculpt','SMOOTH'); sm.factor=1.2; sm.iterations=5
    bpy.ops.object.modifier_apply(modifier=sm.name)
    dec=obj.modifiers.new('Game mesh','DECIMATE'); dec.ratio=.48
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def cut(obj, cutter):
    active(obj)
    mod=obj.modifiers.new('Carved feature','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def band(name, x,y,z,rx,ry,height,mat):
    return loft(name,[(x,y,z-height/2,rx*.96,ry*.96),(x,y,z-height*.44,rx,ry),
                       (x,y,z+height*.44,rx,ry),(x,y,z+height/2,rx*.96,ry*.96)],mat,32,.8)

print('Building continuous body',flush=True)
body_parts=[loft('Body',[(0,0,.18,.28,.18),(0,0,.35,.30,.20),(0,0,.58,.37,.23),
                         (0,.015,.85,.48,.245),(0,.025,.98,.41,.21),(0,.015,1.04,.22,.16)],skin)]
body_parts.append(shape('Neck',(0,0,1.04),(.19,.17,.20),skin))
for s in [-1,1]:
    body_parts.append(shape('Pectoral',(s*.225,-.115,.83),(.255,.17,.16),skin,.85))
    body_parts.append(shape('Deltoid',(s*.465,0,.89),(.205,.20,.205),skin))
    body_parts.append(loft('Arm',[(s*.59,-.10,.39,.13,.13),(s*.60,-.05,.53,.16,.15),
                                (s*.58,0,.66,.145,.145),(s*.53,0,.80,.18,.17),(s*.46,0,.92,.18,.17)],skin))
    body_parts.append(shape('Hand',(s*.59,-.115,.31),(.14,.145,.16),skin,.68))
    body_parts.append(shape('Thumb',(s*.49,-.215,.34),(.065,.07,.105),skin))
    body_parts.append(loft('Leg',[(s*.205,.015,-.30,.105,.11),(s*.205,0,-.16,.125,.125),
                                (s*.195,0,.02,.15,.15),(s*.17,0,.20,.165,.17)],skin))
    for z,w in [(.62,.13),(.47,.115)]:
        body_parts.append(shape('Abdominal',(s*.115,-.16,z),(w,.085,.075),skin))
body=fuse('Body_Sculpt',body_parts,.013)

head_parts=[shape('Head',(0,-.025,1.38),(.32,.25,.315),skin,.66,48,32),
            shape('Jaw',(0,-.055,1.17),(.26,.22,.12),skin,.66),
            shape('Nose bridge',(0,-.263,1.41),(.075,.10,.13),skin,.78),
            shape('Nose tip',(0,-.325,1.355),(.115,.105,.070),skin,.72)]
for s in [-1,1]:
    head_parts.append(shape('Ear',(s*.325,0,1.385),(.075,.063,.11),skin))
    head_parts.append(shape('Cheek',(s*.20,-.20,1.285),(.115,.095,.09),skin))
head=fuse('Face_Sculpt',head_parts,.007)
head_objects=[head]
for s in [-1,1]:
    cutter=shape('Socket cutter',(s*.157,-.266,1.475),(.13,.12,.088),None,.82)
    cut(head,cutter)
    head_objects.append(shape('Ear inset',(s*.345,-.052,1.39),(.035,.012,.065),ear))
    head_objects.append(shape('Eye',(s*.156,-.258,1.473),(.109,.074,.065),white,.85))
    head_objects.append(shape('Iris',(s*.141,-.326,1.465),(.042,.012,.047),iris))
    head_objects.append(shape('Pupil',(s*.139,-.337,1.466),(.023,.006,.030),pupil))
    head_objects.append(shape('Eye glint',(s*.139-.011,-.343,1.484),(.009,.004,.011),white))
    # Heavy brow slopes down toward the nose, giving the classic determined expression.
    brow=tube('Golden brow',[(s*.055,-.302,1.51),(s*.155,-.313,1.54),(s*.263,-.268,1.55)],.040,hair)
    head_objects.append(brow)
    head_objects.append(shape('Nostril',(s*.060,-.383,1.326),(.027,.012,.014),ear))

# Mouth inset, teeth, and a pronounced squared lower lip.
cut(head,shape('Mouth cutter',(0,-.273,1.205),(.19,.065,.052),None,.7))
head_objects.append(shape('Mouth inset',(0,-.251,1.205),(.185,.039,.046),mouth,.7))
head_objects.append(shape('Teeth',(0,-.288,1.222),(.158,.015,.026),white,.55))
head_objects.append(shape('Lower lip',(0,-.275,1.16),(.155,.035,.028),skin,.8))

# Hair is a continuous helmet-shaped sculpt with a crisp fringe and engraved locks.
verts=[]; faces=[]; segments=64; rows=18
for j in range(rows+1):
    t=j/rows
    for i in range(segments):
        a=2*math.pi*i/segments
        front=max(0,-math.sin(a))
        zedge=1.40 + .175*front
        r=math.cos(t*math.pi/2)**.52
        z=zedge+(1.77-zedge)*math.sin(t*math.pi/2)**.72
        x=.335*r*math.copysign(abs(math.cos(a))**.76,math.cos(a))
        y=-.003+.27*r*math.copysign(abs(math.sin(a))**.76,math.sin(a))
        verts.append((x,y,z))
for j in range(rows):
    for i in range(segments):
        a=j*segments+i; b=j*segments+(i+1)%segments
        faces.append((a,b,b+segments,a+segments))
me=bpy.data.meshes.new('Hair cap'); me.from_pydata(verts,[],faces); me.update()
cap=bpy.data.objects.new('Golden crop',me); scene.collection.objects.link(cap); finish(cap,cap.name,hair)
solid=cap.modifiers.new('Hair thickness','SOLIDIFY'); solid.thickness=.018
active(cap); bpy.ops.object.modifier_apply(modifier=solid.name)
head_objects.append(cap)
for i in range(21):
    a=math.pi*1.08+i*(math.pi*.84/20)
    pts=[]
    for t in [.01,.12,.25,.40,.58,.72]:
        front=max(0,-math.sin(a)); zedge=1.40+.175*front
        r=math.cos(t*math.pi/2)**.52
        pts.append((.336*r*math.copysign(abs(math.cos(a))**.76,math.cos(a)),
                    -.003+.271*r*math.copysign(abs(math.sin(a))**.76,math.sin(a)),
                    zedge+(1.77-zedge)*math.sin(t*math.pi/2)**.72+.001))
    head_objects.append(tube('Hair strand',pts,.0012,hair_dark))

# A broad, flowing moustache. Sections are built along X, not little balls.
def moustache(s):
    verts=[]; faces=[]; n=32; sides=16
    for j in range(n+1):
        t=j/n; x=s*(.015+.265*t); y=-.35+.022*t; z=1.285-.075*t*t
        width=.039+.016*math.sin(t*math.pi)-.032*t**5
        depth=.047+.017*math.sin(t*math.pi)-.043*t**5
        for k in range(sides):
            a=k*2*math.pi/sides
            verts.append((x,y+depth*math.cos(a),z+width*math.sin(a)))
    for j in range(n):
        for k in range(sides):
            a=j*sides+k; b=j*sides+(k+1)%sides; faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides)))); faces.append(tuple(n*sides+k for k in range(sides)))
    me=bpy.data.meshes.new('Moustache'); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new('Moustache',me); scene.collection.objects.link(ob)
    return finish(ob,ob.name,hair)
for s in [-1,1]:
    head_objects.append(moustache(s))
    for j in range(3):
        head_objects.append(tube('Moustache strand',[(s*.045,-.401,1.30-j*.017),(s*.15,-.402,1.28-j*.016),(s*.25,-.367,1.235-j*.009)],.002,hair_dark))

# Leather kilt: individual tapered panels, seams and rivets.
band('Belt',0,0,.29,.325,.225,.125,leather_dark)
for i in range(10):
    a=i*math.tau/10
    x=.28*math.cos(a); y=.205*math.sin(a)
    ob=loft('Leather tasset',[(x*1.12,y*1.12,.025,.085,.025),(x*1.10,y*1.10,.06,.095,.028),
                              (x,y,.22,.085,.027),(x,y,.25,.075,.025)],leather,16,.5)
    # Rotate each panel about its own radial center.
    for v in ob.data.vertices:
        dx=v.co.x-x; dy=v.co.y-y
        v.co.x=x+dx*math.cos(a+math.pi/2)-dy*math.sin(a+math.pi/2)
        v.co.y=y+dx*math.sin(a+math.pi/2)+dy*math.cos(a+math.pi/2)
    shape('Belt rivet',(.331*math.cos(a),.235*math.sin(a),.29),(.014,.014,.014),gold,seg=16,rings=10)
# Buckle frame, modeled as a continuous rounded strap.
tube('Buckle',[(-.085,-.242,.245),(-.09,-.245,.34),(.09,-.245,.34),(.085,-.242,.245),(-.085,-.242,.245)],.016,gold)
tube('Buckle tongue',[(0,-.262,.29),(.085,-.262,.29)],.011,gold)

for s in [-1,1]:
    band('Wrist bracer',s*.60,-.075,.455,.15,.15,.15,leather_dark)
    band('Bracer rim',s*.60,-.075,.515,.155,.155,.025,gold)
    band('Bracer rim',s*.60,-.075,.395,.15,.15,.025,gold)
    for i in range(3):
        shape('Bracer stud',(s*(.53+i*.055),-.225,.455),(.017,.010,.019),steel,seg=16,rings=10)
    # Sculpted fingers, shallow creases rather than isolated finger spheres.
    for i in range(3):
        x=s*(.515+i*.047)
        tube('Knuckle crease',[(x,-.246,.26),(x,-.256,.31),(x,-.247,.35)],.0035,ear)
    shape('Boot toe',(s*.205,-.07,-.375),(.145,.23,.095),leather_dark,.66)
    band('Boot',s*.205,.005,-.25,.14,.14,.23,leather)
    band('Boot top',s*.205,0,-.145,.155,.15,.05,leather_dark)
    band('Boot sole',s*.205,-.07,-.438,.15,.225,.033,leather_dark)
    for j in range(3):
        tube('Boot stitch',[(s*.205-.045,-.144,-.19-j*.05),(s*.205+.045,-.144,-.205-j*.05)],.006,leather_light)

# Sword with beveled diamond cross-section and a leather-wrapped handle.
sx=.63; sy=-.18
verts=[(sx-.065,sy,-.25),(sx,sy-.028,-.25),(sx+.065,sy,-.25),(sx,sy+.028,-.25),
       (sx-.09,sy,.24),(sx,sy-.03,.24),(sx+.09,sy,.24),(sx,sy+.03,.24),(sx,sy,-.40)]
faces=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(0,8,1),(1,8,2),(2,8,3),(3,8,0),(4,5,6,7)]
me=bpy.data.meshes.new('Sword'); me.from_pydata(verts,[],faces); me.update()
sword=bpy.data.objects.new('Sword blade',me); scene.collection.objects.link(sword); finish(sword,sword.name,steel)
for p in sword.data.polygons: p.use_smooth=False
tube('Crossguard',[(sx-.15,sy,.255),(sx,sy,.28),(sx+.15,sy,.255)],.035,steel_edge)
band('Sword grip',sx,sy,.35,.036,.035,.20,leather_dark)
shape('Sword pommel',(sx,sy,.46),(.05,.045,.045),gold,.7)

# Head origin is kept at the base of the skull for independent game motion.
pivot=bpy.data.objects.new('HeadPivot',None); scene.collection.objects.link(pivot); pivot.location=(0,0,1.08)
for ob in head_objects:
    ob.parent=pivot; ob.matrix_parent_inverse=pivot.matrix_world.inverted()
    # Force evaluated parent matrix before preserving world-space mesh coordinates.
    ob.matrix_parent_inverse.translation=(0,0,-1.08)

print('Unwrapping model and packing textures',flush=True)
meshes=[o for o in scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False) if hasattr(bpy.ops.mesh,'normals_make_consistent') else None
bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.015)
bpy.ops.object.mode_set(mode='OBJECT')
# Join static parts sharing a material to limit draw calls, keeping the head independent.
for head_group in [False,True]:
    for mat in list(bpy.data.materials):
        parts=[o for o in list(scene.objects) if o.type=='MESH' and o!=sword and bool(o.parent==pivot)==head_group and len(o.data.materials)==1 and o.data.materials[0]==mat]
        if len(parts)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in parts: ob.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
        bpy.context.object.name=('Head_' if head_group else 'Body_')+mat.name.replace(' ','_')

all_model=[o for o in scene.objects if o.type in {'MESH','EMPTY'}]
for ob in all_model:
    if ob.type!='MESH' or len(ob.data.polygons)<800: continue
    active(ob)
    dec=ob.modifiers.new('Optimized game mesh','DECIMATE')
    dec.ratio=.50 if ob==head else .35 if ob==body else .22
    bpy.ops.object.modifier_apply(modifier=dec.name)
    ob.data.validate(clean_customdata=True)
    ob.data.update()
bpy.ops.object.select_all(action='DESELECT')
for ob in all_model: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'barbarian.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH')
(OUT/'model-info.json').write_text(json.dumps({'name':'Barbarian','origin':'Blender-built prototype','triangles':triangles,'embeddedTextures':6,'rig':'Head pivot; no skeletal animation'},indent=2))
print('Exported model:',triangles,'triangles',flush=True)

def aim(ob,point): ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc; aim(obj,(0,0,.7))
light('Soft warm key',(-3,-4,5),450,4,(1,.86,.72))
light('Cool fill',(3,-2,2),230,3,(.72,.84,1))
light('Golden rim',(1,2,3),500,3,(1,.78,.45))
cam_data=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',cam_data); scene.collection.objects.link(cam); scene.camera=cam
cam_data.type='ORTHO'; cam_data.ortho_scale=2.5
cam.location=(2.4,-6,2.6); aim(cam,(0,0,.68))
scene.render.filepath=str(OUT/'preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'barbarian.blend'))
bpy.ops.render.render(write_still=True)
scene.render.resolution_x=512; scene.render.resolution_y=512
cam_data.ortho_scale=1.12; cam.location=(.45,-5,1.85); aim(cam,(0,-.02,1.30))
scene.render.filepath=str(OUT/'portrait.png'); bpy.ops.render.render(write_still=True)
print('Preview and portrait ready',flush=True)
