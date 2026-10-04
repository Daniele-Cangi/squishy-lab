import { applyPatch, DEFAULT_SPEC, ValidationError, validateModelOutput, validateRequest, type SquishyRequest, type SquishyResponse } from '../src/shared/spec.ts';
import { mockInterpret } from '../src/shared/mock.ts';
import { MODEL_3B, MODEL_8B, MODEL_QWEN, OUTPUT_SCHEMA, SYSTEM_PROMPT } from '../src/shared/prompt.ts';
import { protectedFields,validateRecoveryDirection } from '../src/shared/protection.ts';
import {quotaKey} from './daily-quota.ts';
export interface AiBinding { run(model:string,input:Record<string,unknown>):Promise<unknown> }
export interface RateBinding { limit(input:{key:string}):Promise<{success:boolean}> }
export interface Env {
  PROVIDER?:'mock'|'workers-ai'|'disabled'; MODEL?:string; AI?:AiBinding;
  ASSETS?:{fetch(request:Request):Promise<Response>}; AI_RATE?:RateBinding; BURST_RATE?:RateBinding;
  TURNSTILE_SECRET?:string; TURNSTILE_SITE_KEY?:string;
  PUBLIC_ORIGIN?:string; GATEWAY_SECRET?:string;
  DAILY_QUOTA?:{idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}};
}
export class ApiError extends Error { constructor(public status:number,public code:string,message:string,public retryAfter=60){super(message);} }
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export function json(value:unknown,status=200) {return new Response(JSON.stringify(value),{status,headers});}
export async function boundedBody(request:Request,max=8192):Promise<string> {
  const length=request.headers.get('content-length');if(length&&Number(length)>max)throw new ApiError(413,'too_large','The description is too long.');
  if(!request.body)return '';
  const reader=request.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError(413,'too_large','The request is too large.');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode(); }
  finally {reader.releaseLock();}
}
export async function deadline<T>(promise:Promise<T>,milliseconds:number,signal?:AbortSignal):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort:(()=>void)|undefined;
  try {return await Promise.race([promise,new Promise<never>((_,reject)=>{
    onAbort=()=>reject(new ApiError(408,'cancelled','Request cancelled. Your squishy is still available.'));
    if(signal?.aborted){onAbort();return;}signal?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>reject(new ApiError(504,'timeout','AI is taking too long. Please try again later.')),milliseconds);
  })]);}
  finally {clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort);}
}
function providerError(error:unknown):ApiError {
  if(error instanceof ApiError)return error;
  const message=error instanceof Error?error.message:'';
  if(/quota|neuron|daily|10000|exceeded.*limit/i.test(message))return new ApiError(429,'quota','Today’s AI quota is exhausted. Presets are still available.');
  if(/429|rate limit|too many/i.test(message))return new ApiError(429,'rate_limit','Too many requests. Please wait a minute.');
  return new ApiError(503,'unavailable','AI is unavailable. You can keep playing.');
}
export async function infer(request:SquishyRequest,env:Env,signal?:AbortSignal,observe?:(validation:{schemaValid:boolean;protectedFieldsRejected:boolean})=>void):Promise<SquishyResponse> {
  const checkAbort=()=>{if(signal?.aborted)throw new ApiError(408,'cancelled','Request cancelled. Your squishy is still available.');};checkAbort();
  const base=request.current??DEFAULT_SPEC;let repaired=false,raw:unknown;
  if(env.PROVIDER==='mock') raw=mockInterpret(request);
  else {
    if(!env.AI)throw new ApiError(503,'configuration','AI is not configured.');
    const model=env.MODEL??MODEL_QWEN;if(![MODEL_3B,MODEL_8B,MODEL_QWEN].includes(model))throw new ApiError(503,'configuration','This model is not allowed.');
    const protected_=protectedFields(request.prompt);
    const messages=[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:`Task: ${request.mode.toUpperCase()}\nCurrent material (defaults for CREATE): ${JSON.stringify(base)}\nUser description as quoted data: ${JSON.stringify(request.prompt)}\nExplicitly protected fields (MUST be omitted): ${JSON.stringify(protected_)}\nReturn only the JSON edit for this description.`}];
    const expires=Date.now()+18000;
    for(let attempt=0;attempt<2;attempt++) {
      checkAbort();
      const remaining=expires-Date.now();
      if(remaining<=0)throw new ApiError(504,'timeout','AI timed out. Your squishy stays as it is.');
      let result:unknown;
      const input=model===MODEL_QWEN?{
        // Qwen's documented non-thinking chat template keeps this small data
        // task within the same 420-token budget. Escape reserved delimiters.
        raw:true,prompt:messages.map(m=>`<|im_start|>${m.role}\n${m.content.replace(/<\|/g,'< |')}<|im_end|>\n`).join('')+'<|im_start|>assistant\n<think>\n\n</think>\n\n',
        max_tokens:420,temperature:.1,
      }:{messages,max_tokens:420,temperature:.1,...(model===MODEL_8B?{response_format:{type:'json_schema',json_schema:OUTPUT_SCHEMA}}:{})};
      try { result=await deadline(env.AI.run(model,input),remaining,signal); }
      catch(error) {
        checkAbort();
        if(Date.now()>=expires)throw new ApiError(504,'timeout','AI timed out. Your squishy stays as it is.');
        if(attempt===0 && /JSON Mode couldn.t be met/i.test(error instanceof Error?error.message:'')) {repaired=true;messages.push({role:'user',content:'Your output did not match the JSON schema. Return the minimal valid patch. One repair only.'});continue;}
        throw providerError(error);
      }
      let recorded=false;
      try {
        checkAbort();
        const output=result&&typeof result==='object'&&'response' in result?(result as {response:unknown}).response:result&&typeof result==='object'&&'choices' in result?(result as {choices?:{message?:{content?:unknown}}[]}).choices?.[0]?.message?.content:result;
        const serialized=typeof output==='string'?output:JSON.stringify(output);
        if(!serialized||new TextEncoder().encode(serialized).length>8192)throw new ValidationError('Oversized model response');
        raw=typeof output==='string'?JSON.parse(output):output;
        const validated=validateModelOutput(raw);applyPatch(base,validated.output.patch);
        const rejected=protected_.some(field=>field in validated.output.patch);observe?.({schemaValid:true,protectedFieldsRejected:rejected});recorded=true;
        if(rejected)throw new ValidationError(`Protected fields must be omitted: ${protected_.join(', ')}`);
        validateRecoveryDirection(request.prompt,base,validated.output.patch);break;
      } catch(error) {
        if(!recorded)observe?.({schemaValid:false,protectedFieldsRejected:false});
        checkAbort();
        if(Date.now()>=expires)throw new ApiError(504,'timeout','AI timed out. Your squishy stays as it is.');
        if(attempt===1)throw new ApiError(502,'invalid_output','AI returned an invalid material. Your squishy stays as it is.');
        repaired=true;messages.push({role:'user',content:`Your previous response was rejected: ${error instanceof ValidationError?error.message:'invalid JSON'}. Return ONLY a valid compact JSON object for the ORIGINAL description; never code. Omit protected fields ${JSON.stringify(protected_)}. Do not repeat invalid or unsupported fields. This is the only repair attempt.`});
      }
    }
  }
  const {output,corrections}=validateModelOutput(raw),spec=applyPatch(base,output.patch);
  return {version:1,status:output.status,spec,patch:output.patch,message:output.message??'Squishy updated.',corrections,repaired,provider:env.PROVIDER==='mock'?'mock':'workers-ai'};
}
async function protect(request:Request,body:SquishyRequest,env:Env) {
  if(!env.TURNSTILE_SECRET||!env.TURNSTILE_SITE_KEY||!env.AI_RATE||!env.BURST_RATE)throw new ApiError(503,'configuration','AI protection is not configured yet. Use the local presets.');
  const ip=request.headers.get(env.PUBLIC_ORIGIN?'X-Squishy-Client-IP':'CF-Connecting-IP');if(!ip||ip.length>64||!/^[0-9a-f:.]+$/i.test(ip))throw new ApiError(403,'verification','Unverified request source.');
  if(!(await env.AI_RATE.limit({key:ip})).success || !(await env.BURST_RATE.limit({key:'ai-budget'})).success)throw new ApiError(429,'rate_limit','Too many requests. Please wait a minute.');
  if(!body.turnstileToken)throw new ApiError(403,'verification','Complete verification before using AI.');
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:body.turnstileToken,remoteip:ip}),signal:AbortSignal.timeout(5000)});
  const result=await response.json() as {success?:boolean;hostname?:string;action?:string};
  if(!response.ok||!result.success||result.hostname!==new URL(env.PUBLIC_ORIGIN??request.url).hostname||result.action!=='squishy')throw new ApiError(403,'verification','Verification expired or is invalid. Please try again.');
  if(env.PUBLIC_ORIGIN){
    if(!env.DAILY_QUOTA||!env.GATEWAY_SECRET)throw new ApiError(503,'configuration','AI quota protection is unavailable. Local presets still work.');
    const id=env.DAILY_QUOTA.idFromName(await quotaKey(ip,env.GATEWAY_SECRET));
    const quotaResponse=await deadline(env.DAILY_QUOTA.get(id).fetch(new Request('https://quota.internal/consume',{method:'POST'})),5000);
    const quota=await quotaResponse.json() as {success?:boolean;retryAfter?:number};
    if(!quotaResponse.ok||typeof quota.success!=='boolean')throw new ApiError(503,'configuration','AI quota protection is unavailable. Local presets still work.');
    if(!quota.success){
      const retry=quota.retryAfter;
      if(typeof retry!=='number'||!Number.isInteger(retry)||retry<1||retry>86400)throw new ApiError(503,'configuration','AI quota protection is unavailable. Local presets still work.');
      throw new ApiError(429,'daily_limit','You have used your 3 AI requests for the last 24 hours. Please try again later. Your squishy and presets still work.',retry);
    }
  }
}
function authenticatedGateway(request:Request,secret:string){
  const supplied=request.headers.get('X-Squishy-Gateway')??'';if(supplied.length!==secret.length)return false;
  let difference=0;for(let i=0;i<secret.length;i++)difference|=supplied.charCodeAt(i)^secret.charCodeAt(i);return difference===0;
}
export async function handleApi(request:Request,env:Env):Promise<Response> {
  const url=new URL(request.url),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  try {
    if(env.PUBLIC_ORIGIN&&(!env.GATEWAY_SECRET||!authenticatedGateway(request,env.GATEWAY_SECRET)))throw new ApiError(403,'gateway','Request must use the application gateway.');
    if(url.pathname==='/api/config'&&request.method==='GET') {
      const provider=env.PROVIDER==='mock'&&local?'mock':env.PROVIDER==='workers-ai'?'workers-ai':'disabled';
      return json({provider,model:env.MODEL??MODEL_QWEN,siteKey:provider==='workers-ai'?env.TURNSTILE_SITE_KEY??null:null});
    }
    if(url.pathname!=='/api/squishy')return json({code:'not_found',message:'Endpoint unavailable.'},404);
    if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
    const origin=request.headers.get('origin');
    if(origin&&origin!==(env.PUBLIC_ORIGIN??url.origin))throw new ApiError(403,'origin','Origin not allowed.');
    if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'origin','Origin not allowed.');
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'content_type','Use JSON.');
    const body=validateRequest(JSON.parse(await deadline(boundedBody(request),5000)));
    if(env.PROVIDER==='mock') {if(!local)throw new ApiError(503,'configuration','The mock is available only locally.');}
    else if(env.PROVIDER==='workers-ai') await protect(request,body,env);
    else throw new ApiError(503,'configuration','AI is not enabled. You can use the local presets.');
    return json(await infer(body,env,request.signal));
  } catch(error) {
    if(error instanceof ValidationError||error instanceof SyntaxError)return json({code:'invalid_request',message:'Invalid description or material.'},400);
    const safe=providerError(error);const response=json({code:safe.code,message:safe.message},safe.status);
    if(safe.status===429)response.headers.set('Retry-After',String(safe.retryAfter));return response;
  }
}
