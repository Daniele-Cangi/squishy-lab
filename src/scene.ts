import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEFAULT_APPEARANCE, type Appearance,type ShapeId } from './collection';
import { Decorations,loadDetails,type DetailLibrary } from './decorations';
import { compileSpec, type SquishySpec } from './shared/spec';
import { createSurface, embedSurface, cagePoint,surfacePoint,pointDepth,shapeTint,type MaterialPoint,type SurfaceEmbedding, type Vec3 } from './physics/cage';
import { FixedClock, SoftBody } from './physics/solver';
import { pressureAt,sustainedPressureAt,standardContact,standardLogicalPoint,STANDARD_GESTURE } from './physics/gesture';
export class SquishyScene {
  soundFeedback:((shape:ShapeId,pressure:number)=>void)|undefined;
  readonly renderer:THREE.WebGLRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(36,1,.1,40);
  body:SoftBody;
  private surface:SurfaceEmbedding;
  private visibleProbe:MaterialPoint;
  private internalProbe:MaterialPoint;
  private geometry:THREE.BufferGeometry;
  private referenceNormals:Float32Array=new Float32Array();
  private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshPhysicalMaterial>;
  private appearance:Appearance={...DEFAULT_APPEARANCE};
  private detailLibrary:DetailLibrary|undefined;
  private decorations:Decorations|undefined;
  private disposed=false;
  private needsRender=true;
  private environment:THREE.WebGLRenderTarget|undefined;
  private sugarTexture:THREE.CanvasTexture|undefined;
  private clearFloor:THREE.Mesh;
  private clock=new FixedClock();
  private raycaster=new THREE.Raycaster();
  private observer:ResizeObserver;
  private frame=0;
  private previous=0;
  private pointer:number|null=null;
  private pressStart=0;
  private startY=0;
  private currentY=0;
  private held=false;
  private keyboard=false;
  private pointerPoint:Vec3|null=null;
  private pointerNormal:Vec3=[0,1,0];
  private targetNormal:Vec3=[0,1,0];
  private comparison:{before:SquishySpec;after:SquishySpec;original:SquishySpec;phase:0|1;elapsed:number;notify:(phase:0|1|null)=>void}|undefined;
  private angle=.38;
  private samples:{solverMs:number;surfaceMs:number;renderMs:number;frameMs:number}[]=[];
  private halo:THREE.Mesh;
  private haloEmbedding:{nodes:number[];weights:number[]}|null=null;
  constructor(private canvas:HTMLCanvasElement,spec:SquishySpec,private onState:(s:'pressing'|'recovering'|'rest')=>void) {
    this.body=new SoftBody(spec);this.surface=createSurface(this.body.cage);this.geometry=this.makeGeometry();
    this.visibleProbe=surfacePoint(this.surface,standardLogicalPoint(this.body.cage));this.internalProbe=cagePoint(this.body.cage,standardLogicalPoint(this.body.cage));
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.mesh=new THREE.Mesh(this.geometry,new THREE.MeshPhysicalMaterial({color:spec.color,roughness:compileSpec(spec).roughness,metalness:0}));
    this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.scene.add(this.mesh);
    this.scene.add(new THREE.HemisphereLight('#fff9f1','#8594b3',1.05));
    const key=new THREE.DirectionalLight('#fff5e8',3.0);key.position.set(-3.8,4.8,1.8);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.bias=-.0002;key.shadow.normalBias=.02;key.shadow.radius=3;this.scene.add(key);
    const fill=new THREE.DirectionalLight('#e5eeff',.65);fill.position.set(3,2.5,4);this.scene.add(fill);
    const rim=new THREE.DirectionalLight('#ece8ff',.9);rim.position.set(1,4,-4);this.scene.add(rim);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#324c83',opacity:.10}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
    const ctx=shadowCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(49,68,113,.22)');gradient.addColorStop(.5,'rgba(49,68,113,.12)');gradient.addColorStop(1,'rgba(49,68,113,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,3.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.012;this.scene.add(contactShadow);
    // A warm confetti tray gives transparent foam a soft, colorful backdrop.
    const tile=document.createElement('canvas');tile.width=1024;tile.height=1024;const tc=tile.getContext('2d')!;
    tc.fillStyle='#fff3df';tc.fillRect(0,0,1024,1024);
    for(let i=0;i<70;i++){
      const x=(i*283+91)%1024,y=(i*419+173)%1024;
      tc.fillStyle=['#e4d8f8','#cde6d8','#f7cdd1','#f6dda1'][i%4];tc.beginPath();tc.ellipse(x,y,9+i%11,6+i%7,i*.7,0,Math.PI*2);tc.fill();
    }
    tc.strokeStyle='#d9c7ec';tc.lineWidth=9;tc.beginPath();tc.arc(512,512,486,0,Math.PI*2);tc.stroke();
    const texture=new THREE.CanvasTexture(tile);texture.colorSpace=THREE.SRGBColorSpace;
    this.clearFloor=new THREE.Mesh(new THREE.CircleGeometry(3.1,64),new THREE.MeshStandardMaterial({map:texture,roughness:1}));this.clearFloor.rotation.x=-Math.PI/2;this.clearFloor.position.y=.018;this.clearFloor.visible=false;this.clearFloor.receiveShadow=true;this.scene.add(this.clearFloor);
    // An open, thin contact ring leaves the indentation itself visible.
    this.halo=new THREE.Mesh(new THREE.RingGeometry(.18,.19,48,1,Math.PI*.15,Math.PI*1.7),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.55,side:THREE.DoubleSide,depthTest:false}));this.halo.visible=false;this.halo.renderOrder=3;this.scene.add(this.halo);
    this.updateCamera();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    this.bindInput();this.frame=requestAnimationFrame(t=>this.animate(t));
    void loadDetails().then(assets=>{if(this.disposed)return;this.detailLibrary=assets;this.rebuildDecorations();}).catch(()=>{this.canvas.dispatchEvent(new CustomEvent('details-error'));});
  }
  private makeGeometry() {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.surface.rest.slice(),3));geometry.setIndex(new THREE.BufferAttribute(this.surface.indices,1));
    if(['peanut','capybara'].includes(this.body.cage.shape)){
      const colors=new Float32Array(this.surface.rest.length);for(let i=0;i<colors.length;i+=3)colors.set(shapeTint(this.body.cage.shape,Array.from(this.surface.logical.slice(i,i+3)) as Vec3),i);
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    if(this.body.cage.shape==='gumdrop'){
      const uv=new Float32Array(this.surface.rest.length/3*2);
      for(let i=0;i<this.surface.rest.length/3;i++){const q=this.surface.logical.slice(i*3,i*3+3);uv[i*2]=Math.atan2(q[2],q[0])/(2*Math.PI)+.5;uv[i*2+1]=(q[1]+1)/2;}
      geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    }
    geometry.computeVertexNormals();this.referenceNormals=(geometry.getAttribute('normal').array as Float32Array).slice();geometry.computeBoundingSphere();return geometry;
  }
  private updateCamera() {
    const banana=this.appearance.shape==='banana',targetY=this.body.cage.radii[1]*(banana?1.45:.95);
    const distance=banana?Math.max(1,1.38/this.camera.aspect):this.canvas.closest('.is-expanded')?Math.max(1,.8/this.camera.aspect):1;
    this.camera.position.set(Math.sin(this.angle)*5.3*distance,targetY+((banana?2.65:['capybara','paw'].includes(this.appearance.shape)?3.05:4.3)-targetY)*distance,Math.cos(this.angle)*5.3*distance);this.camera.lookAt(0,targetY,0);this.camera.updateMatrixWorld();this.needsRender=true;
  }
  private resize() {const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.updateCamera();}
  applySpec(spec:SquishySpec) {
    this.stopComparison();this.assignSpec(spec);
  }
  private assignSpec(spec:SquishySpec) {
    const shapeChanged=JSON.stringify(spec.proportions)!==JSON.stringify(this.body.spec.proportions);
    if(shapeChanged) {
      // Allocate and validate an entire new generation before the atomic swap.
      this.rebuildBody(spec);
    } else this.body.setMaterial(spec);
    this.updateMaterial(spec);
  }
  setAppearance(next:Appearance){
    this.stopComparison();const changed=this.appearance.shape!==next.shape;this.appearance={...next};this.samples=[];
    if(changed)this.rebuildBody(this.body.spec);else this.rebuildDecorations();
    this.updateMaterial(this.body.spec);this.refreshSurface();
  }
  private rebuildBody(spec:SquishySpec){
    const next=new SoftBody(spec,this.appearance.shape),surface=createSurface(next.cage),old=this.geometry;
    this.release();this.body=next;this.surface=surface;this.geometry=this.makeGeometry();this.mesh.geometry=this.geometry;old.dispose();this.clock.pause();this.updateCamera();
    this.visibleProbe=surfacePoint(this.surface,standardLogicalPoint(this.body.cage));this.internalProbe=cagePoint(this.body.cage,standardLogicalPoint(this.body.cage));this.rebuildDecorations();
  }
  private rebuildDecorations(){
    this.needsRender=true;
    if(this.decorations){this.scene.remove(this.decorations.group);this.decorations.dispose();this.decorations=undefined;}
    if(!this.detailLibrary)return;
    this.decorations=new Decorations(this.surface,this.appearance,this.detailLibrary);this.scene.add(this.decorations.group);
    this.decorations.update(this.geometry.getAttribute('position').array,this.geometry.getAttribute('normal').array);
  }
  private updateMaterial(spec:SquishySpec){
    const m=this.mesh.material,clear=this.appearance.effect==='clear',glitter=this.appearance.effect==='glitter';
    m.vertexColors=['peanut','capybara'].includes(this.appearance.shape);
    if(this.appearance.shape==='gumdrop'&&!this.sugarTexture){
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(256,256);let seed=9021;
      for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const shade=80+(seed>>>24)*.6;pixels.data.set([shade,shade,shade,255],i);}
      ctx.putImageData(pixels,0,0);this.sugarTexture=new THREE.CanvasTexture(canvas);this.sugarTexture.wrapS=this.sugarTexture.wrapT=THREE.RepeatWrapping;
    }
    m.bumpMap=this.appearance.shape==='gumdrop'?this.sugarTexture!:null;m.bumpScale=.025;
    m.color.set(spec.color);m.roughness=clear?.09:glitter?.4:compileSpec(spec).roughness;m.transmission=clear?.91:0;m.ior=1.38;m.thickness=.9;m.attenuationColor.set(spec.color);m.attenuationDistance=clear?2.8:Infinity;m.clearcoat=clear?1:glitter?.35:0;m.clearcoatRoughness=.12;m.envMapIntensity=clear?1.1:.25;
    if(this.appearance.shape==='gumdrop'){m.bumpScale=.065;m.roughness=clear?.2:.7;m.clearcoat=0;}
    if(clear&&!this.environment){const generator=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=generator.fromScene(room,.04);room.dispose();generator.dispose();}
    m.envMap=clear?this.environment!.texture:null;m.needsUpdate=true;this.clearFloor.visible=clear;this.needsRender=true;
  }
  private refreshSurface(){
    this.needsRender=true;
    embedSurface(this.body.cage,this.body.positions,this.surface,this.geometry.getAttribute('position').array as Float32Array);
    this.geometry.getAttribute('position').needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
    this.decorations?.update(this.geometry.getAttribute('position').array,this.geometry.getAttribute('normal').array);
  }
  async exportPNG(){
    this.renderer.render(this.scene,this.camera);
    const blob=await new Promise<Blob>((resolve,reject)=>this.canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG export failed')),'image/png'));
    return blob;
  }
  reset(){this.stopComparison();this.release();this.body.reset();this.refreshSurface();this.onState('rest');}
  rotate(){this.stopComparison();this.release();this.angle+=Math.PI/2;this.updateCamera();}
  beginStandardPress() {this.stopComparison();this.keyboard=true;this.held=true;this.pressStart=this.body.time;this.haloEmbedding=this.visibleProbe;this.onState('pressing');}
  compare(before:SquishySpec,after:SquishySpec,notify:(phase:0|1|null)=>void) {
    this.stopComparison();this.release();
    const sameAppearance={...after,proportions:before.proportions,color:before.color,finish:before.finish};
    this.comparison={before,after:sameAppearance,original:this.body.spec,phase:0,elapsed:0,notify};
    this.assignSpec(before);this.body.reset();this.haloEmbedding=this.visibleProbe;this.refreshSurface();notify(0);this.onState('pressing');
  }
  stopComparison() {
    const comparison=this.comparison;if(!comparison)return;
    this.comparison=undefined;this.haloEmbedding=null;this.halo.visible=false;this.assignSpec(comparison.original);this.body.reset();this.refreshSurface();comparison.notify(null);this.onState('rest');
  }
  release() {
    if(this.pointer!==null&&this.canvas.hasPointerCapture(this.pointer))this.canvas.releasePointerCapture(this.pointer);
    this.pointer=null;this.keyboard=false;this.held=false;this.pointerPoint=null;this.body.setContact(null);this.halo.visible=false;this.haloEmbedding=null;this.needsRender=true;this.onState('recovering');
  }
  private hit(clientX:number,clientY:number) {
    const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);
    const hit=this.raycaster.intersectObject(this.mesh,false)[0];if(!hit?.face)return null;
    const attr=this.geometry.getAttribute('position'),{a,b,c}=hit.face;
    const va=new THREE.Vector3().fromBufferAttribute(attr,a),vb=new THREE.Vector3().fromBufferAttribute(attr,b),vc=new THREE.Vector3().fromBufferAttribute(attr,c);
    const bary=THREE.Triangle.getBarycoord(hit.point,va,vb,vc,new THREE.Vector3());if(!bary)return null;
    const ref:Vec3=[0,0,0];for(let axis=0;axis<3;axis++)ref[axis]=this.surface.rest[a*3+axis]*bary.x+this.surface.rest[b*3+axis]*bary.y+this.surface.rest[c*3+axis]*bary.z;
    // Raycast the deformed surface, but use its reference normal for force.
    // Otherwise the dent rotates its own force and reinforces a fold on drag.
    const normals=new THREE.BufferAttribute(this.referenceNormals,3),normal=new THREE.Vector3().fromBufferAttribute(normals,a).multiplyScalar(bary.x).addScaledVector(new THREE.Vector3().fromBufferAttribute(normals,b),bary.y).addScaledVector(new THREE.Vector3().fromBufferAttribute(normals,c),bary.z).normalize();
    return {ref,normal:normal.toArray() as Vec3,world:hit.point,embedding:{nodes:[a,b,c],weights:[bary.x,bary.y,bary.z]}};
  }
  private bindInput() {
    this.canvas.addEventListener('pointerdown',event=>{
      if(this.pointer!==null||event.button!==0)return;this.stopComparison();const hit=this.hit(event.clientX,event.clientY);if(!hit)return;
      event.preventDefault();this.canvas.focus({preventScroll:true});this.pointer=event.pointerId;this.canvas.setPointerCapture(event.pointerId);this.held=true;this.keyboard=false;this.pressStart=this.body.time;this.startY=this.currentY=event.clientY;this.pointerPoint=hit.ref;this.pointerNormal=hit.normal;this.targetNormal=hit.normal;this.haloEmbedding=hit.embedding;this.moveHalo(hit.world,hit.normal);this.onState('pressing');
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(this.pointer!==event.pointerId)return;event.preventDefault();this.currentY=event.clientY;const hit=this.hit(event.clientX,event.clientY);if(hit){this.pointerPoint=hit.ref;this.targetNormal=hit.normal;this.haloEmbedding=hit.embedding;this.moveHalo(hit.world,this.pointerNormal);}
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)this.canvas.addEventListener(name,event=>{if(event.pointerId===this.pointer)this.release();});
    this.canvas.addEventListener('keydown',event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();this.beginStandardPress();}if(event.code==='Escape')this.reset();});
    this.canvas.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();this.release();}});
    this.canvas.addEventListener('blur',()=>this.release());window.addEventListener('blur',()=>{this.stopComparison();this.release();});
    document.addEventListener('visibilitychange',()=>{this.stopComparison();this.release();this.clock.pause();this.previous=0;});
  }
  private moveHalo(world:THREE.Vector3,normal:Vec3){this.halo.visible=true;this.halo.position.copy(world).addScaledVector(new THREE.Vector3(...normal),.022);this.halo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal));}
  private animate(t:number) {
    const elapsed=this.previous?(t-this.previous)/1000:0;this.previous=t;
    const start=performance.now(),moving=this.held||!!this.comparison||this.body.maxDisplacement()>1e-5;
    if(!moving)this.clock.pause();
    if(moving)this.clock.advance(elapsed,()=>{
      const comparison=this.comparison;
      if(comparison){
        this.body.setContact(standardContact(this.body.cage,comparison.elapsed,STANDARD_GESTURE.holdSeconds));
        if(comparison.elapsed>=STANDARD_GESTURE.holdSeconds){this.haloEmbedding=null;this.halo.visible=false;this.onState('recovering');}
      }
      if(this.held){const age=this.body.time-this.pressStart;
        if(this.keyboard)this.body.setContact(standardContact(this.body.cage,age));
        else if(this.pointerPoint){
          const n=this.pointerNormal.map((v,i)=>v+(this.targetNormal[i]-v)*(1-Math.exp(-(1/120)/.12))) as Vec3,length=Math.hypot(...n);
          this.pointerNormal=n.map(v=>v/length) as Vec3;
          this.body.setContact({point:this.pointerPoint,normal:this.pointerNormal,intensity:pressureAt(age,(this.currentY-this.startY)/220),sustain:sustainedPressureAt(age)});
        }
      }
      this.body.step();
      if(comparison){
        comparison.elapsed+=1/120;
        if(comparison.elapsed+1e-10>=STANDARD_GESTURE.holdSeconds+STANDARD_GESTURE.recoverySeconds){
          if(comparison.phase===0){comparison.phase=1;comparison.elapsed=0;this.assignSpec(comparison.after);this.body.reset();this.haloEmbedding=this.visibleProbe;comparison.notify(1);this.onState('pressing');}
          else this.stopComparison();
        }
      }
    });const solved=performance.now();
    if(moving)this.refreshSurface();
    this.soundFeedback?.(this.appearance.shape,this.body.contact?.intensity??0);
    if(this.haloEmbedding){const world=new THREE.Vector3(),normal=new THREE.Vector3();for(let i=0;i<3;i++){world.addScaledVector(new THREE.Vector3().fromBufferAttribute(this.geometry.getAttribute('position'),this.haloEmbedding.nodes[i]),this.haloEmbedding.weights[i]);normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(this.geometry.getAttribute('normal'),this.haloEmbedding.nodes[i]),this.haloEmbedding.weights[i]);}this.moveHalo(world,normal.normalize().toArray() as Vec3);}
    const surfaced=performance.now();
    if(this.needsRender){this.renderer.render(this.scene,this.camera);this.needsRender=false;}const rendered=performance.now();
    if(moving&&elapsed>0&&elapsed<.25) {this.samples.push({solverMs:solved-start,surfaceMs:surfaced-solved,renderMs:rendered-surfaced,frameMs:elapsed*1000});if(this.samples.length>600)this.samples.shift();}
    if(!this.held&&!this.comparison&&this.body.maxDisplacement()<.009)this.onState('rest');
    this.frame=requestAnimationFrame(next=>this.animate(next));
  }
  diagnostics() {return {contactDepthUnits:this.haloEmbedding?pointDepth(this.surface.rest,this.geometry.getAttribute('position').array,this.haloEmbedding,this.keyboard?[0,1,0]:this.pointerNormal):0,contact:this.body.contact,appearance:{...this.appearance},detailsReady:!!this.detailLibrary,decorationVertices:this.decorations?.vertices??0,spec:this.body.spec,gesture:STANDARD_GESTURE,renderedSurfaceDepthUnits:pointDepth(this.surface.rest,this.geometry.getAttribute('position').array,this.visibleProbe,STANDARD_GESTURE.normal),internalCageDepthUnits:pointDepth(this.body.cage.rest,this.body.positions,this.internalProbe,STANDARD_GESTURE.normal),maxDisplacement:this.body.maxDisplacement(),minVolumeRatio:this.body.minVolumeRatio(),safetyBackoffs:this.body.safetyBackoffs,physicsTime:this.body.time,vertices:this.surface.rest.length/3,tetrahedra:this.body.cage.volumes.length,particles:this.body.cage.inverseMass.length,triangles:this.surface.indices.length/3,samples:this.samples,renderer:this.renderer.info,webgl:this.renderer.getContext().getParameter(this.renderer.getContext().VERSION) as string};}
  dispose(){this.disposed=true;this.decorations?.dispose();this.environment?.dispose();this.sugarTexture?.dispose();this.clearFloor.geometry.dispose();const floorMaterial=this.clearFloor.material as THREE.MeshStandardMaterial;floorMaterial.map?.dispose();floorMaterial.dispose();cancelAnimationFrame(this.frame);this.observer.disconnect();this.geometry.dispose();this.mesh.material.dispose();this.renderer.dispose();}
}
