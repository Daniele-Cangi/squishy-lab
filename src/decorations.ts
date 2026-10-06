import * as THREE from 'three';
import { facePoint, type MaterialPoint, type SurfaceEmbedding } from './physics/cage';
import type { Appearance } from './collection';
export interface DetailAsset {axis:number;sign:number;positions:number[];indices:number[];color:string}
export interface DetailLibrary {version:1;groups:Record<string,DetailAsset[]>}
let library:Promise<DetailLibrary>|undefined;
export function loadDetails(){return library??=fetch(`${import.meta.env.BASE_URL}assets/collection-details.json`).then(r=>{if(!r.ok)throw new Error('Details unavailable');return r.json() as Promise<DetailLibrary>;});}
export interface BoundVertex extends MaterialPoint {height:number}
export function bindDetails(surface:SurfaceEmbedding,asset:DetailAsset):BoundVertex[]{
  const result:BoundVertex[]=[];
  for(let i=0;i<asset.positions.length;i+=3)result.push({...facePoint(surface,asset.axis,asset.sign,asset.positions[i],asset.positions[i+1]),height:asset.positions[i+2]});
  return result;
}
// Sample the very triangles being rendered, including their current normals.
// No second deformation state: lettering and facial details cannot lag the dent.
export function updateDetails(bindings:BoundVertex[],positions:ArrayLike<number>,normals:ArrayLike<number>,out:Float32Array){
  for(let i=0;i<bindings.length;i++){
    const {nodes,weights,height}=bindings[i];let nx=0,ny=0,nz=0;
    for(let k=0;k<3;k++){const n=nodes[k]*3,w=weights[k];nx+=normals[n]*w;ny+=normals[n+1]*w;nz+=normals[n+2]*w;}
    const length=Math.hypot(nx,ny,nz)||1;
    for(let a=0;a<3;a++){let p=0;for(let k=0;k<3;k++)p+=positions[nodes[k]*3+a]*weights[k];out[i*3+a]=p+[nx,ny,nz][a]/length*height;}
  }
}
export class Decorations {
  readonly group=new THREE.Group();
  private meshes:{mesh:THREE.Mesh;bindings:BoundVertex[]}[]=[];
  private sparkle:THREE.Points|undefined;
  private sparkleBindings:BoundVertex[]=[];
  constructor(surface:SurfaceEmbedding,appearance:Appearance,assets:DetailLibrary){
    const face=appearance.shape==='cat'?'cat-face':'face',expression=appearance.expression??'smile';
    const names=[...(appearance.label==='none'?[]:[appearance.label]),...(appearance.face&&!appearance.text?.trim()?[expression==='smile'?face:`${face}-${expression}`]:[]),...(appearance.shape==='strawberry'?['seeds','leaves']:[]),...(['chocolate','banana','cat','cheese','peanut'].includes(appearance.shape)?[appearance.shape]:[])];
    const batches=new Map<string,{positions:number[];indices:number[];bindings:BoundVertex[]}>();
    for(const name of names)for(const asset of assets.groups[name]??[]){
      let batch=batches.get(asset.color);if(!batch){batch={positions:[],indices:[],bindings:[]};batches.set(asset.color,batch);}
      const offset=batch.bindings.length;batch.bindings.push(...bindDetails(surface,asset));batch.positions.push(...asset.positions);batch.indices.push(...asset.indices.map(i=>i+offset));
    }
    for(const [color,batch] of batches){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(batch.positions.length),3));geometry.setIndex(batch.indices);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.62,side:THREE.DoubleSide}));mesh.frustumCulled=false;
      this.meshes.push({mesh,bindings:batch.bindings});this.group.add(mesh);
    }
    if(appearance.text?.trim()){
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;
      ctx.textAlign='center';ctx.textBaseline='middle';let size=180;const text=appearance.text.trim();
      do{ctx.font=`${size}px "${appearance.font??'Chewy'}", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;if(ctx.measureText(text).width<940)break;size-=2;}while(size>18);
      ctx.lineJoin='round';ctx.strokeStyle='#fff8ec';ctx.lineWidth=10;ctx.strokeText(text,512,128);ctx.fillStyle=appearance.textColor??'#47334e';ctx.fillText(text,512,128);
      const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
      const columns=32,rows=12,bindings:BoundVertex[]=[],uv:number[]=[],indices:number[]=[];
      for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
        bindings.push({...facePoint(surface,2,1,(x/columns-.5)*1.45,(y/rows-.5)*.85+.25),height:.012});uv.push(x/columns,y/rows);
        if(x<columns&&y<rows){const a=x+y*(columns+1);indices.push(a,a+1,a+columns+1,a+1,a+columns+2,a+columns+1);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bindings.length*3),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));mesh.frustumCulled=false;this.meshes.push({mesh,bindings});this.group.add(mesh);
    }
    if(appearance.effect!=='foam'){
      // Deterministic flecks lie in material coordinates and travel with the skin.
      // The clear finish uses the same flecks; it does not imply a fluid solver.
      const count=360,colors=new Float32Array(count*3);let seed=19;
      const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      for(let i=0;i<count;i++){
        const axis=i%3,sign=i%7===0?-1:1;
        this.sparkleBindings.push({...facePoint(surface,axis,sign,random()*1.88-.94,random()*1.88-.94),height:.008});
        new THREE.Color(['#fffef3','#f7d782','#e6aaff','#bbf4ff'][i%4]).toArray(colors,i*3);
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(16,1);ctx.lineTo(22,12);ctx.lineTo(31,16);ctx.lineTo(22,20);ctx.lineTo(16,31);ctx.lineTo(11,21);ctx.lineTo(1,16);ctx.lineTo(11,11);ctx.closePath();ctx.fill();
      const map=new THREE.CanvasTexture(canvas);
      this.sparkle=new THREE.Points(geometry,new THREE.PointsMaterial({size:.045,map,alphaTest:.12,transparent:true,vertexColors:true,sizeAttenuation:true,depthWrite:false}));this.sparkle.frustumCulled=false;this.group.add(this.sparkle);
    }
  }
  update(positions:ArrayLike<number>,normals:ArrayLike<number>){
    for(const {mesh,bindings}of this.meshes){const attr=mesh.geometry.getAttribute('position');updateDetails(bindings,positions,normals,attr.array as Float32Array);attr.needsUpdate=true;mesh.geometry.computeVertexNormals();}
    if(this.sparkle){const attr=this.sparkle.geometry.getAttribute('position');updateDetails(this.sparkleBindings,positions,normals,attr.array as Float32Array);attr.needsUpdate=true;}
  }
  get vertices(){return this.meshes.reduce((n,m)=>n+m.bindings.length,0)+this.sparkleBindings.length;}
  dispose(){for(const {mesh}of this.meshes){mesh.geometry.dispose();(mesh.material as THREE.MeshBasicMaterial).map?.dispose();(mesh.material as THREE.Material).dispose();}this.sparkle?.geometry.dispose();const material=this.sparkle?.material as THREE.PointsMaterial|undefined;material?.map?.dispose();material?.dispose();}
}

