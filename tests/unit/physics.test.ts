import { describe,it,expect } from 'vitest';
import { DEFAULT_SPEC, type SquishySpec } from '../../src/shared/spec';
import { createSurface, embedSurface, generateCage, roundedPoint, signedVolume, type Vec3 } from '../../src/physics/cage';
import { FIXED_DT, FixedClock, SoftBody } from '../../src/physics/solver';
function press(body:SoftBody,steps=240) {
  const point=roundedPoint(0,.55,1,body.cage.radii),normal:Vec3=[0,.48,.88];
  for(let i=0;i<steps;i++){body.setContact({point,normal,intensity:Math.min(1,i/102)*.88});body.step();}
  return body.maxDisplacement();
}
describe('Volumetric mochi',()=>{
  it('builds positive tetrahedra, connected edges and a watertight surface',()=>{
    const cage=generateCage(DEFAULT_SPEC),surface=createSurface(cage),edgeUse=new Map<string,number>();
    expect(cage.volumes.length).toBe(750);expect(Math.min(...cage.volumes)).toBeGreaterThan(1e-7);expect(cage.inverseMass.some(m=>m===0)).toBe(true);
    for(let i=0;i<surface.indices.length;i+=3)for(let a=0;a<3;a++){const edge=[surface.indices[i+a],surface.indices[i+(a+1)%3]].sort((a,b)=>a-b).join(',');edgeUse.set(edge,(edgeUse.get(edge)??0)+1);}
    expect([...edgeUse.values()].every(n=>n===2)).toBe(true);
    for(let v=0;v<surface.weights.length;v+=4)expect(surface.weights.slice(v,v+4).reduce((a,b)=>a+b)).toBeCloseTo(1,10);
    const seen=new Set([0]);for(let pass=0;pass<cage.inverseMass.length;pass++)for(let e=0;e<cage.edges.length;e+=2){const a=cage.edges[e],b=cage.edges[e+1];if(seen.has(a))seen.add(b);if(seen.has(b))seen.add(a);}
    expect(seen.size).toBe(cage.inverseMass.length);
    for(let t=0;t<cage.volumes.length;t++){const j=t*4;expect(signedVolume(cage.rest,cage.tets[j],cage.tets[j+1],cage.tets[j+2],cage.tets[j+3])).toBeCloseTo(cage.volumes[t],12);}
  });
  it('embeds the surface coherently with exact rest geometry and a rigid displacement',()=>{
    const cage=generateCage(DEFAULT_SPEC),surface=createSurface(cage),out=surface.rest.slice();embedSurface(cage,cage.rest,surface,out);expect(out).toEqual(surface.rest);
    const moved=cage.rest.map((v,i)=>v+[.1,.2,-.1][i%3]);embedSurface(cage,moved,surface,out);
    for(let i=0;i<out.length;i++)expect(out[i]-surface.rest[i]).toBeCloseTo([.1,.2,-.1][i%3],5);
  });
  it('softer material deforms further under identical input',()=>{
    const soft=new SoftBody(DEFAULT_SPEC),firm=new SoftBody({...DEFAULT_SPEC,softness:.22});
    const softDepth=press(soft),firmDepth=press(firm);expect(softDepth).toBeGreaterThan(firmDepth*1.6);expect(softDepth).toBeGreaterThan(.25);expect(soft.minVolumeRatio()).toBeGreaterThan(.17);
  });
  it('slow recovery retains a local dent while fast recovery has nearly finished',()=>{
    const slow=new SoftBody(DEFAULT_SPEC),fast=new SoftBody({...DEFAULT_SPEC,recoverySeconds:.45});press(slow);press(fast);slow.setContact(null);fast.setContact(null);
    for(let i=0;i<120;i++){slow.step();fast.step();}
    expect(slow.maxDisplacement()).toBeGreaterThan(.12);expect(fast.maxDisplacement()).toBeLessThan(.02);
    // Deformation is local: the far back remains much nearer to rest than the contact.
    const rest=slow.cage.rest;let back=0;for(let i=0;i<rest.length;i+=3)if(rest[i+2]<-.8)back=Math.max(back,Math.hypot(...[0,1,2].map(a=>slow.positions[i+a]-rest[i+a])));
    expect(back).toBeLessThan(slow.maxDisplacement()*.3);
  });
  it('compressibility affects volume loss under the same load',()=>{
    function volume(spec:SquishySpec){const body=new SoftBody(spec);press(body);const {tets}=body.cage;let total=0;for(let t=0;t<tets.length;t+=4)total+=signedVolume(body.positions,tets[t],tets[t+1],tets[t+2],tets[t+3]);return total/body.cage.volumes.reduce((a,b)=>a+b);}
    expect(volume({...DEFAULT_SPEC,compressibility:.95})).toBeLessThan(volume({...DEFAULT_SPEC,compressibility:.05})-.005);
  });
  it('returns to immutable reference through repeated press/release cycles',()=>{
    const body=new SoftBody(DEFAULT_SPEC),reference=body.cage.rest.slice();
    for(let cycle=0;cycle<4;cycle++){press(body);body.setContact(null);for(let i=0;i<1440;i++)body.step();expect(body.maxDisplacement()).toBeLessThan(.004);}
    expect(body.cage.rest).toEqual(reference);expect(body.safetyBackoffs).toBe(0);
  });
  it.each([.1,1])('is finite and orientation-safe at extreme softness %s',softness=>{
    for(const [compressibility,recoverySeconds,damping,proportions]of [[.05,.3,.2,{width:1.6,height:.7,depth:1}],[.95,12,1,{width:.7,height:1.6,depth:1}]] as const){
      const body=new SoftBody({...DEFAULT_SPEC,softness,compressibility,recoverySeconds,damping,proportions});press(body,180);body.setContact(null);for(let i=0;i<120;i++)body.step();expect(body.positions.every(Number.isFinite)).toBe(true);expect(body.minVolumeRatio()).toBeGreaterThan(.17);expect(body.maxDisplacement()).toBeLessThan(1.5);
    }
  });
  it('handles invalid contact, fixed time, long pauses and render rates',()=>{
    const body=new SoftBody(DEFAULT_SPEC);body.setContact({point:[NaN,0,0],normal:[0,1,0],intensity:1});expect(body.contact).toBeNull();expect(()=>body.step(.016)).toThrow();
    const clock=new FixedClock();let count=0;expect(clock.advance(10,()=>count++)).toBe(0);expect(count).toBe(0);expect(clock.advance(FIXED_DT,()=>count++)).toBe(1);
    const steps=[30,60,144].map(hz=>{let n=0;const c=new FixedClock();for(let f=0;f<hz*3;f++)c.advance(1/hz,()=>n++);return n;});expect(steps).toEqual([360,360,360]);
  });
});
