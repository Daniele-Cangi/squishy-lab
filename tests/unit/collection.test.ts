import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { COLLECTION,validateAppearance,type ShapeId } from '../../src/collection';
import { createSurface,embedSurface,facePoint,samplePoint,signedVolume } from '../../src/physics/cage';
import { SoftBody } from '../../src/physics/solver';
import { standardContact } from '../../src/physics/gesture';
import { DEFAULT_SPEC } from '../../src/shared/spec';
import { bindDetails,updateDetails,type DetailLibrary } from '../../src/decorations';
const assets=JSON.parse(readFileSync('public/assets/collection-details.json','utf8')) as DetailLibrary;
describe('local collection geometry',()=>{
  for(const shape of ['butter','strawberry','cube'] as ShapeId[])it(`${shape}: closed surface, positive cells, safe compression and recovery`,()=>{
    const body=new SoftBody(DEFAULT_SPEC,shape),surface=createSurface(body.cage),edges=new Map<string,number>();
    for(let t=0;t<surface.indices.length;t+=3)for(let a=0;a<3;a++){const edge=[surface.indices[t+a],surface.indices[t+(a+1)%3]].sort((a,b)=>a-b).join(',');edges.set(edge,(edges.get(edge)??0)+1);}
    expect([...edges.values()].every(v=>v===2)).toBe(true);
    for(let t=0;t<body.cage.tets.length;t+=4)expect(signedVolume(body.cage.rest,...Array.from(body.cage.tets.slice(t,t+4)) as [number,number,number,number])).toBeGreaterThan(1e-7);
    let minimum=1;for(let i=0;i<240;i++){body.setContact(standardContact(body.cage,i/120));body.step();minimum=Math.min(minimum,body.minVolumeRatio());}
    const held=body.maxDisplacement();expect(held).toBeGreaterThan(.08);expect(minimum).toBeGreaterThan(.17);
    body.setContact(null);for(let i=0;i<960;i++)body.step();expect(body.maxDisplacement()).toBeLessThan(held*.15);expect(body.minVolumeRatio()).toBeGreaterThan(.17);
  });
  it('the face sampler uses actual welded render triangles including corners',()=>{
    const surface=createSurface(new SoftBody(DEFAULT_SPEC,'butter').cage);
    for(const face of surface.faceGrids)for(const [u,v]of [[-1,-1],[1,1],[.37,-.22],[-.94,.94]]){
      const point=facePoint(surface,face.axis,face.sign,u,v);expect(point.weights.reduce((a,b)=>a+b)).toBeCloseTo(1);expect(Math.min(...point.weights)).toBeGreaterThanOrEqual(0);
      const q=samplePoint(surface.logical,point),other=[0,1,2].filter(a=>a!==face.axis);expect(q[face.axis]).toBe(face.sign);expect(q[other[0]]).toBeCloseTo(u,6);expect(q[other[1]]).toBeCloseTo(v,6);
      expect(surface.indices.some((_,t)=>t%3===0&&point.nodes.every(n=>surface.indices.slice(t,t+3).includes(n)))).toBe(true);
    }
  });
  it('Blender relief stays attached to the dent and returns with the body',()=>{
    const body=new SoftBody(DEFAULT_SPEC,'butter'),surface=createSurface(body.cage),asset=assets.groups.butter[0],bindings=bindDetails(surface,asset);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.rest.slice(),3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
    const out=new Float32Array(asset.positions.length),positions=geometry.getAttribute('position').array as Float32Array;
    updateDetails(bindings,positions,geometry.getAttribute('normal').array,out);const rest=out.slice();
    for(let i=0;i<240;i++){body.setContact(standardContact(body.cage,i/120));body.step();}embedSurface(body.cage,body.positions,surface,positions);geometry.computeVertexNormals();updateDetails(bindings,positions,geometry.getAttribute('normal').array,out);
    expect(Math.max(...out.map((v,i)=>Math.abs(v-rest[i])))).toBeGreaterThan(.05);
    for(let i=0;i<bindings.length;i+=53){const p=samplePoint(positions,bindings[i]);expect(Math.hypot(out[i*3]-p[0],out[i*3+1]-p[1],out[i*3+2]-p[2])).toBeCloseTo(bindings[i].height,5);}
    body.reset();embedSurface(body.cage,body.positions,surface,positions);geometry.computeVertexNormals();updateDetails(bindings,positions,geometry.getAttribute('normal').array,out);expect(out).toEqual(rest);geometry.dispose();
  });
  it('saved appearances are bounded and remain independent of the AI contract',()=>{
    for(const c of COLLECTION)expect(validateAppearance(c.appearance)).toEqual(c.appearance);
    expect(()=>validateAppearance({shape:'shark',effect:'clear',label:'none',face:true})).toThrow();expect(()=>validateAppearance({shape:'cube',effect:'clear',label:'butter',face:true})).toThrow();
    expect(DEFAULT_SPEC.archetype).toBe('mochi');
  });
});
