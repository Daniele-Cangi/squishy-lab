import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SoftBody} from '../../src/physics/solver';
import {createSurface,embedSurface,shapePoint,signedVolume,facePoint,samplePoint} from '../../src/physics/cage';
import {standardContact} from '../../src/physics/gesture';
import {DEFAULT_SPEC} from '../../src/shared/spec';
import {bindDetails,updateDetails,type DetailLibrary} from '../../src/decorations';
const shapes=['drop','gumdrop','paw','capybara','donut'] as const;
for(const shape of shapes){
 it(`${shape}: manifold skin, positive physical cells, held recovery and exact reset`,()=>{
  const body=new SoftBody(DEFAULT_SPEC,shape),surface=createSurface(body.cage),edges=new Map<string,number>();
  for(let i=0;i<surface.indices.length;i+=3)for(let j=0;j<3;j++){const key=[surface.indices[i+j],surface.indices[i+(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}
  expect([...edges.values()].every(v=>v===2)).toBe(true);
  expect(surface.rest.length/3-edges.size+surface.indices.length/3).toBe(shape==='donut'?0:2);
  for(let i=0;i<body.cage.tets.length;i+=4)expect(signedVolume(body.cage.rest,...Array.from(body.cage.tets.slice(i,i+4)) as [number,number,number,number])).toBeGreaterThan(1e-7);
  for(let i=0;i<720;i++){body.setContact(standardContact(body.cage,i/120));body.step();}
  const held=body.maxDisplacement();expect(held).toBeGreaterThan(.05);expect(body.minVolumeRatio()).toBeGreaterThan(.17);expect(body.safetyBackoffs).toBe(0);
  body.setContact(null);for(let i=0;i<960;i++)body.step();expect(body.maxDisplacement()).toBeLessThan(held*.15);
  body.reset();const out=surface.rest.slice();embedSurface(body.cage,body.positions,surface,out);expect(out).toEqual(surface.rest);
 });
 it(`${shape}: thin proportions tolerate top and low side contact`,()=>{
  const body=new SoftBody({...DEFAULT_SPEC,proportions:{width:1.55,height:.65,depth:.9},softness:1,compressibility:.95},shape);
  for(const [q,normal] of [[[.65,1,-.3],[0,1,0]],[[-.6,-.45,1],[0,0,1]]] as [number[],number[]][]){
   const point=shapePoint(...q as [number,number,number],body.cage.radii,shape);
   for(let i=0;i<240;i++){body.setContact({point,normal:normal as [number,number,number],intensity:Math.min(1,i/90),sustain:1});body.step();}
   expect(body.minVolumeRatio()).toBeGreaterThan(.17);expect(body.positions.every(Number.isFinite)).toBe(true);expect(body.maxDisplacement()).toBeGreaterThan(.005);body.reset();
  }
 });
}
it('donut hole stays empty, outward triangles and periodic bindings are continuous',()=>{
 const body=new SoftBody(DEFAULT_SPEC,'donut'),s=createSurface(body.cage);let volume=0;
 for(let i=0;i<s.indices.length;i+=3){const [a,b,c]=Array.from(s.indices.slice(i,i+3)).map(n=>new THREE.Vector3().fromArray(s.rest,n*3));volume+=a.dot(b.clone().cross(c))/6;}
 expect(volume).toBeGreaterThan(0);
 for(let i=0;i<s.rest.length;i+=3)expect(Math.hypot(s.rest[i]/body.cage.radii[0],s.rest[i+2]/body.cage.radii[2])).toBeGreaterThan(.6);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(s.rest,3));geometry.setIndex(new THREE.BufferAttribute(s.indices,1));geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
 expect(new THREE.Raycaster(new THREE.Vector3(0,4,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh)).toHaveLength(0);
 for(const axis of [1,2])for(const sign of [-1,1])expect(samplePoint(s.rest,facePoint(s,axis,sign,-1,.3))).toEqual(samplePoint(s.rest,facePoint(s,axis,sign,1,.3)));
 geometry.dispose();mesh.material.dispose();
});
it('new bound Blender details follow the deformed surface with their relief intact',()=>{
 const assets=JSON.parse(readFileSync('public/assets/collection-details.json','utf8')) as DetailLibrary;
 for(const shape of ['paw','capybara','donut'] as const){
  const body=new SoftBody(DEFAULT_SPEC,shape),s=createSurface(body.cage),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(s.rest.slice(),3));geometry.setIndex(new THREE.BufferAttribute(s.indices,1));
  for(let i=0;i<240;i++){body.setContact(standardContact(body.cage,i/120));body.step();}embedSurface(body.cage,body.positions,s,geometry.getAttribute('position').array as Float32Array);geometry.computeVertexNormals();
  expect(assets.groups[shape].length).toBeGreaterThan(0);
  for(const asset of assets.groups[shape]){const bindings=bindDetails(s,asset),out=new Float32Array(asset.positions.length);updateDetails(bindings,geometry.getAttribute('position').array,geometry.getAttribute('normal').array,out);expect(out.every(Number.isFinite)).toBe(true);
   for(let i=0;i<bindings.length;i+=31){const p=samplePoint(geometry.getAttribute('position').array,bindings[i]);expect(Math.hypot(out[i*3]-p[0],out[i*3+1]-p[1],out[i*3+2]-p[2])).toBeCloseTo(bindings[i].height,5);}
  }geometry.dispose();
 }
});
