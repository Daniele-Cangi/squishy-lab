import { mkdirSync,writeFileSync } from 'node:fs';
import { infer, type AiBinding } from '../worker/api';
import { CORPUS,assess } from '../tests/semantic-corpus';
import { MODEL_3B,MODEL_8B } from '../src/shared/prompt';
const live=process.argv.includes('--live'),model=process.argv.includes('--8b')?MODEL_8B:MODEL_3B;
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(live&&(!account||!token)){console.error('Live evaluation requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. No calls made.');process.exit(2);}
let calls=0;
const ai:AiBinding={async run(model,input){
  calls++;
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(18000)});
  const data=await response.json() as {success?:boolean;result?:unknown;errors?:{message?:string}[]};
  if(!response.ok||data.success===false)throw new Error(`${response.status}: ${data.errors?.[0]?.message??'Provider unavailable'}`);return data.result;
}};
const rows=[];
for(const case_ of CORPUS) {
  const start=Date.now();
  try {
    const response=await infer(case_.request,{PROVIDER:live?'workers-ai':'mock',MODEL:model,AI:live?ai:undefined});
    rows.push({id:case_.id,schemaValid:true,...assess(case_,response),repaired:response.repaired,corrections:response.corrections,spec:response.spec,patch:response.patch,durationMs:Date.now()-start});
  } catch(error) {rows.push({id:case_.id,schemaValid:false,semanticPass:false,preserved:false,repaired:null,error:error instanceof Error?error.message:'error',durationMs:Date.now()-start});}
}
const report={provider:live?'LIVE Workers AI':'MOCK fixture interpreter — NOT inference',model:live?model:null,measuredAt:new Date().toISOString(),calls,total:rows.length,schemaValid:rows.filter(r=>r.schemaValid).length,semanticPass:rows.filter(r=>r.semanticPass).length,preserved:rows.filter(r=>r.preserved).length,repairNeeded:rows.filter(r=>r.repaired).length,rows};
mkdirSync('evidence',{recursive:true});writeFileSync(`evidence/ai-${live?`live-${process.argv.includes('--8b')?'8b':'3b'}`:'mock'}.json`,JSON.stringify(report,null,2));
console.log({provider:report.provider,model:report.model,calls,total:report.total,schemaValid:report.schemaValid,semanticPass:report.semanticPass,preserved:report.preserved,repairNeeded:report.repairNeeded});
if(report.semanticPass!==report.total){console.log(rows.filter(r=>!r.semanticPass));process.exitCode=1;}
