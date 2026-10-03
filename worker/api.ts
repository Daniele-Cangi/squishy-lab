import { applyPatch, DEFAULT_SPEC, ValidationError, validateModelOutput, validateRequest, type SquishyRequest, type SquishyResponse } from '../src/shared/spec.ts';
import { mockInterpret } from '../src/shared/mock.ts';
import { MODEL_3B, MODEL_8B, MODEL_QWEN, OUTPUT_SCHEMA, SYSTEM_PROMPT } from '../src/shared/prompt.ts';
import { protectedFields,validateRecoveryDirection } from '../src/shared/protection.ts';
export interface AiBinding { run(model:string,input:Record<string,unknown>):Promise<unknown> }
export interface RateBinding { limit(input:{key:string}):Promise<{success:boolean}> }
export interface Env {
  PROVIDER?:'mock'|'workers-ai'|'disabled'; MODEL?:string; AI?:AiBinding;
  ASSETS?:{fetch(request:Request):Promise<Response>}; AI_RATE?:RateBinding; BURST_RATE?:RateBinding;
  TURNSTILE_SECRET?:string; TURNSTILE_SITE_KEY?:string;
}
export class ApiError extends Error { constructor(public status:number,public code:string,message:string){super(message);} }
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export function json(value:unknown,status=200) {return new Response(JSON.stringify(value),{status,headers});}
export async function boundedBody(request:Request,max=8192):Promise<string> {
  const length=request.headers.get('content-length');if(length&&Number(length)>max)throw new ApiError(413,'too_large','Descrizione troppo lunga.');
  if(!request.body)return '';
  const reader=request.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError(413,'too_large','Richiesta troppo grande.');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode(); }
  finally {reader.releaseLock();}
}
export async function deadline<T>(promise:Promise<T>,milliseconds:number,signal?:AbortSignal):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort:(()=>void)|undefined;
  try {return await Promise.race([promise,new Promise<never>((_,reject)=>{
    onAbort=()=>reject(new ApiError(408,'cancelled','Richiesta annullata. Lo squishy resta disponibile.'));
    if(signal?.aborted){onAbort();return;}signal?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>reject(new ApiError(504,'timeout','L’AI sta impiegando troppo tempo. Riprova più tardi.')),milliseconds);
  })]);}
  finally {clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort);}
}
function providerError(error:unknown):ApiError {
  if(error instanceof ApiError)return error;
  const message=error instanceof Error?error.message:'';
  if(/quota|neuron|daily|10000|exceeded.*limit/i.test(message))return new ApiError(429,'quota','La quota AI di oggi è esaurita. I preset restano disponibili.');
  if(/429|rate limit|too many/i.test(message))return new ApiError(429,'rate_limit','Troppe richieste. Aspetta un minuto.');
  return new ApiError(503,'unavailable','L’AI non è disponibile. Puoi continuare a giocare.');
}
export async function infer(request:SquishyRequest,env:Env,signal?:AbortSignal,observe?:(validation:{schemaValid:boolean;protectedFieldsRejected:boolean})=>void):Promise<SquishyResponse> {
  const checkAbort=()=>{if(signal?.aborted)throw new ApiError(408,'cancelled','Richiesta annullata. Lo squishy resta disponibile.');};checkAbort();
  const base=request.current??DEFAULT_SPEC;let repaired=false,raw:unknown;
  if(env.PROVIDER==='mock') raw=mockInterpret(request);
  else {
    if(!env.AI)throw new ApiError(503,'configuration','AI non configurata.');
    const model=env.MODEL??MODEL_QWEN;if(![MODEL_3B,MODEL_8B,MODEL_QWEN].includes(model))throw new ApiError(503,'configuration','Modello non consentito.');
    const protected_=protectedFields(request.prompt);
    const messages=[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:`Task: ${request.mode.toUpperCase()}\nCurrent material (defaults for CREATE): ${JSON.stringify(base)}\nUser description as quoted data: ${JSON.stringify(request.prompt)}\nExplicitly protected fields (MUST be omitted): ${JSON.stringify(protected_)}\nReturn only the JSON edit for this description.`}];
    const expires=Date.now()+18000;
    for(let attempt=0;attempt<2;attempt++) {
      checkAbort();
      const remaining=expires-Date.now();
      if(remaining<=0)throw new ApiError(504,'timeout','Il tempo disponibile per l’AI è esaurito. Lo squishy resta com’è.');
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
        if(Date.now()>=expires)throw new ApiError(504,'timeout','Il tempo disponibile per l’AI è esaurito. Lo squishy resta com’è.');
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
        if(Date.now()>=expires)throw new ApiError(504,'timeout','Il tempo disponibile per l’AI è esaurito. Lo squishy resta com’è.');
        if(attempt===1)throw new ApiError(502,'invalid_output','L’AI ha restituito una specifica non valida. Lo squishy resta com’è.');
        repaired=true;messages.push({role:'user',content:`Your previous response was rejected: ${error instanceof ValidationError?error.message:'invalid JSON'}. Return ONLY a valid compact JSON object for the ORIGINAL description; never code. Omit protected fields ${JSON.stringify(protected_)}. Do not repeat invalid or unsupported fields. This is the only repair attempt.`});
      }
    }
  }
  const {output,corrections}=validateModelOutput(raw),spec=applyPatch(base,output.patch);
  return {version:1,status:output.status,spec,patch:output.patch,message:output.message??'Squishy aggiornato.',corrections,repaired,provider:env.PROVIDER==='mock'?'mock':'workers-ai'};
}
async function protect(request:Request,body:SquishyRequest,env:Env) {
  if(!env.TURNSTILE_SECRET||!env.TURNSTILE_SITE_KEY||!env.AI_RATE||!env.BURST_RATE)throw new ApiError(503,'configuration','La protezione AI non è ancora configurata. Usa i preset locali.');
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)throw new ApiError(403,'verification','Origine della richiesta non verificata.');
  if(!(await env.AI_RATE.limit({key:ip})).success || !(await env.BURST_RATE.limit({key:'ai-budget'})).success)throw new ApiError(429,'rate_limit','Troppe richieste. Aspetta un minuto.');
  if(!body.turnstileToken)throw new ApiError(403,'verification','Completa la verifica prima di usare l’AI.');
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:body.turnstileToken,remoteip:ip}),signal:AbortSignal.timeout(5000)});
  const result=await response.json() as {success?:boolean;hostname?:string;action?:string};
  if(!response.ok||!result.success||result.hostname!==new URL(request.url).hostname||result.action!=='squishy')throw new ApiError(403,'verification','Verifica scaduta o non valida. Riprova.');
}
export async function handleApi(request:Request,env:Env):Promise<Response> {
  const url=new URL(request.url),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  try {
    if(url.pathname==='/api/config'&&request.method==='GET') {
      const provider=env.PROVIDER==='mock'&&local?'mock':env.PROVIDER==='workers-ai'?'workers-ai':'disabled';
      return json({provider,model:env.MODEL??MODEL_QWEN,siteKey:provider==='workers-ai'?env.TURNSTILE_SITE_KEY??null:null});
    }
    if(url.pathname!=='/api/squishy')return json({code:'not_found',message:'Endpoint non disponibile.'},404);
    if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
    const origin=request.headers.get('origin');
    if(origin&&origin!==url.origin)throw new ApiError(403,'origin','Origine non consentita.');
    if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'origin','Origine non consentita.');
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'content_type','Usa JSON.');
    const body=validateRequest(JSON.parse(await deadline(boundedBody(request),5000)));
    if(env.PROVIDER==='mock') {if(!local)throw new ApiError(503,'configuration','Il mock è disponibile solo in locale.');}
    else if(env.PROVIDER==='workers-ai') await protect(request,body,env);
    else throw new ApiError(503,'configuration','AI non attivata. Puoi usare i preset locali.');
    return json(await infer(body,env,request.signal));
  } catch(error) {
    if(error instanceof ValidationError||error instanceof SyntaxError)return json({code:'invalid_request',message:'Descrizione o specifica non valida.'},400);
    const safe=providerError(error);const response=json({code:safe.code,message:safe.message},safe.status);
    if(safe.status===429)response.headers.set('Retry-After','60');return response;
  }
}
