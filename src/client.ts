import { applyPatch, DEFAULT_SPEC, record, validatePatch, validateSpec, type SquishyRequest, type SquishyResponse } from './shared/spec';
export class RequestGate {
  private revision=0;
  invalidate(){this.revision++;}
  ticket(){return ++this.revision;}
  current(ticket:number){return this.revision===ticket;}
}
export async function generate(request:SquishyRequest,signal:AbortSignal):Promise<SquishyResponse> {
  const response=await fetch(`${import.meta.env.VITE_API_BASE??''}/api/squishy`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
  const text=await response.text();if(text.length>12000)throw new Error('The response is too large. Your squishy stays as it is.');
  let data:Record<string,unknown>;try {data=record(JSON.parse(text));}catch {throw new Error('Invalid service response.');}
  if(!response.ok)throw new Error(typeof data.message==='string'?data.message:'The service is unavailable.');
  if(data.version!==1||(data.status!=='ok'&&data.status!=='unsupported')||(data.provider!=='mock'&&data.provider!=='workers-ai')||typeof data.message!=='string'||data.message.length>200||typeof data.repaired!=='boolean'||!Array.isArray(data.corrections)||data.corrections.some(c=>typeof c!=='string'))throw new Error('Invalid response.');
  const spec=validateSpec(data.spec),patch=validatePatch(data.patch).patch,expected=applyPatch(request.current??DEFAULT_SPEC,patch);
  if(JSON.stringify(spec)!==JSON.stringify(expected))throw new Error('The material does not match the requested edit.');
  if(data.status==='unsupported'&&Object.keys(patch).length)throw new Error('Unsupported shape.');
  return {...data,spec,patch} as unknown as SquishyResponse;
}
