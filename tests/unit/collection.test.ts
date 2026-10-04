import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { COLLECTION,DEFAULT_APPEARANCE,FACE_EXPRESSIONS,validateAppearance,type ShapeId } from '../../src/collection';
import { createSurface,embedSurface,facePoint,samplePoint,signedVolume,shapePoint,CHEESE_POCKETS } from '../../src/physics/cage';
import { SoftBody } from '../../src/physics/solver';
import { standardContact } from '../../src/physics/gesture';
import { DEFAULT_SPEC } from '../../src/shared/spec';
import { bindDetails,updateDetails,type DetailLibrary } from '../../src/decorations';
const assets=JSON.parse(readFileSync('public/assets/collection-details.json','utf8')) as DetailLibrary;
describe('local collection geometry',()=>{
  for(const shape of ['butter','strawberry','cube','chocolate','banana','cat','cheese','peanut'] as ShapeId[])it(`${shape}: closed surface, positive cells, safe compression and recovery`,()=>{
    const body=new SoftBody(DEFAULT_SPEC,shape),surface=createSurface(body.cage),edges=new Map<string,number>();
    for(let t=0;t<surface.indices.length;t+=3)for(let a=0;a<3;a++){const edge=[surface.indices[t+a],surface.indices[t+(a+1)%3]].sort((a,b)=>a-b).join(',');edges.set(edge,(edges.get(edge)??0)+1);}
    expect([...edges.values()].every(v=>v===2)).toBe(true);
    for(let t=0;t<body.cage.tets.length;t+=4){
      const ids=Array.from(body.cage.tets.slice(t,t+4)) as [number,number,number,number];expect(signedVolume(body.cage.rest,...ids)).toBeGreaterThan(1e-7);
      // Reordering a folded reference cell must not conceal an inverted map.
      expect(signedVolume(body.cage.logical,...ids)).toBeGreaterThan(0);
    }
    let minimum=1;for(let i=0;i<240;i++){body.setContact(standardContact(body.cage,i/120));body.step();minimum=Math.min(minimum,body.minVolumeRatio());}
    const held=body.maxDisplacement();expect(held).toBeGreaterThan(.08);expect(minimum).toBeGreaterThan(.17);
    body.setContact(null);for(let i=0;i<960;i++)body.step();expect(body.maxDisplacement()).toBeLessThan(held*.15);expect(body.minVolumeRatio()).toBeGreaterThan(.17);
  });
  for(const shape of ['chocolate','banana','cat','cheese','peanut'] as ShapeId[])it(`${shape}: thin proportions tolerate off-center maximum sustained pressure`,()=>{
    const body=new SoftBody({...DEFAULT_SPEC,proportions:{width:1.55,height:.65,depth:.9},softness:1,compressibility:.95},shape);
    for(const q of [[.6,1,-.6],[-.6,.4,1]] as [number,number,number][]){
      const point=shapePoint(...q,body.cage.radii,shape),normal:[number,number,number]=q[1]===1?[0,1,0]:[0,0,1];
      for(let i=0;i<180;i++){body.setContact({point,normal,intensity:i/90,sustain:1});body.step();expect(body.minVolumeRatio()).toBeGreaterThan(.17);}
      expect(body.maxDisplacement()).toBeGreaterThan(.01);body.reset();
    }
  });
  it('distinct silhouettes and cheese pockets belong to the physical reference',()=>{
    const p=(shape:ShapeId,x:number,y:number,z:number)=>shapePoint(x,y,z,[1,1,1],shape);
    expect(p('banana',.85,0,0)[1]).toBeGreaterThan(p('banana',0,0,0)[1]+.7);
    expect(Math.abs(p('banana',-1,0,0)[0])).toBeGreaterThan(Math.abs(p('banana',1,0,0)[0])*1.1);
    for(const shape of ['banana','peanut'] as ShapeId[])expect(new SoftBody(DEFAULT_SPEC,shape).cage.inverseMass.some(m=>m===0)).toBe(true);
    expect(p('cat',.67,1,0)[1]).toBeGreaterThan(p('cat',0,1,0)[1]+.25);
    expect(p('peanut',.55,0,1)[2]).toBeGreaterThan(p('peanut',0,0,1)[2]+.1);
    expect(p('chocolate',0,1,.5)[1]).toBeGreaterThan(p('chocolate',1/3,1,.5)[1]+.1);
    expect(Math.abs(p('cheese',1,0,-1)[0])).toBeLessThan(Math.abs(p('cheese',1,0,1)[0])*.3);
    for(const pocket of CHEESE_POCKETS){
      const center=p('cheese',pocket.u,pocket.axis===1?1:pocket.v,pocket.axis===2?1:pocket.v);
      const rim=p('cheese',pocket.u+pocket.radius,pocket.axis===1?1:pocket.v,pocket.axis===2?1:pocket.v);
      expect(center[pocket.axis]).toBeLessThan(rim[pocket.axis]-.05);
    }
  });
  for(const shape of ['chocolate','banana','cat','cheese','peanut'] as ShapeId[])it(`${shape}: Blender detail coordinates are bounded and attach to render triangles`,()=>{
    const body=new SoftBody(DEFAULT_SPEC,shape),surface=createSurface(body.cage);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.rest.slice(),3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
    for(const asset of assets.groups[shape]){
      expect(asset.positions.length).toBeGreaterThan(0);expect(asset.indices.every(i=>i>=0&&i<asset.positions.length/3)).toBe(true);
      for(let i=0;i<asset.positions.length;i+=3){expect(Math.abs(asset.positions[i])).toBeLessThanOrEqual(1);expect(Math.abs(asset.positions[i+1])).toBeLessThanOrEqual(1);}
      const bindings=bindDetails(surface,asset),out=new Float32Array(asset.positions.length);updateDetails(bindings,surface.rest,geometry.getAttribute('normal').array,out);expect(out.every(Number.isFinite)).toBe(true);
      for(let i=0;i<bindings.length;i+=29){const p=samplePoint(surface.rest,bindings[i]);expect(Math.hypot(out[i*3]-p[0],out[i*3+1]-p[1],out[i*3+2]-p[2])).toBeCloseTo(bindings[i].height,5);}
    }geometry.dispose();
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
    expect(DEFAULT_APPEARANCE.face).toBe(true);expect(DEFAULT_APPEARANCE.expression).toBe('smile');
    const legacy={shape:'mochi',label:'none',face:false,effect:'foam'};expect(validateAppearance(legacy)).toEqual(legacy);
    expect(()=>validateAppearance({...DEFAULT_APPEARANCE,expression:'unknown'})).toThrow();
    for(const c of COLLECTION)expect(validateAppearance(c.appearance)).toEqual(c.appearance);
    expect(()=>validateAppearance({shape:'shark',effect:'clear',label:'none',face:true})).toThrow();expect(()=>validateAppearance({shape:'cube',effect:'clear',label:'butter',face:true})).toThrow();
    expect(DEFAULT_SPEC.archetype).toBe('mochi');
  });
  it('every expression print stays bound to the rendered skin on mochi, berry and cat',()=>{
    for(const shape of ['mochi','strawberry','cat']as ShapeId[]){
      const body=new SoftBody(DEFAULT_SPEC,shape),surface=createSurface(body.cage),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.rest.slice(),3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
      for(let i=0;i<180;i++){body.setContact(standardContact(body.cage,i/120));body.step();}embedSurface(body.cage,body.positions,surface,geometry.getAttribute('position').array as Float32Array);geometry.computeVertexNormals();
      const signatures=new Set<string>();
      for(const expression of FACE_EXPRESSIONS){
        const key=(shape==='cat'?'cat-face':'face')+(expression==='smile'?'':`-${expression}`);expect(assets.groups[key]?.length).toBeGreaterThan(0);signatures.add(JSON.stringify(assets.groups[key]));
        for(const asset of assets.groups[key]){const bindings=bindDetails(surface,asset),out=new Float32Array(asset.positions.length);updateDetails(bindings,geometry.getAttribute('position').array,geometry.getAttribute('normal').array,out);expect(out.every(Number.isFinite)).toBe(true);for(let i=0;i<bindings.length;i+=31){const p=samplePoint(geometry.getAttribute('position').array,bindings[i]);expect(Math.hypot(out[i*3]-p[0],out[i*3+1]-p[1],out[i*3+2]-p[2])).toBeCloseTo(bindings[i].height,5);}}
      }expect(signatures.size).toBe(5);geometry.dispose();
    }
  });
});
