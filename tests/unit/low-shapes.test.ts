import {it,expect} from 'vitest';
import {SoftBody} from '../../src/physics/solver';
import {DEFAULT_SPEC} from '../../src/shared/spec';
import {standardContact} from '../../src/physics/gesture';
import {createSurface,surfacePoint,sampledSurfaceDepth,shapePoint,type Vec3} from '../../src/physics/cage';
// Rendered depth captured on 9d5b402 with identical material and fixed-step input.
for(const [shape,baseline] of [['chocolate',[.11395323248246923,.25469624948819053]],['donut',[.07364779747549834,.18416833885524575]]] as const){
 it(`${shape}: upper surface dents more than the preceding version and recovers without safety backoffs`,()=>{
  const body=new SoftBody(DEFAULT_SPEC,shape),surface=createSurface(body.cage),q:Vec3=shape==='donut'?[-.6,1,.2]:[.2,1,.2],probe=surfacePoint(surface,q);
  const depth=()=>sampledSurfaceDepth(body.cage,body.positions,surface,probe,[0,1,0]);let short=0;
  for(let i=0;i<780;i++){body.setContact(standardContact(body.cage,i/120));body.step();if(i===119)short=depth();if(i%60===0)expect(body.minVolumeRatio()).toBeGreaterThan(.17);}
  expect(short).toBeGreaterThan(baseline[0]*1.4);expect(depth()).toBeGreaterThan(baseline[1]*1.4);expect(depth()).toBeGreaterThan(short*1.6);expect(body.safetyBackoffs).toBe(0);
  body.setContact(null);for(let i=0;i<1440;i++)body.step();expect(body.maxDisplacement()).toBeLessThan(.002);body.reset();expect(body.positions).toEqual(body.cage.rest);expect(body.contact).toBeNull();
 });
 for(const thin of [false,true])it(`${shape}: offset upper presses stay finite and recover${thin?' at extreme thin softness':''}`,()=>{
  const spec=thin?{...DEFAULT_SPEC,softness:1,compressibility:.95,proportions:{width:1.55,height:.65,depth:.9}}:DEFAULT_SPEC;
  const body=new SoftBody(spec,shape);
  for(const q of (shape==='donut'?[[0,1,0],[.5,1,.65]]:[[0,1,0],[.6,1,-.6]]) as Vec3[]){
   for(let i=0;i<780;i++){const c=standardContact(body.cage,i/120)!;body.setContact({...c,point:shapePoint(...q,body.cage.radii,shape)});body.step();}
   expect(body.positions.every(Number.isFinite)).toBe(true);expect(body.minVolumeRatio()).toBeGreaterThan(.17);expect(body.safetyBackoffs).toBe(0);
   const held=body.maxDisplacement();body.setContact(null);for(let i=0;i<1440;i++)body.step();expect(body.maxDisplacement()).toBeLessThan(held*.02);body.reset();
  }
 });
}
it('donut: horizontal side response is numerically unchanged',()=>{
 const b=new SoftBody(DEFAULT_SPEC,'donut'),s=createSurface(b.cage),q:Vec3=[.2,0,1];
 for(let i=0;i<240;i++){const c=standardContact(b.cage,i/120)!;b.setContact({...c,point:shapePoint(...q,b.cage.radii,'donut'),normal:[0,0,1]});b.step();}
 expect(sampledSurfaceDepth(b.cage,b.positions,s,surfacePoint(s,q),[0,0,1])).toBeCloseTo(.03602421261857279,8);expect(b.safetyBackoffs).toBe(0);
});
