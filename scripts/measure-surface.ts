import { mkdirSync,writeFileSync,existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DEFAULT_SPEC } from '../src/shared/spec';
import { SoftBody,FIXED_DT } from '../src/physics/solver';
import { createSurface,embedSurface,roundedPoint,cagePoint,surfacePoint,pointDepth,type Vec3 } from '../src/physics/cage';
import { STANDARD_GESTURE,standardContact } from '../src/physics/gesture';
import { evidenceContext } from './evidence';
const baseline=process.argv.includes('--baseline'),directory=resolve('evidence',baseline?'baseline-b169dc8':'refined');
mkdirSync(directory,{recursive:true});
if(baseline&&existsSync(resolve(directory,'surface.json')))throw new Error('Recorded baseline is immutable. Run without --baseline for the current source.');
const results=[];
for(const [name,spec] of Object.entries({soft:DEFAULT_SPEC,firm:{...DEFAULT_SPEC,softness:.22}})){
  const body=new SoftBody(spec),surface=createSurface(body.cage),rendered=surface.rest.slice(),q:Vec3=baseline?[0,.55,1]:STANDARD_GESTURE.logicalPoint,normal:Vec3=baseline?[0,.48,.88]:STANDARD_GESTURE.normal;
  const internal=cagePoint(body.cage,q),visible=surfacePoint(surface,q),point=roundedPoint(...q,body.cage.radii);
  const profilePoints=Array.from({length:17},(_,i)=>({logicalX:(i-8)*.075,probe:surfacePoint(surface,[(i-8)*.075,q[1],q[2]])}));
  const trace:unknown[]=[],profiles:unknown[]=[];
  for(let step=0;step<1680;step++){
    const time=step*FIXED_DT;
    body.setContact(baseline?(time<2?{point,normal,intensity:Math.min(1,time/.85)*.88}:null):standardContact(body.cage,time,STANDARD_GESTURE.holdSeconds));body.step();
    if(step%12===11){embedSurface(body.cage,body.positions,surface,rendered);trace.push({timeSeconds:(step+1)*FIXED_DT,internalCageDepthUnits:pointDepth(body.cage.rest,body.positions,internal,normal),renderedSurfaceDepthUnits:pointDepth(surface.rest,rendered,visible,normal),minVolumeRatio:body.minVolumeRatio()});}
    if([239,299,359].includes(step)){embedSurface(body.cage,body.positions,surface,rendered);profiles.push({timeSeconds:(step+1)*FIXED_DT,points:profilePoints.map(({logicalX,probe})=>({logicalX,renderedSurfaceDepthUnits:pointDepth(surface.rest,rendered,probe,normal)}))});}
  }
  results.push({name,spec,trace,profiles,residual:body.maxDisplacement(),backoffs:body.safetyBackoffs});
}
writeFileSync(resolve(directory,'surface.json'),JSON.stringify({...evidenceContext(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),units:'scene units along fixed normalized contact axis; logical profile coordinates are dimensionless',gesture:baseline?'Baseline linear script ramp; recorded runtime used a different ramp.':STANDARD_GESTURE,results},null,2));
console.log(results.map(r=>({name:r.name,peakSample:r.trace[19],residual:r.residual,backoffs:r.backoffs})));
