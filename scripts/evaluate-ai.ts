import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { infer,ApiError } from '../worker/api';
import { CORPUS,assess } from '../tests/semantic-corpus';
import { HOLDOUT,FRESH_HOLDOUT } from '../tests/semantic-holdout';
import { MODEL_3B,MODEL_8B,MODEL_QWEN } from '../src/shared/prompt';
import type { SquishySpec } from '../src/shared/spec';
import { SoftBody,FIXED_DT } from '../src/physics/solver';
import { createSurface,surfacePoint,sampledSurfaceDepth } from '../src/physics/cage';
import { STANDARD_GESTURE,standardContact } from '../src/physics/gesture';
import { liveAi } from './cloudflare-access';
import { evidenceContext } from './evidence';
const live=process.argv.includes('--live'),model=process.argv.includes('--qwen')?MODEL_QWEN:process.argv.includes('--8b')?MODEL_8B:MODEL_3B;
const suite=process.argv.includes('--smoke')?'smoke':process.argv.includes('--fresh')?'holdout-fresh':process.argv.includes('--holdout')?'holdout':'corpus';
const cases=suite==='holdout-fresh'?FRESH_HOLDOUT:suite==='holdout'?HOLDOUT:suite==='smoke'?CORPUS.filter(c=>['it-less-soft','it-protect-color','it-shark'].includes(c.id)):CORPUS;
const session=live?await liveAi(cases.length*2):null;
function engineResult(spec:SquishySpec){
  const body=new SoftBody(spec),surface=createSurface(body.cage),probe=surfacePoint(surface,STANDARD_GESTURE.logicalPoint);
  for(let step=0;step<240;step++){body.setContact(standardContact(body.cage,step*FIXED_DT,2));body.step();}
  return {renderedSurfaceDepthUnits:sampledSurfaceDepth(body.cage,body.positions,surface,probe,STANDARD_GESTURE.normal),minVolumeRatio:body.minVolumeRatio(),safetyBackoffs:body.safetyBackoffs};
}
const rows=[];
for(const case_ of cases){
  const start=Date.now(),callsBefore=session?.calls.length??0;
  const validations:{schemaValid:boolean;protectedFieldsRejected:boolean}[]=[];
  try{
    const response=await infer(case_.request,{PROVIDER:live?'workers-ai':'mock',MODEL:model,AI:session?.ai},undefined,v=>validations.push(v));
    const row={id:case_.id,request:case_.request,expected:case_,schemaValid:true,schemaValidBeforeRepair:validations[0]?.schemaValid??true,validations,...assess(case_,response),repaired:response.repaired,modelCalls:(session?.calls.length??0)-callsBefore,corrections:response.corrections,spec:response.spec,patch:response.patch,engine:engineResult(response.spec),durationMs:Date.now()-start};rows.push(row);
    console.log(`${case_.id}: ${row.semanticPass?'PASS':'FAIL '+row.failures.join(', ')} (${row.durationMs} ms, ${row.modelCalls} calls)`);
  }catch(error){
    rows.push({id:case_.id,request:case_.request,schemaValid:false,schemaValidBeforeRepair:false,semanticPass:false,preserved:false,repaired:(session?.calls.length??0)-callsBefore>1,modelCalls:(session?.calls.length??0)-callsBefore,error:error instanceof Error?error.message:'error',durationMs:Date.now()-start});
    console.log(`${case_.id}: provider/output error`);
    if(live&&error instanceof ApiError&&[429,503,504].includes(error.status))break;
  }
}
const report={...evidenceContext(),provider:live?'LIVE Workers AI':'MOCK fixture interpreter — NOT inference',model:live?model:null,suite,promptSha256:createHash('sha256').update(readFileSync('src/shared/prompt.ts')).digest('hex'),aiAdapterSha256:createHash('sha256').update(readFileSync('worker/api.ts')).digest('hex'),freeCheck:session?.freeCheck??null,calls:session?.calls??[],planned:cases.length,total:rows.length,schemaValid:rows.filter(r=>r.schemaValid).length,schemaValidBeforeRepair:rows.filter(r=>r.schemaValidBeforeRepair).length,semanticPass:rows.filter(r=>r.semanticPass).length,preserved:rows.filter(r=>r.preserved).length,repairNeeded:rows.filter(r=>r.repaired).length,rows};
mkdirSync('evidence/refined',{recursive:true});writeFileSync(`evidence/refined/ai-${live?`live-${process.argv.includes('--qwen')?'qwen':process.argv.includes('--8b')?'8b':'3b'}`:'mock'}-${suite}.json`,JSON.stringify(report,null,2));
console.log({provider:report.provider,model,planned:report.planned,total:report.total,calls:report.calls.length,schemaValid:report.schemaValid,semanticPass:report.semanticPass,preserved:report.preserved,repairs:report.repairNeeded});
if(report.semanticPass!==report.planned)process.exitCode=1;
