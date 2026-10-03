import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { AiBinding } from '../worker/api.ts';

function wranglerJson(args:string[]):unknown {
  try{return JSON.parse(execFileSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args,'--json'],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}}));}
  catch{throw new Error('Wrangler authentication unavailable. Run npx wrangler login; never paste secrets into source or chat.');}
}
export async function cloudflareAccess(){
  let account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  if(!account||!token){
    if(!account){
      const identity=wranglerJson(['whoami']) as {loggedIn?:boolean;accounts?:{id:string}[]};
      if(!identity.loggedIn)throw new Error('Cloudflare is not authenticated. Run npx wrangler login.');
      if(identity.accounts?.length!==1)throw new Error('Select an authorized account with CLOUDFLARE_ACCOUNT_ID.');account=identity.accounts[0].id;
    }
    const auth=wranglerJson(['auth','token']) as {type?:string;token?:string};token=auth.token;
  }
  if(!token||!account)throw new Error('Usable Workers AI authentication missing.');
  // Read-only account check; no subscription, billing or resource is created.
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  const data=await response.json() as {success?:boolean;result?:{rate_plan?:{id?:string;public_name?:string;scope?:string}}[]};
  if(response.status===403&&(process.argv.includes('--free-confirmed')||process.env.SQUISHY_WORKERS_FREE_CONFIRMED==='1'))return {account,token,freeCheck:'Workers Free confirmed by the user; subscription API returned HTTP 403'};
  if(!response.ok||!data.success||!Array.isArray(data.result))throw new Error(`Could not verify Workers Free (subscription read HTTP ${response.status}). No inference calls made.`);
  const plans=data.result.map(s=>s.rate_plan??{});
  if(plans.some(p=>/workers|ai/i.test(`${p.id} ${p.public_name} ${p.scope}`)&&!/free/i.test(`${p.id} ${p.public_name}`)))throw new Error('A non-Free Workers/AI subscription is present. This harness only runs on verified Workers Free.');
  return {account,token,freeCheck:'Account subscriptions read successfully; no paid Workers/AI subscription found'};
}
export async function liveAi(maxCalls:number){
  const access=await cloudflareAccess();
  const calls:{model:string;durationMs:number;usage:unknown;status:number}[]=[];
  const binding=(signal?:AbortSignal):AiBinding=>({async run(model,input){
    if(calls.length>=maxCalls)throw new Error('Controlled evaluation call limit reached');
    const record={model,durationMs:0,usage:null as unknown,status:0};calls.push(record);const start=Date.now();
    const timeout=AbortSignal.timeout(18000);
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${access.account}/ai/run/${model}`,{method:'POST',headers:{Authorization:`Bearer ${access.token}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:signal?AbortSignal.any([signal,timeout]):timeout});
    record.durationMs=Date.now()-start;record.status=response.status;
    const data=await response.json() as {success?:boolean;result?:{usage?:unknown};errors?:{message?:string}[]};record.usage=data.result?.usage??null;
    if(!response.ok||data.success===false)throw new Error(`${response.status}: ${data.errors?.[0]?.message??'Provider unavailable'}`);
    return data.result;
  }});
  return {ai:binding(),binding,calls,freeCheck:access.freeCheck};
}
if(process.argv.includes('--check')){
  try{const access=await cloudflareAccess();console.log({authenticated:true,freeCheck:access.freeCheck});}
  catch(error){console.error(error instanceof Error?error.message:'Cloudflare access check failed');process.exitCode=2;}
}
