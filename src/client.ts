import { applyPatch, DEFAULT_SPEC, record, validatePatch, validateSpec, type SquishyRequest, type SquishyResponse } from './shared/spec';
export class RequestGate {
  private revision=0;
  invalidate(){this.revision++;}
  ticket(){return ++this.revision;}
  current(ticket:number){return this.revision===ticket;}
}
export async function generate(request:SquishyRequest,signal:AbortSignal):Promise<SquishyResponse> {
  const response=await fetch(`${import.meta.env.VITE_API_BASE??''}/api/squishy`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
  const text=await response.text();if(text.length>12000)throw new Error('Risposta troppo grande. Lo squishy resta com’è.');
  let data:Record<string,unknown>;try {data=record(JSON.parse(text));}catch {throw new Error('Risposta del servizio non valida.');}
  if(!response.ok)throw new Error(typeof data.message==='string'?data.message:'Il servizio non è disponibile.');
  if(data.version!==1||(data.status!=='ok'&&data.status!=='unsupported')||(data.provider!=='mock'&&data.provider!=='workers-ai')||typeof data.message!=='string'||data.message.length>200||typeof data.repaired!=='boolean'||!Array.isArray(data.corrections)||data.corrections.some(c=>typeof c!=='string'))throw new Error('Risposta non valida.');
  const spec=validateSpec(data.spec),patch=validatePatch(data.patch).patch,expected=applyPatch(request.current??DEFAULT_SPEC,patch);
  if(JSON.stringify(spec)!==JSON.stringify(expected))throw new Error('Specifica incoerente con la modifica.');
  if(data.status==='unsupported'&&Object.keys(patch).length)throw new Error('Forma non supportata.');
  return {...data,spec,patch} as unknown as SquishyResponse;
}
