import { labMarkup } from './view';
import { copy,materialSummary,describeChange,hasMaterialChange } from './copy';
import './style.css';
import { SquishyScene } from './scene';
import { DEFAULT_SPEC, PRESETS, validateSpec, type SquishySpec } from './shared/spec';
import { generate, RequestGate } from './client';
document.querySelector<HTMLDivElement>('#app')!.innerHTML=labMarkup;
function el<T extends HTMLElement=HTMLElement>(id:string){return document.getElementById(id) as T;}
let spec=structuredClone(DEFAULT_SPEC),name='Nuvola viola';
try {const saved=localStorage.getItem('squishy-spec-v1');if(saved){spec=validateSpec(JSON.parse(saved));name='Il tuo mochi';}}catch{try{localStorage.removeItem('squishy-spec-v1');}catch{/* Storage can be disabled. */}}
const status=el('status'),prompt=el<HTMLTextAreaElement>('prompt'),submit=el<HTMLButtonElement>('generate'),canvas=el<HTMLCanvasElement>('squishy'),gate=new RequestGate();
let scene:SquishyScene;
try {scene=new SquishyScene(canvas,spec,state=>{const text=copy.states[state];if(el('state').textContent!==text)el('state').textContent=text;el('state').dataset.state=state;});}
catch {el('canvas-error').hidden=false;for(const id of ['squeeze','rotate'])el<HTMLButtonElement>(id).disabled=true;}
let mode:'create'|'modify'='modify',provider='mock',requestController:AbortController|null=null;
let comparison:{before:SquishySpec;after:SquishySpec}|null=null,comparing=false;
function clearComparison(){scene?.stopComparison();comparison=null;el('comparison-row').hidden=true;}
el('compare').onclick=()=>{
  if(comparing){scene?.stopComparison();return;}if(!comparison)return;
  cancelRequest();scene?.compare(comparison.before,comparison.after,phase=>{
    comparing=phase!==null;el('compare').textContent=comparing?copy.stopComparison:copy.compare;
    el('comparison-phase').textContent=phase===null?copy.comparisonReady:copy.comparisonPhase[phase];
    el('comparison-row').dataset.phase=phase===null?'ready':phase===0?'before':'after';
  });
};
let turnstileToken='',widget:string|undefined,verificationEpoch=0,verificationSiteKey='';
interface Turnstile {render(element:HTMLElement,options:Record<string,unknown>):string;remove(id:string):void}
function renewVerification() {
  turnstileToken='';const epoch=++verificationEpoch;
  if(widget!==undefined)window.turnstile?.remove(widget);widget=undefined;
  if(!window.turnstile||!verificationSiteKey)return;
  widget=window.turnstile.render(el('turnstile'),{
    sitekey:verificationSiteKey,action:'squishy',
    callback:(token:string)=>{if(epoch===verificationEpoch)turnstileToken=token;},
    'expired-callback':()=>{if(epoch===verificationEpoch)turnstileToken='';},
    'error-callback':()=>{if(epoch===verificationEpoch){turnstileToken='';if(!requestController)status.textContent='Verifica non disponibile. I preset funzionano ancora.';}},
  });
}
declare global {interface Window {turnstile?:Turnstile; __squishy?:{snapshot:()=>unknown;press:()=>void;release:()=>void;reset:()=>void;setSpec:(spec:SquishySpec)=>void};}}
function updateSummary() {
  el('material-name').textContent=name;el('color-chip').style.backgroundColor=spec.color;
  el('material-description').textContent=materialSummary(spec);
}
function save(){try{localStorage.setItem('squishy-spec-v1',JSON.stringify(spec));}catch{/* Storage is optional. */}}
function apply(next:SquishySpec,label:string){scene?.applySpec(next);spec=next;name=label;updateSummary();save();}
function cancelRequest(){gate.invalidate();requestController?.abort();requestController=null;submit.disabled=false;el('generate-label').textContent='Applica la descrizione';}
function chooseMode(next:'create'|'modify') {mode=next;for(const m of ['create','modify']){const b=el<HTMLButtonElement>(`${m}-mode`);b.classList.toggle('selected',m===mode);b.setAttribute('aria-pressed',String(m===mode));}}
el('create-mode').onclick=()=>chooseMode('create');el('modify-mode').onclick=()=>chooseMode('modify');
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>button.onclick=()=>{
  cancelRequest();clearComparison();const p=PRESETS[Number(button.dataset.preset)];apply(structuredClone(p.spec),p.name);status.textContent='Preset locale pronto. Premi per sentire la differenza.';
  document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
});
el<HTMLFormElement>('prompt-form').onsubmit=async event=>{
  event.preventDefault();if(!prompt.value.trim()){status.textContent='Scrivi come vorresti il tuo squishy.';prompt.focus();return;}
  if(provider==='disabled'){status.textContent='AI non configurata. I preset locali sono pronti da usare.';return;}
  if(provider==='workers-ai'&&!turnstileToken){status.textContent='Completa la verifica prima di usare l’AI.';return;}
  scene?.stopComparison();const before=structuredClone(spec),sentMode=mode;
  // An already sent token is spent even if the request is aborted. Mount a new
  // widget generation now; an old finally or callback cannot clear its token.
  const sentToken=turnstileToken;if(provider==='workers-ai')renewVerification();
  requestController?.abort();const ticket=gate.ticket(),controller=new AbortController();requestController=controller;
  const timeout=setTimeout(()=>controller.abort('timeout'),26000);
  submit.disabled=true;el('generate-label').textContent=provider==='mock'?'Interpreto nella demo…':'L’AI sta creando…';status.textContent='Intanto puoi continuare a premere lo squishy.';
  try {
    const response=await generate({version:1,mode,prompt:prompt.value,...(mode==='modify'?{current:spec}:{}),...(sentToken?{turnstileToken:sentToken}:{})},controller.signal);
    if(!gate.current(ticket))return;
    if(response.status==='ok'){
      clearComparison();apply(response.spec,'Il tuo mochi');document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      if(sentMode==='modify'&&hasMaterialChange(before,response.spec)){
        comparison={before,after:structuredClone(response.spec)};el('comparison-row').hidden=false;
        el('comparison-phase').textContent=copy.comparisonReady;el('comparison-row').dataset.phase='ready';
        el('comparison-details').textContent=`Prima: ${materialSummary(before)}. Dopo: ${materialSummary(response.spec)}.`;
      }
    }
    status.textContent=(response.status==='ok'?`${response.provider==='mock'?'Modifica in demo locale':'Squishy aggiornato'}: ${describeChange(before,response.spec)}.`:`Questa forma o modifica non è disponibile. ${response.message}`)+(response.corrections.length?' Alcuni valori al limite sono stati corretti.':'')+(response.repaired?' Risposta corretta dopo un tentativo di riparazione.':'');
  } catch(error) {if(gate.current(ticket))status.textContent=controller.signal.aborted?'La richiesta è scaduta. Lo squishy resta disponibile.':error instanceof Error?error.message:'Il servizio non è disponibile.';}
  finally {clearTimeout(timeout);if(gate.current(ticket)){submit.disabled=false;el('generate-label').textContent='Applica la descrizione';requestController=null;}}
};
el('reset').onclick=()=>{cancelRequest();scene?.reset();status.textContent='Forma ripristinata, stesso materiale.';};
el('rotate').onclick=()=>scene?.rotate();
const squeeze=el<HTMLButtonElement>('squeeze');
squeeze.onpointerdown=event=>{event.preventDefault();squeeze.setPointerCapture(event.pointerId);scene?.beginStandardPress();};
for(const name of ['pointerup','pointercancel','lostpointercapture','blur'])squeeze.addEventListener(name,()=>scene?.release());
squeeze.onkeydown=event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();scene?.beginStandardPress();}};
squeeze.onkeyup=event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();scene?.release();}};
el('forget').onclick=()=>{cancelRequest();clearComparison();try{localStorage.removeItem('squishy-spec-v1');}catch{/* Storage can be disabled. */}scene?.reset();spec=structuredClone(DEFAULT_SPEC);scene?.applySpec(spec);name='Nuvola viola';updateSummary();status.textContent='Specifica salvata cancellata. Nessuna cronologia delle descrizioni è conservata.';};
updateSummary();
async function configureProvider() {
  try {
    const response=await fetch(`${import.meta.env.VITE_API_BASE??''}/api/config`,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error();
    const config=await response.json() as {provider:string;model?:string;siteKey?:string};provider=config.provider;
    el('model-credit').textContent=config.model==='@cf/qwen/qwen3-30b-a3b-fp8'?'Qwen3 · Cloudflare Workers AI':'Built with Llama · Cloudflare Workers AI';
    if(provider==='workers-ai') {
      el('model-credit').hidden=false;
      el('mode-badge').textContent='AI remota · Cloudflare';el('privacy').textContent='La descrizione viene inviata a Cloudflare Workers AI. Non inserire dati personali. Lo squishy si muove sempre sul tuo dispositivo.';
      if(config.siteKey){verificationSiteKey=config.siteKey;const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=renewVerification;script.onerror=()=>{status.textContent='Verifica non disponibile. Usa un preset locale.';};document.head.append(script);}
    } else if(provider==='evaluation-ai'&&import.meta.env.DEV){
      el('model-credit').hidden=false;el('mode-badge').textContent='AI remota · test locale';
      el('privacy').textContent='Test locale con Cloudflare Workers AI reale, limitato a 12 chiamate. La descrizione viene inviata a Cloudflare; evita dati personali.';
    } else if(provider!=='mock') {provider='disabled';el('mode-badge').textContent='Preset locali · AI non attiva';el('privacy').textContent='L’AI non è configurata. Usa i tre preset per provare i materiali.';}
  } catch {provider='disabled';el('mode-badge').textContent='Preset locali · servizio assente';el('privacy').textContent='Il servizio descrizioni non è raggiungibile. Lo squishy e i preset restano utilizzabili.';}
}
void configureProvider();
if(import.meta.env.DEV||new URLSearchParams(location.search).has('evidence'))window.__squishy={snapshot:()=>scene?.diagnostics(),press:()=>scene?.beginStandardPress(),release:()=>scene?.release(),reset:()=>scene?.reset(),setSpec:next=>{cancelRequest();apply(validateSpec(next),'Materiale di prova');}};
