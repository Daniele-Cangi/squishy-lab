import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { DEFAULT_SPEC, type SquishySpec } from '../src/shared/spec';
import { roundedPoint, type Vec3 } from '../src/physics/cage';
import { FIXED_DT, SoftBody, FixedClock } from '../src/physics/solver';
export function standardTrace(spec:SquishySpec,renderHz=60,cycles=1) {
  const body=new SoftBody(spec),clock=new FixedClock();
  const point=roundedPoint(0,.55,1,body.cage.radii),normal:Vec3=[0,.48,.88];
  const trace:{time:number;depth:number;maxDisplacement:number;minVolumeRatio:number}[]=[];
  let peak=0,releaseDepth=0,t90:number|null=null;const timings:number[]=[];
  for(let frame=0;frame<renderHz*(cycles*14);frame++) {
    clock.advance(1/renderHz,()=>{
      const time=body.time,phase=time%14;
      body.setContact(phase<2?{point,normal,intensity:Math.min(1,phase/.85)*.88}:null);
      const start=performance.now();body.step();timings.push(performance.now()-start);
      const depth=body.maxDisplacement();
      if(time<2)peak=Math.max(peak,depth);
      if(time>=2&&releaseDepth===0)releaseDepth=depth;
      if(time>=2&&t90===null&&depth<=releaseDepth*.1)t90=time-2;
      if(Math.round(body.time/FIXED_DT)%12===0)trace.push({time:body.time,depth,maxDisplacement:depth,minVolumeRatio:body.minVolumeRatio()});
    });
  }
  timings.sort((a,b)=>a-b);
  return {spec,renderHz,cycles,peak,releaseDepth,t90,residual:body.maxDisplacement(),minVolumeRatio:Math.min(...trace.map(v=>v.minVolumeRatio)),safetyBackoffs:body.safetyBackoffs,solverStepMedianMs:timings[Math.floor(timings.length*.5)],solverStepP95Ms:timings[Math.floor(timings.length*.95)],finalPositions:Array.from(body.positions),trace};
}
if(process.argv[1]?.endsWith('measure-physics.ts')) {
  const cases={foam:DEFAULT_SPEC,firm:{...DEFAULT_SPEC,softness:.22},fast:{...DEFAULT_SPEC,recoverySeconds:.45},elastic:{...DEFAULT_SPEC,recoverySeconds:.45,compressibility:.2,damping:.38}};
  const results=Object.fromEntries(Object.entries(cases).map(([name,spec])=>[name,standardTrace(spec)]));
  const repeated=standardTrace(DEFAULT_SPEC,60,12),rates=[30,60,144].map(hz=>standardTrace(DEFAULT_SPEC,hz));
  const reference=rates[1].finalPositions,rateError=Math.max(...rates.flatMap(r=>r.finalPositions.map((v,i)=>Math.abs(v-reference[i]))));
  mkdirSync('evidence',{recursive:true});
  writeFileSync('evidence/physics.json',JSON.stringify({measuredAt:new Date().toISOString(),node:process.version,platform:process.platform,results,repeated,rateError},null,2));
  const header='material,time_s,displacement,minimum_tet_volume_ratio\n';
  writeFileSync('evidence/physics.csv',header+Object.entries(results).flatMap(([name,r])=>r.trace.map(v=>`${name},${v.time.toFixed(3)},${v.depth.toFixed(6)},${v.minVolumeRatio.toFixed(6)}`)).join('\n'));
  for(const [name,r]of Object.entries(results)) console.log(name,{peak:r.peak,t90:r.t90,residual:r.residual,minVolumeRatio:r.minVolumeRatio,safetyBackoffs:r.safetyBackoffs,solverStepMedianMs:r.solverStepMedianMs,solverStepP95Ms:r.solverStepP95Ms});
  console.log('Repeated cycles', {cycles:repeated.cycles,residual:repeated.residual,backoffs:repeated.safetyBackoffs});console.log('Render rate maximum coordinate difference',rateError);
}
