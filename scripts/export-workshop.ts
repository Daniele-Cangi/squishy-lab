import { mkdirSync,writeFileSync } from 'node:fs';
import { createSurface,generateCage } from '../src/physics/cage';
import { DEFAULT_SPEC } from '../src/shared/spec';
import type { ShapeId } from '../src/collection';
mkdirSync('work',{recursive:true});
writeFileSync('work/workshop-reference.json',JSON.stringify(['mochi','butter','strawberry','cube'].map(shape=>{
  const cage=generateCage(DEFAULT_SPEC,5,shape as ShapeId),surface=createSurface(cage);
  return {shape,positions:Array.from(surface.rest),indices:Array.from(surface.indices),radii:cage.radii,cage:Array.from(cage.rest),tets:Array.from(cage.tets)};
})));
