import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {strict as assert} from 'node:assert';
import {evidenceContext} from './evidence';
import {SoftBody,FIXED_DT} from '../src/physics/solver';
import {DEFAULT_SPEC} from '../src/shared/spec';
import {shapePoint,createSurface,surfacePoint,sampledSurfaceDepth,type Vec3} from '../src/physics/cage';
import {pressureAt,sustainedPressureAt} from '../src/physics/gesture';
const results=[];
const directory=resolve('evidence/chocolate-pressure');mkdirSync(directory,{recursive:true});
for(const [name,q,normal]of [ ['top-center',[0,1,0],[0,1,0]],['top-tile',[.2,1,.2],[0,1,0]],['top-offset',[.6,1,-.6],[0,1,0]],['side',[.2,0,1],[0,0,1]]]as [string,Vec3,Vec3][]){
 const body=new SoftBody(DEFAULT_SPEC,'chocolate'),surface=createSurface(body.cage),probe=surfacePoint(surface,q),point=shapePoint(...q,body.cage.radii,'chocolate');
 const depth=()=>sampledSurfaceDepth(body.cage,body.positions,surface,probe,normal),trace=[];let minVolume=1,profile:unknown[]=[];
 for(let i=0;i<780;i++){
  body.setContact({point,normal,intensity:pressureAt(i*FIXED_DT),sustain:sustainedPressureAt(i*FIXED_DT)});body.step();minVolume=Math.min(minVolume,body.minVolumeRatio());
  if([29,119,239,779].includes(i))trace.push({seconds:(i+1)*FIXED_DT,depth:depth(),displacement:body.maxDisplacement()});
  if(i===239)profile=Array.from({length:13},(_,j)=>({x:(j-6)*.1,depth:sampledSurfaceDepth(body.cage,body.positions,surface,surfacePoint(surface,[(j-6)*.1,1,q[2]]),[0,1,0])}));
 }
 body.setContact(null);for(let i=0;i<1440;i++)body.step();
 assert(minVolume>.17);assert.equal(body.safetyBackoffs,0);assert(body.maxDisplacement()<.002);
 results.push({name,trace,profile,minVolume,backoffs:body.safetyBackoffs,residual:body.maxDisplacement()});
}
const baseline=JSON.parse(readFileSync(resolve(directory,'baseline.json'),'utf8')) as {results:typeof results};
assert(results[0].trace[2].depth>baseline.results[0].trace[2].depth*10);
assert(Math.abs(results[3].trace[2].depth-baseline.results[3].trace[2].depth)<1e-7);
writeFileSync(resolve(directory,'physics.json'),JSON.stringify({...evidenceContext(),conditions:'Fixed 120 Hz, same default material, shapePoint contacts, 6.5 second hold and 12 second release. Depth is sampled on the rendered Float32 surface along the contact normal; arbitrary scene units. Baseline recorded from clean 80cf2a7 before the solver edit; see baseline.json.',spec:DEFAULT_SPEC,results},null,2));console.log(JSON.stringify(results.map(r=>({name:r.name,trace:r.trace,minVolume:r.minVolume,backoffs:r.backoffs,residual:r.residual}))));
