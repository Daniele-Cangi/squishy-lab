"""Rebuild editable Blender workshop and the deformable lettering assets.
Run from repository: blender -b --factory-startup --python scripts/blender-collection.py
The body reference is exported by scripts/export-workshop.ts, not a hidden blob.
"""
import bpy, json, math, random
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
def line(name,points,width,color,axis=2,sign=1,height=.012):
    # Dense strips follow the same material triangles as the skin, even on curves.
    verts=[];indices=[]
    for i,(u,v) in enumerate(points):
        a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)];dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy) or 1
        for side in [-1,1]:verts.extend([max(-1,min(1,u-side*dy/length*width)),max(-1,min(1,v+side*dx/length*width)),height])
        if i:indices.extend([2*i-2,2*i-1,2*i,2*i-1,2*i+1,2*i])
    add_group(name,'relief strip',verts,indices,color,axis,sign)

# Expression prints use dense material-coordinate strips, not rigid stickers.
for cat in [False,True]:
    eye_y=.18 if cat else .38
    mouth_y=-.10 if cat else .15
    for expression in ['happy','sleepy','wink','surprised']:
        group=('cat-face-' if cat else 'face-')+expression
        for side in [-1,1]:
            x=side*.27
            if expression=='surprised' or (expression=='wink' and side==-1):
                ellipse(group,x,eye_y,.08,.105,'#423545')
                ellipse(group,x-.022,eye_y+.043,.023,.027,'#fff9f4',height=.015)
            else:
                points=[(x-.085+i*.17/20,eye_y+(.055*math.sin(i*math.pi/20) if expression!='sleepy' else -.027*math.sin(i*math.pi/20))) for i in range(21)]
                line(group,points,.012,'#423545')
            ellipse(group,x*1.42,eye_y-.205,.10,.038,'#f58fa9')
        if expression=='surprised':
            ellipse(group,0,mouth_y,.055,.073,'#423545')
        elif expression=='sleepy':
            line(group,[(-.055,mouth_y),(.055,mouth_y)],.01,'#423545')
        elif expression=='happy':
            points=[(-.115,mouth_y+.035),(.115,mouth_y+.035)]+[(.115*math.cos(i*math.pi/24),mouth_y+.035-.12*math.sin(i*math.pi/24)) for i in range(1,24)]
            polygon(group,points,'#423545',2)
            ellipse(group,0,mouth_y-.048,.062,.025,'#f58fa9',height=.015)
        else:
            line(group,[(-.10+i*.2/24,mouth_y-.065*math.sin(i*math.pi/24)) for i in range(25)],.009,'#423545')
        if cat:
            polygon(group,[(-.06,.01),(.06,.01),(0,-.05)],'#af6b6b',2)
            for side in [-1,1]:
                for v in [-.02,-.1]:line(group,[(side*.19,v),(side*.59,v-.035)],.008,'#795b50')
for u in [-1/3,1/3]:line('chocolate',[(u,-.96+i*1.92/32) for i in range(33)],.007,'#5d3427',1,height=.005)
line('chocolate',[(-.96+i*1.92/48,0) for i in range(49)],.007,'#5d3427',1,height=.005)
text('chocolate','COCOA',.48,0,-.56,'#b27d59')
references={r['shape']:r for r in json.loads((ROOT/'work'/'workshop-reference.json').read_text())}
def paint_region(name,ref,threshold,less_than,color):
    n=ref['subdivisions']
    for face in ref['faceGrids']:
        verts=[];indices=[];grid=face['grid']
        for y in range(n):
            for x in range(n):
                for corners in [[(x,y),(x+1,y),(x,y+1)],[(x+1,y),(x+1,y+1),(x,y+1)]]:
                    polygon=[(2*u/n-1,2*v/n-1,ref['axial'][grid[u+(n+1)*v]]) for u,v in corners];clipped=[]
                    # Clip pigment at the exact axial boundary, avoiding stair-step tips.
                    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
                        inside_a=(a[2]<threshold) if less_than else (a[2]>threshold)
                        inside_b=(b[2]<threshold) if less_than else (b[2]>threshold)
                        if inside_a:clipped.append(a)
                        if inside_a!=inside_b:
                            t=(threshold-a[2])/(b[2]-a[2]);clipped.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(3)))
                    if len(clipped)>=3:
                        start=len(verts)//3;verts.extend([value for u,v,_ in clipped for value in (u,v,.004)])
                        for i in range(1,len(clipped)-1):indices.extend([start,start+i,start+i+1])
        if verts:add_group(name,'peel pigment',verts,indices,color,face['axis'],face['sign'])
banana=references['banana']
paint_region('banana',banana,-.87,True,'#8a8140')
paint_region('banana',banana,-.97,True,'#615237')
paint_region('banana',banana,.97,False,'#735039')
for v in [-.53,.53]:
    for sign in [-1,1]:line('banana',[(-.88+i*1.76/48,v) for i in range(49)],.007,'#dfb43c',sign=sign,height=.004)
random.seed(391)
for i in range(17):ellipse('banana',random.uniform(-.65,.65),random.uniform(-.5,.5),.008,.012,'#c69b40',height=.004)
for side in [-1,1]:
    polygon('cat',[(side*.49,.69),(side*.66,.97),(side*.82,.71)],'#df8e91',2,height=.013)
    for v in [-.15,.1,.35]:line('cat',[(side*(.76+i*.19/12),v-i*.075/12) for i in range(13)],.022,'#bd794c')
for u in [-.17,0,.17]:line('cat',[(u,.68-i*.18/16) for i in range(17)],.025,'#bd794c')
for eye_x in [-.27,.27]:
    ellipse('cat-face',eye_x,.18,.085,.115,'#423545');ellipse('cat-face',eye_x-.022,.225,.025,.03,'#fff9f4',height=.015)
    ellipse('cat-face',eye_x*1.42,-.085,.1,.038,'#f58fa9')
polygon('cat-face',[(-.075,.005),(.075,.005),(0,-.075)],'#af6b6b',2)
for side in [-1,1]:
    line('cat-face',[(0,-.07),(side*.025,-.12),(side*.09,-.13),(side*.14,-.08)],.009,'#423545')
    for v in [-.02,-.1]:line('cat-face',[(side*.19,v),(side*.59,v-.035)],.008,'#795b50')
for pocket in references['cheese']['pockets']:
    # Radial subdivisions conform to the bowl instead of spanning its concavity.
    verts=[pocket['u'],pocket['v'],.01];indices=[];segments=32;rings=5
    for ring in range(1,rings+1):
        radius=pocket['radius']*.64*ring/rings
        for i in range(segments):
            angle=i*2*math.pi/segments;verts.extend([pocket['u']+radius*math.cos(angle),pocket['v']+radius*math.sin(angle),.01])
            a=1+(ring-1)*segments+i;b=1+(ring-1)*segments+(i+1)%segments
            if ring==1:indices.extend([0,a,b])
            else:c=a-segments;d=b-segments;indices.extend([c,a,d,a,b,d])
    add_group('cheese','recess lining',verts,indices,'#ce932f',pocket['axis'])
for sign in [-1,1]:line('peanut',[(-.98+i*1.96/64,0) for i in range(65)],.008,'#a87c4c',1,sign,height=.005)

def pad(name,x,y,rx,ry,color,height=.045,axis=2):
    verts=[x,y,height];indices=[];segments=32;rings=7
    for ring in range(1,rings+1):
        radius=ring/rings
        for i in range(segments):
            angle=i*2*math.pi/segments
            if name=='paw' and x==0:
                px=math.sin(angle)**3;py=(13*math.cos(angle)-5*math.cos(2*angle)-2*math.cos(3*angle)-math.cos(4*angle))/17
            else:px=math.cos(angle);py=math.sin(angle)
            verts.extend([x+rx*radius*px,y+ry*radius*py,.008+(height-.008)*(1-radius*radius)])
            a=1+(ring-1)*segments+i;b=1+(ring-1)*segments+(i+1)%segments
            if ring==1:indices.extend([0,a,b])
            else:c=a-segments;d=b-segments;indices.extend([c,a,d,a,b,d])
    add_group(name,'soft raised pad',verts,indices,color,axis)

for x,y in [(-.67,.77),(-.23,.84),(.23,.84),(.67,.77)]:pad('paw',x,y,.135,.16,'#e7a6b7')
pad('paw',0,-.05,.38,.30,'#e7a6b7',.065)
for side in [-1,1]:
    pad('capybara',side*.65,.65,.12,.12,'#8b664e',.02,axis=1)
    line('capybara',[(side*.46,-.64),(side*.65,-.65)],.013,'#86634d')

import copy
for expression in ['smile','happy','sleepy','wink','surprised']:
    source='face'+('' if expression=='smile' else '-'+expression)
    target='capy-face'+('' if expression=='smile' else '-'+expression)
    pad(target,0,.12,.48,.33,'#caa27b',.006)
    for asset in copy.deepcopy(assets[source]):
        # Slightly wider eyes and a lower mouth suit the broad capybara muzzle.
        for j in range(0,len(asset['positions']),3):
            asset['positions'][j]*=1.18
            if asset['positions'][j+1]>.25:asset['positions'][j+1]+=.16
        add_group(target,'expression',asset['positions'],asset['indices'],asset['color'],asset['axis'],asset['sign'])
    for x in [-.14,.14]:ellipse(target,x,.2,.048,.028,'#76543f',height=.025)

# Icing coats the actual toroidal skin; no triangle bridges the center hole.
for face in references['donut']['faceGrids']:
    if face['axis']==1 and face['sign']==-1:continue
    n=references['donut']['subdivisions'];verts=[];indices=[]
    def border(u):return .25+.17*math.sin(7*math.pi*u)+.07*math.sin(13*math.pi*u)
    for y in range(n):
        for x in range(n):
            for corners in [[(x,y),(x+1,y),(x,y+1)],[(x+1,y),(x+1,y+1),(x,y+1)]]:
                poly=[(2*a/n-1,2*b/n-1) for a,b in corners];clipped=[]
                if face['axis']==1:clipped=poly
                else:
                    for a,b in zip(poly,poly[1:]+poly[:1]):
                        fa=a[1]-border(a[0]);fb=b[1]-border(b[0])
                        if fa>=0:clipped.append(a)
                        if (fa>=0)!=(fb>=0):
                            t=fa/(fa-fb);clipped.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
                if len(clipped)>=3:
                    start=len(verts)//3;verts.extend([value for u,v in clipped for value in (u,v,.009)])
                    for j in range(1,len(clipped)-1):indices.extend([start,start+j,start+j+1])
    if face['axis']==2 and face['sign']==1:
        for j in range(0,len(indices),3):indices[j+1],indices[j+2]=indices[j+2],indices[j+1]
    if verts:add_group('donut','icing',verts,indices,'#ed91b1',face['axis'],face['sign'])
random.seed(723)
for i in range(64):
    u=random.uniform(-.94,.94);v=random.uniform(-.72,.72);angle=random.uniform(0,math.pi)
    line('donut',[(u-.012*math.cos(angle)+j*.024*math.cos(angle)/4,v-.04*math.sin(angle)+j*.08*math.sin(angle)/4) for j in range(5)],.009,['#fff5bd','#85ced8','#b9a0e9','#faf3ec'][i%4],axis=1,height=.027)
out=ROOT/'public'/'assets';out.mkdir(parents=True,exist_ok=True)
(out/'collection-details.json').write_text(json.dumps(dict(version=1,blender=bpy.app.version_string,groups=assets),separators=(',',':')),encoding='utf8')
# The editable workshop contains the exact runtime reference surfaces.
items=[('Mochi','mochi',['face'],(.65,.53,.86)),('Butter','butter',['butter'],(.93,.78,.38)),('Strawberry','butter',['strawberry'],(.95,.55,.69)),('Strawberry face','strawberry',['face','seeds','leaves'],(.9,.2,.3)),('Jelly cube','cube',[],(.3,.75,.9)),('Chocolate','chocolate',['chocolate'],(.46,.26,.18)),('Banana','banana',['banana'],(.96,.81,.33)),('Cat','cat',['cat','cat-face'],(.91,.67,.47)),('Cheese','cheese',['cheese'],(.95,.75,.3)),('Peanut','peanut',['peanut'],(.83,.64,.43))]
items.extend([('Jelly Drop','drop',[],(.57,.8,.89)),('Sugar Drop','gumdrop',[],(.86,.62,.87)),('Kitty Paw','paw',['paw'],(.94,.85,.79)),('Sleepy Capybara','capybara',['capybara','capy-face-sleepy'],(.71,.55,.41)),('Glazed Donut','donut',['donut'],(.87,.67,.40))])
def project(ref,asset,u,v,height):
    # Exact barycentric sampling of the exported runtime triangles and normals.
    n=ref['subdivisions'];face=next(f for f in ref['faceGrids'] if f['axis']==asset['axis'] and f['sign']==asset['sign']);grid=face['grid']
    gu=(max(-1,min(1,u))+1)*n/2;gv=(max(-1,min(1,v))+1)*n/2;x=min(n-1,math.floor(gu));y=min(n-1,math.floor(gv));fu=gu-x;fv=gv-y
    a=grid[x+(n+1)*y];b=grid[x+1+(n+1)*y];c=grid[x+(n+1)*(y+1)];d=grid[x+1+(n+1)*(y+1)]
    ids,weights=([a,b,c],[1-fu-fv,fu,fv]) if fu+fv<=1 else ([b,d,c],[1-fv,fu+fv-1,1-fu])
    p=[sum(ref['positions'][idx*3+axis]*w for idx,w in zip(ids,weights)) for axis in range(3)]
    normal=[sum(ref['normals'][idx*3+axis]*w for idx,w in zip(ids,weights)) for axis in range(3)];length=math.sqrt(sum(v*v for v in normal)) or 1
    return [p[axis]+normal[axis]/length*height for axis in range(3)]
for i,(name,shape,groups,color) in enumerate(items):
    ref=references[shape];collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
    mesh=bpy.data.meshes.new(ref['shape']);mesh.from_pydata([ref['positions'][j:j+3] for j in range(0,len(ref['positions']),3)],[],[ref['indices'][j:j+3] for j in range(0,len(ref['indices']),3)])
    location=((i%5)*4.5,(i//5)*-5,0)
    obj=bpy.data.objects.new(name+' - reference skin',mesh);collection.objects.link(obj);obj.location=location;obj.rotation_euler.x=math.pi/2
    mat=material(name+' surface',color);obj.data.materials.append(mat)
    if shape in ['peanut','capybara']:
        attribute=mesh.color_attributes.new(name='Shell grain',type='FLOAT_COLOR',domain='POINT')
        for j,entry in enumerate(attribute.data):entry.color=(*ref['colors'][j*3:j*3+3],1)
        nodes=mat.node_tree.nodes;grain=nodes.new('ShaderNodeVertexColor');grain.layer_name='Shell grain';mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=(*color,1)
        mat.node_tree.links.new(grain.outputs['Color'],mix.inputs[2]);mat.node_tree.links.new(mix.outputs[0],nodes['Principled BSDF'].inputs['Base Color'])
    if shape in ['cube','drop']:
        bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Transmission Weight'].default_value=.91;bsdf.inputs['IOR'].default_value=1.38;bsdf.inputs['Roughness'].default_value=.09
    for p in mesh.polygons:p.use_smooth=True
    for group in groups:
        # Attach editable copies in rest material coordinates for workshop review.
        for asset in assets[group]:
            verts=[]
            for j in range(0,len(asset['positions']),3):
                u,v,h=asset['positions'][j:j+3];verts.append(project(ref,asset,u,v,h))
            dm=bpy.data.meshes.new(group+' deformable print');dm.from_pydata(verts,[],[asset['indices'][j:j+3] for j in range(0,len(asset['indices']),3)])
            detail=bpy.data.objects.new(name+' - '+group,dm);collection.objects.link(detail);detail.location=location;detail.rotation_euler.x=math.pi/2;detail.data.materials.append(material(asset['color'],tuple(int(asset['color'][j:j+2],16)/255 for j in (1,3,5))))
    # Keep the simulation reference editable without cluttering the skin view.
    cm=bpy.data.meshes.new(name+' cage');cp=ref['cage'];cm.from_pydata([cp[j:j+3] for j in range(0,len(cp),3)],[],[])
    cage=bpy.data.objects.new(name+' - physics reference',cm);collection.objects.link(cage);cage.location=location;cage.rotation_euler.x=math.pi/2;cage.hide_set(True);cage.hide_render=True;cage['tetrahedra']=ref['tets']
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=24;area.spaces.active.region_3d.view_location=(9,-2.5,1);area.spaces.active.shading.color_type='MATERIAL'
workshop=ROOT/'assets'/'blender';workshop.mkdir(parents=True,exist_ok=True)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(workshop/'squishy-collection.blend'),compress=True)
print('Exported deformable groups:',{k:sum(len(g['positions'])//3 for g in v) for k,v in assets.items()})
