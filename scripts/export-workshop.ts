import { mkdirSync,writeFileSync } from 'node:fs';
import { createSurface,generateCage,CHEESE_POCKETS } from '../src/physics/cage';
import * as THREE from 'three';
import { DEFAULT_SPEC } from '../src/shared/spec';
import { SHAPE_IDS } from '../src/collection';
mkdirSync('work',{recursive:true});
writeFileSync('work/workshop-reference.json',JSON.stringify(SHAPE_IDS.map(shape=>{
  const cage=generateCage(DEFAULT_SPEC,5,shape),surface=createSurface(cage);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.rest,3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
  const normals=Array.from(geometry.getAttribute('normal').array);geometry.dispose();
  return {shape,positions:Array.from(surface.rest),indices:Array.from(surface.indices),normals,faceGrids:surface.faceGrids,subdivisions:surface.subdivisions,pockets:CHEESE_POCKETS,radii:cage.radii,cage:Array.from(cage.rest),tets:Array.from(cage.tets)};
})));
