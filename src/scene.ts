import * as THREE from 'three';
import { compileSpec, type SquishySpec } from './shared/spec';
import { createSurface, embedSurface, roundedPoint, type SurfaceEmbedding, type Vec3 } from './physics/cage';
import { FixedClock, SoftBody } from './physics/solver';
export class SquishyScene {
  readonly renderer:THREE.WebGLRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(36,1,.1,40);
  body:SoftBody;
  private surface:SurfaceEmbedding;
  private geometry:THREE.BufferGeometry;
  private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
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
  private angle=.38;
  private samples:{solverMs:number;surfaceMs:number;renderMs:number;frameMs:number}[]=[];
  private halo:THREE.Mesh;
  private haloEmbedding:{nodes:number[];weights:number[]}|null=null;
  constructor(private canvas:HTMLCanvasElement,spec:SquishySpec,private onState:(s:'pressing'|'recovering'|'rest')=>void) {
    this.body=new SoftBody(spec);this.surface=createSurface(this.body.cage);this.geometry=this.makeGeometry();
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.mesh=new THREE.Mesh(this.geometry,new THREE.MeshStandardMaterial({color:spec.color,roughness:compileSpec(spec).roughness,metalness:0}));
    this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.scene.add(this.mesh);
    this.scene.add(new THREE.HemisphereLight('#f8fcff','#a2aed1',1.8));
    const key=new THREE.DirectionalLight('#fff8ee',3.4);key.position.set(-3,6,4);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.bias=-.0002;key.shadow.normalBias=.02;key.shadow.radius=3;this.scene.add(key);
    const fill=new THREE.DirectionalLight('#e1ddff',1.6);fill.position.set(3,3,-3);this.scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#324c83',opacity:.15}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
    const ctx=shadowCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(49,68,113,.22)');gradient.addColorStop(.5,'rgba(49,68,113,.12)');gradient.addColorStop(1,'rgba(49,68,113,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,3.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.012;this.scene.add(contactShadow);
    this.halo=new THREE.Mesh(new THREE.RingGeometry(.10,.12,36),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false}));this.halo.visible=false;this.halo.renderOrder=3;this.scene.add(this.halo);
    this.updateCamera();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
    this.bindInput();this.frame=requestAnimationFrame(t=>this.animate(t));
  }
  private makeGeometry() {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.surface.rest.slice(),3));geometry.setIndex(new THREE.BufferAttribute(this.surface.indices,1));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
  }
  private updateCamera() {this.camera.position.set(Math.sin(this.angle)*5.7,3.65,Math.cos(this.angle)*5.7);this.camera.lookAt(0,this.body.cage.radii[1]*.95,0);this.camera.updateMatrixWorld();}
  private resize() {const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  applySpec(spec:SquishySpec) {
    const shapeChanged=JSON.stringify(spec.proportions)!==JSON.stringify(this.body.spec.proportions);
    if(shapeChanged) {
      // Allocate and validate an entire new generation before the atomic swap.
      const next=new SoftBody(spec),surface=createSurface(next.cage),old=this.geometry;
      this.release();this.body=next;this.surface=surface;this.geometry=this.makeGeometry();this.mesh.geometry=this.geometry;old.dispose();this.updateCamera();
    } else this.body.setMaterial(spec);
    this.mesh.material.color.set(spec.color);this.mesh.material.roughness=compileSpec(spec).roughness;
  }
  reset(){this.release();this.body.reset();this.onState('rest');}
  rotate(){this.release();this.angle+=Math.PI/2;this.updateCamera();}
  beginStandardPress() {this.keyboard=true;this.held=true;this.pressStart=performance.now();this.pointerPoint=roundedPoint(0,.55,1,this.body.cage.radii);this.pointerNormal=[0,.48,.88];this.onState('pressing');}
  release() {
    if(this.pointer!==null&&this.canvas.hasPointerCapture(this.pointer))this.canvas.releasePointerCapture(this.pointer);
    this.pointer=null;this.keyboard=false;this.held=false;this.pointerPoint=null;this.body.setContact(null);this.halo.visible=false;this.haloEmbedding=null;this.onState('recovering');
  }
  private hit(clientX:number,clientY:number) {
    const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);
    const hit=this.raycaster.intersectObject(this.mesh,false)[0];if(!hit?.face)return null;
    const attr=this.geometry.getAttribute('position'),{a,b,c}=hit.face;
    const va=new THREE.Vector3().fromBufferAttribute(attr,a),vb=new THREE.Vector3().fromBufferAttribute(attr,b),vc=new THREE.Vector3().fromBufferAttribute(attr,c);
    const bary=THREE.Triangle.getBarycoord(hit.point,va,vb,vc,new THREE.Vector3());if(!bary)return null;
    const ref:Vec3=[0,0,0];for(let axis=0;axis<3;axis++)ref[axis]=this.surface.rest[a*3+axis]*bary.x+this.surface.rest[b*3+axis]*bary.y+this.surface.rest[c*3+axis]*bary.z;
    const normals=this.geometry.getAttribute('normal'),normal=new THREE.Vector3().fromBufferAttribute(normals,a).multiplyScalar(bary.x).addScaledVector(new THREE.Vector3().fromBufferAttribute(normals,b),bary.y).addScaledVector(new THREE.Vector3().fromBufferAttribute(normals,c),bary.z).normalize();
    return {ref,normal:normal.toArray() as Vec3,world:hit.point,embedding:{nodes:[a,b,c],weights:[bary.x,bary.y,bary.z]}};
  }
  private bindInput() {
    this.canvas.addEventListener('pointerdown',event=>{
      if(this.pointer!==null||event.button!==0)return;const hit=this.hit(event.clientX,event.clientY);if(!hit)return;
      event.preventDefault();this.canvas.focus({preventScroll:true});this.pointer=event.pointerId;this.canvas.setPointerCapture(event.pointerId);this.held=true;this.keyboard=false;this.pressStart=performance.now();this.startY=this.currentY=event.clientY;this.pointerPoint=hit.ref;this.pointerNormal=hit.normal;this.haloEmbedding=hit.embedding;this.moveHalo(hit.world,hit.normal);this.onState('pressing');
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(this.pointer!==event.pointerId)return;event.preventDefault();this.currentY=event.clientY;const hit=this.hit(event.clientX,event.clientY);if(hit){if(this.pointerPoint&&Math.hypot(...hit.ref.map((v,i)=>v-this.pointerPoint![i]))>.04)this.pointerNormal=hit.normal;this.pointerPoint=hit.ref;this.haloEmbedding=hit.embedding;this.moveHalo(hit.world,hit.normal);}
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)this.canvas.addEventListener(name,event=>{if(event.pointerId===this.pointer)this.release();});
    this.canvas.addEventListener('keydown',event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();this.beginStandardPress();}if(event.code==='Escape')this.reset();});
    this.canvas.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();this.release();}});
    this.canvas.addEventListener('blur',()=>this.release());window.addEventListener('blur',()=>this.release());
    document.addEventListener('visibilitychange',()=>{this.release();this.clock.pause();this.previous=0;});
  }
  private moveHalo(world:THREE.Vector3,normal:Vec3){this.halo.visible=true;this.halo.position.copy(world).addScaledVector(new THREE.Vector3(...normal),.022);this.halo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal));}
  private animate(t:number) {
    const elapsed=this.previous?(t-this.previous)/1000:0;this.previous=t;
    if(this.held&&this.pointerPoint) {
      const ramp=Math.min(1,(t-this.pressStart)/1000/.85),drag=this.keyboard?0:(this.currentY-this.startY)/160;
      this.body.setContact({point:this.pointerPoint,normal:this.pointerNormal,intensity:Math.max(.15,Math.min(1,.18+ramp*.70+drag))});
    }
    const start=performance.now();this.clock.advance(elapsed,()=>this.body.step());const solved=performance.now();
    const array=this.geometry.getAttribute('position').array as Float32Array;embedSurface(this.body.cage,this.body.positions,this.surface,array);
    this.geometry.getAttribute('position').needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
    if(this.haloEmbedding){const world=new THREE.Vector3();for(let i=0;i<3;i++)world.addScaledVector(new THREE.Vector3().fromBufferAttribute(this.geometry.getAttribute('position'),this.haloEmbedding.nodes[i]),this.haloEmbedding.weights[i]);this.moveHalo(world,this.pointerNormal);}
    const surfaced=performance.now();
    this.renderer.render(this.scene,this.camera);const rendered=performance.now();
    if(elapsed>0&&elapsed<.25) {this.samples.push({solverMs:solved-start,surfaceMs:surfaced-solved,renderMs:rendered-surfaced,frameMs:elapsed*1000});if(this.samples.length>600)this.samples.shift();}
    if(!this.held&&this.body.maxDisplacement()<.009)this.onState('rest');
    this.frame=requestAnimationFrame(next=>this.animate(next));
  }
  diagnostics() {return {spec:this.body.spec,maxDisplacement:this.body.maxDisplacement(),minVolumeRatio:this.body.minVolumeRatio(),safetyBackoffs:this.body.safetyBackoffs,physicsTime:this.body.time,vertices:this.surface.rest.length/3,tetrahedra:this.body.cage.volumes.length,particles:this.body.cage.inverseMass.length,triangles:this.surface.indices.length/3,samples:this.samples,renderer:this.renderer.info,webgl:this.renderer.getContext().getParameter(this.renderer.getContext().VERSION) as string};}
  dispose(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.geometry.dispose();this.mesh.material.dispose();this.renderer.dispose();}
}
