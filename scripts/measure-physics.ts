import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { DEFAULT_SPEC, type SquishySpec } from '../src/shared/spec';
import { cagePoint,createSurface,surfacePoint,pointDepth,sampledSurfaceDepth } from '../src/physics/cage';
import { FIXED_DT, SoftBody, FixedClock } from '../src/physics/solver';
import { STANDARD_GESTURE,standardContact } from '../src/physics/gesture';
import { evidenceContext } from './evidence';
export function standardTrace(spec:SquishySpec,renderHz=60,cycles=1) {
  const body=new SoftBody(spec),clock=new FixedClock();
  const surface=createSurface(body.cage),internal=cagePoint(body.cage,STANDARD_GESTURE.logicalPoint),visible=surfacePoint(surface,STANDARD_GESTURE.logicalPoint);
  const trace:{time:number;internalCageDepthUnits:number;renderedSurfaceDepthUnits:number;maxDisplacement:number;minVolumeRatio:number}[]=[];
  let peak=0,renderedPeak=0,releaseDepth=0,renderedReleaseDepth=0,t90:number|null=null,renderedT90:number|null=null,stepIndex=0;const timings:number[]=[];
  for(let frame=0;frame<renderHz*(cycles*14);frame++) {
    clock.advance(1/renderHz,()=>{
      const time=stepIndex*FIXED_DT,phase=(stepIndex%1680)*FIXED_DT;
      body.setContact(standardContact(body.cage,phase,STANDARD_GESTURE.holdSeconds));
      const start=performance.now();body.step();timings.push(performance.now()-start);
      const depth=pointDepth(body.cage.rest,body.positions,internal,STANDARD_GESTURE.normal),renderedDepth=sampledSurfaceDepth(body.cage,body.positions,surface,visible,STANDARD_GESTURE.normal);
      if(time<2){peak=Math.max(peak,depth);renderedPeak=Math.max(renderedPeak,renderedDepth);}
      if(time>=2&&releaseDepth===0){releaseDepth=depth;renderedReleaseDepth=renderedDepth;}
      if(time>=2&&t90===null&&depth<=releaseDepth*.1)t90=time-2;
      if(time>=2&&renderedT90===null&&renderedDepth<=renderedReleaseDepth*.1)renderedT90=time-2;
      stepIndex++;if(stepIndex%12===0)trace.push({time:body.time,internalCageDepthUnits:depth,renderedSurfaceDepthUnits:renderedDepth,maxDisplacement:body.maxDisplacement(),minVolumeRatio:body.minVolumeRatio()});
    });
  }
  timings.sort((a,b)=>a-b);
  return {spec,renderHz,cycles,internalCagePeakUnits:peak,renderedSurfacePeakUnits:renderedPeak,internalCageReleaseDepthUnits:releaseDepth,renderedSurfaceReleaseDepthUnits:renderedReleaseDepth,internalCageT90Seconds:t90,renderedSurfaceT90Seconds:renderedT90,residual:body.maxDisplacement(),minVolumeRatio:Math.min(...trace.map(v=>v.minVolumeRatio)),safetyBackoffs:body.safetyBackoffs,solverStepMedianMs:timings[Math.floor(timings.length*.5)],solverStepP95Ms:timings[Math.floor(timings.length*.95)],finalPositions:Array.from(body.positions),trace};
}
if(process.argv[1]?.endsWith('measure-physics.ts')) {
  const cases={foam:DEFAULT_SPEC,firm:{...DEFAULT_SPEC,softness:.22},fast:{...DEFAULT_SPEC,recoverySeconds:.45},elastic:{...DEFAULT_SPEC,recoverySeconds:.45,compressibility:.2,damping:.38}};
  const results=Object.fromEntries(Object.entries(cases).map(([name,spec])=>[name,standardTrace(spec)]));
  const repeated=standardTrace(DEFAULT_SPEC,60,12),rates=[30,60,144].map(hz=>standardTrace(DEFAULT_SPEC,hz));
  const reference=rates[1].finalPositions,rateError=Math.max(...rates.flatMap(r=>r.finalPositions.map((v,i)=>Math.abs(v-reference[i]))));
  mkdirSync('evidence/refined',{recursive:true});
  writeFileSync('evidence/refined/physics.json',JSON.stringify({...evidenceContext(),gesture:STANDARD_GESTURE,units:'Scene units; times in seconds; volume ratios dimensionless',results,repeated,rateError},null,2));
  const header='material,time_s,internal_cage_depth_units,rendered_surface_depth_units,minimum_tet_volume_ratio\n';
  writeFileSync('evidence/refined/physics.csv',header+Object.entries(results).flatMap(([name,r])=>r.trace.map(v=>`${name},${v.time.toFixed(3)},${v.internalCageDepthUnits.toFixed(6)},${v.renderedSurfaceDepthUnits.toFixed(6)},${v.minVolumeRatio.toFixed(6)}`)).join('\n'));
  for(const [name,r]of Object.entries(results)) console.log(name,{internalDepth:r.internalCagePeakUnits,renderedDepth:r.renderedSurfacePeakUnits,t90:r.renderedSurfaceT90Seconds,residual:r.residual,minVolumeRatio:r.minVolumeRatio,safetyBackoffs:r.safetyBackoffs});
  console.log('Repeated cycles', {cycles:repeated.cycles,residual:repeated.residual,backoffs:repeated.safetyBackoffs});console.log('Render rate maximum coordinate difference',rateError);
}
