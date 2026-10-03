"""Rebuild editable Blender workshop and the deformable lettering assets.
Run from repository: blender -b --factory-startup --python scripts/blender-collection.py
The body reference is exported by scripts/export-workshop.ts, not a hidden blob.
"""
import bpy, json, math, os
from pathlib import Path
ROOT=Path.cwd()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
font_path=Path('C:/Windows/Fonts/arialbd.ttf')
font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
assets={}
templates=bpy.data.collections.new('Print templates - material coordinates');bpy.context.scene.collection.children.link(templates);templates.hide_viewport=True;templates.hide_render=True
def material(name,color):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.55
    return m
def add_group(name,kind,verts,indices,color,axis=1,sign=1):
    assets.setdefault(name,[]).append(dict(axis=axis,sign=sign,positions=verts,indices=indices,color=color))
    mesh=bpy.data.meshes.new(name+' '+kind);mesh.from_pydata([verts[i:i+3] for i in range(0,len(verts),3)],[],[indices[i:i+3] for i in range(0,len(indices),3)])
    obj=bpy.data.objects.new(name+' '+kind,mesh);templates.objects.link(obj);obj.data.materials.append(material(color,tuple(int(color[i:i+2],16)/255 for i in (1,3,5))))
    obj.hide_render=True
def text(name,words,width,x,y,color):
    curve=bpy.data.curves.new(words,'FONT');curve.body=words;curve.align_x='CENTER';curve.size=1;curve.extrude=.007;curve.bevel_depth=.0015;curve.bevel_resolution=1;curve.resolution_u=3
    if font:curve.font=font
    obj=bpy.data.objects.new(words,curve);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.context.view_layer.update();scale=width/max(obj.dimensions.x,.01)
    bpy.ops.object.convert(target='MESH');mesh=obj.data;mesh.calc_loop_triangles()
    verts=[]
    for v in mesh.vertices:verts.extend([v.co.x*scale+x,-(v.co.y*scale+y),v.co.z*scale+.012])
    indices=[v for t in mesh.loop_triangles for v in t.vertices]
    bpy.data.objects.remove(obj,do_unlink=True);add_group(name,words,verts,indices,color)
def ellipse(name,x,y,rx,ry,color,axis=2,height=.012,sign=1):
    verts=[x,y,height];segments=24
    for i in range(segments):
        angle=i*2*math.pi/segments;verts.extend([x+rx*math.cos(angle),y+ry*math.sin(angle),height])
    indices=[]
    for i in range(segments):indices.extend([0,i+1,(i+1)%segments+1])
    add_group(name,'ellipse',verts,indices,color,axis,sign)
def polygon(name,points,color,axis=1,height=.014):
    cx=sum(p[0] for p in points)/len(points);cy=sum(p[1] for p in points)/len(points)
    verts=[cx,cy,height]+[n for p in points for n in (*p,height)];indices=[]
    for i in range(len(points)):indices.extend([0,i+1,(i+1)%len(points)+1])
    add_group(name,'ink',verts,indices,color,axis)
text('butter','BUTTER',1.5,0,-.12,'#fff3c6')
text('butter','SALTED',.57,0,.34,'#96752b')
text('butter','4oz NET WT. (113G)',1.05,0,-.57,'#96752b')
text('strawberry','STRAWBERRY',1.67,0,-.12,'#fff4ef')
text('strawberry','4oz NET WT. (113G)',1.05,0,-.57,'#b44c70')
ellipse('strawberry',-.02,-.42,.105,.12,'#dc4b60',1)
polygon('strawberry',[(-.14,-.5),(-.05,-.37),(0,-.48),(.07,-.36),(.14,-.5)],'#3f8c60')
for eye_x in [-.27,.27]:
    ellipse('face',eye_x,.38,.085,.115,'#423545');ellipse('face',eye_x-.022,.425,.025,.03,'#fff9f4',height=.015)
    ellipse('face',eye_x*1.42,.165,.10,.038,'#f58fa9')
polygon('face',[(-.105,.195),(-.065,.13),(0,.105),(.065,.13),(.105,.195),(.065,.16),(0,.14),(-.065,.16)],'#423545',2)
for y in [-.6,-.32,.55,.8]:
    for x in [-.62,-.32,0,.32,.62]:ellipse('seeds',x,y,.019,.042,'#ffe0a0',height=.008)
for side,sign in [(0,-1),(0,1),(2,-1)]:
    for y in [-.6,-.3,0,.3,.6]:
        for x in [-.62,-.31,0,.31,.62]:ellipse('seeds',x,y,.019,.042,'#ffe0a0',axis=side,sign=sign,height=.008)
for i in range(5):
    angle=i*2*math.pi/5;u=(math.cos(angle),math.sin(angle));v=(-u[1],u[0])
    polygon('leaves',[(0,0),(.24*u[0]+.12*v[0],.24*u[1]+.12*v[1]),(.7*u[0],.7*u[1]),(.24*u[0]-.12*v[0],.24*u[1]-.12*v[1])],'#4b9860',height=.027)
out=ROOT/'public'/'assets';out.mkdir(parents=True,exist_ok=True)
(out/'collection-details.json').write_text(json.dumps(dict(version=1,blender=bpy.app.version_string,groups=assets),separators=(',',':')),encoding='utf8')
# The editable workshop contains the exact runtime reference surfaces.
references={r['shape']:r for r in json.loads((ROOT/'work'/'workshop-reference.json').read_text())}
items=[('Mochi','mochi',[],(.65,.53,.86)),('Butter','butter',['butter'],(.93,.78,.38)),('Strawberry','butter',['strawberry'],(.95,.55,.69)),('Fragolina','strawberry',['face','seeds','leaves'],(.9,.2,.3)),('Jelly cube','cube',[],(.3,.75,.9))]
for i,(name,shape,groups,color) in enumerate(items):
    ref=references[shape];collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
    mesh=bpy.data.meshes.new(ref['shape']);mesh.from_pydata([ref['positions'][j:j+3] for j in range(0,len(ref['positions']),3)],[],[ref['indices'][j:j+3] for j in range(0,len(ref['indices']),3)])
    obj=bpy.data.objects.new(name+' - reference skin',mesh);collection.objects.link(obj);obj.location.x=i*4.5
    mat=material(name+' surface',color);obj.data.materials.append(mat)
    if shape=='cube':
        bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Transmission Weight'].default_value=.91;bsdf.inputs['IOR'].default_value=1.38;bsdf.inputs['Roughness'].default_value=.09
    for p in mesh.polygons:p.use_smooth=True
    for group in groups:
        # Attach editable copies in rest material coordinates for workshop review.
        for asset in assets[group]:
            verts=[]
            for j in range(0,len(asset['positions']),3):
                u,v,h=asset['positions'][j:j+3];q=[0,0,0];q[asset['axis']]=asset['sign'];other=[a for a in range(3) if a!=asset['axis']];q[other[0]]=u;q[other[1]]=v
                sx=q[0]*math.sqrt(1-q[1]**2/2-q[2]**2/2+q[1]**2*q[2]**2/3)
                sy=q[1]*math.sqrt(1-q[2]**2/2-q[0]**2/2+q[2]**2*q[0]**2/3)
                sz=q[2]*math.sqrt(1-q[0]**2/2-q[1]**2/2+q[0]**2*q[1]**2/3)
                r=ref['radii'];shape=ref['shape']
                if shape=='butter':p=[(q[0]*.78+sx*.22)*r[0],(q[1]*.78+sy*.22+1)*r[1]+.04,(q[2]*.78+sz*.22)*r[2]]
                elif shape=='strawberry':t=.6+.4*(sy+1)/2;p=[sx*r[0]*t,(sy+1)*r[1]+.04,sz*r[2]*t]
                else:p=[sx*r[0],(sy+1)*r[1]+.04,sz*r[2]]
                p[asset['axis']]+=h*asset['sign'];verts.append(p)
            dm=bpy.data.meshes.new(group+' deformable print');dm.from_pydata(verts,[],[asset['indices'][j:j+3] for j in range(0,len(asset['indices']),3)])
            detail=bpy.data.objects.new(name+' - '+group,dm);collection.objects.link(detail);detail.location.x=i*4.5;detail.data.materials.append(material(asset['color'],tuple(int(asset['color'][j:j+2],16)/255 for j in (1,3,5))))
    # Keep the simulation reference editable without cluttering the skin view.
    cm=bpy.data.meshes.new(name+' cage');cp=ref['cage'];cm.from_pydata([cp[j:j+3] for j in range(0,len(cp),3)],[],[])
    cage=bpy.data.objects.new(name+' - physics reference',cm);collection.objects.link(cage);cage.location.x=i*4.5;cage.hide_set(True);cage.hide_render=True;cage['tetrahedra']=ref['tets']
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=23;area.spaces.active.region_3d.view_location=(9,1,0)
workshop=ROOT/'assets'/'blender';workshop.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(workshop/'squishy-collection.blend'),compress=True)
print('Exported deformable groups:',{k:sum(len(g['positions'])//3 for g in v) for k,v in assets.items()})
