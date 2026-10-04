import { labMarkup } from './view';
import { copy,materialSummary,describeChange,hasMaterialChange } from './copy';
import './style.css';
import { SquishyScene } from './scene';
import { DEFAULT_SPEC, PRESETS, validateSpec, type SquishySpec } from './shared/spec';
import { generate, RequestGate } from './client';
import { COLLECTION,DEFAULT_APPEARANCE,validateAppearance,collectionName,type Appearance,type SurfaceEffect,type FaceExpression } from './collection';
document.querySelector<HTMLDivElement>('#app')!.innerHTML=labMarkup;
function el<T extends HTMLElement=HTMLElement>(id:string){return document.getElementById(id) as T;}
let spec=structuredClone(DEFAULT_SPEC),name='Purple cloud';
let appearance:Appearance={...DEFAULT_APPEARANCE};
try{const saved=localStorage.getItem('squishy-appearance-v1');if(saved)appearance=validateAppearance(JSON.parse(saved));}catch{try{localStorage.removeItem('squishy-appearance-v1');}catch{/* Optional storage. */}}
try {const saved=localStorage.getItem('squishy-spec-v1');if(saved){spec=validateSpec(JSON.parse(saved));name='Your mochi';}}catch{try{localStorage.removeItem('squishy-spec-v1');}catch{/* Storage can be disabled. */}}
const status=el('status'),prompt=el<HTMLTextAreaElement>('prompt'),submit=el<HTMLButtonElement>('generate'),canvas=el<HTMLCanvasElement>('squishy'),gate=new RequestGate();
const updateViewport=()=>{
  const visibleHeight=window.visualViewport?.height??innerHeight;document.documentElement.style.setProperty('--visible-height',`${visibleHeight}px`);
  if(document.activeElement===prompt&&matchMedia('(max-width:720px)').matches)requestAnimationFrame(()=>{if(document.activeElement===prompt)window.scrollBy({top:prompt.getBoundingClientRect().bottom-visibleHeight+12,behavior:'instant'});});
};
window.visualViewport?.addEventListener('resize',updateViewport);window.addEventListener('resize',updateViewport);updateViewport();
prompt.addEventListener('focus',()=>{document.body.dataset.composing='true';updateViewport();});
const composer=document.querySelector<HTMLElement>('.composer')!;
// Keep pointer targets still while focus moves from the field to its controls.
composer.addEventListener('focusout',event=>{if(!(event.relatedTarget instanceof Node)||!composer.contains(event.relatedTarget))delete document.body.dataset.composing;});
let scene!:SquishyScene;
try {scene=new SquishyScene(canvas,spec,state=>{const text=copy.states[state];if(el('state').textContent!==text)el('state').textContent=text;el('state').dataset.state=state;});}
catch {el('canvas-error').hidden=false;for(const id of ['squeeze','rotate'])el<HTMLButtonElement>(id).disabled=true;}
scene?.setAppearance(appearance);
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
    sitekey:verificationSiteKey,action:'squishy',language:'en',theme:'light',size:'compact',appearance:'interaction-only',
    callback:(token:string)=>{if(epoch===verificationEpoch)turnstileToken=token;},
    'expired-callback':()=>{if(epoch===verificationEpoch)turnstileToken='';},
    'error-callback':()=>{if(epoch===verificationEpoch){turnstileToken='';if(!requestController)status.textContent='Verification is unavailable. Presets still work.';}},
  });
}
declare global {interface Window {turnstile?:Turnstile; __squishy?:{snapshot:()=>unknown;press:()=>void;release:()=>void;reset:()=>void;setSpec:(spec:SquishySpec)=>void};}}
function updateSummary() {
  el('material-name').textContent=appearance.shape==='mochi'?name:collectionName(appearance);el('color-chip').style.backgroundColor=spec.color;
  el('material-description').textContent=appearance.effect==='foam'?materialSummary(spec):materialSummary(spec).replace(/ · (matte|satin)$/u,appearance.effect==='clear'?' · clear and glitter':' · glitter');
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(b=>{const selected=JSON.stringify(PRESETS[Number(b.dataset.preset)].spec)===JSON.stringify(spec);b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
}
function save(){try{localStorage.setItem('squishy-spec-v1',JSON.stringify(spec));}catch{/* Storage is optional. */}}
function apply(next:SquishySpec,label:string){scene?.applySpec(next);spec=next;name=label;updateSummary();save();}
function cancelRequest(){gate.invalidate();requestController?.abort();requestController=null;submit.disabled=false;el('generate-label').textContent='Apply description';}
function updateAppearanceControls(){
  document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(b=>{const a=COLLECTION.find(c=>c.id===b.dataset.shape)!.appearance;b.setAttribute('aria-pressed',String(a.shape===appearance.shape&&a.label===appearance.label));});
  document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.effect===appearance.effect)));
  el<HTMLInputElement>('face').checked=appearance.face;
  document.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(b=>{b.setAttribute('aria-pressed',String(appearance.face&&b.dataset.expression===(appearance.expression??'smile')));});
}
function applyAppearance(next:Appearance){cancelRequest();clearComparison();appearance={...next};scene?.setAppearance(appearance);updateAppearanceControls();updateSummary();try{localStorage.setItem('squishy-appearance-v1',JSON.stringify(appearance));}catch{/* Optional storage. */}}
document.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(button=>button.onclick=()=>{const choice=COLLECTION.find(c=>c.id===button.dataset.shape)!;applyAppearance(choice.appearance);apply(validateSpec({...spec,color:choice.color}),choice.name);document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});status.textContent=`${choice.name} is ready. You can squish the lettering and details too.`;});
document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach(button=>button.onclick=()=>{applyAppearance({...appearance,effect:button.dataset.effect as SurfaceEffect});status.textContent='Finish updated. Same squishy feel.';});
el<HTMLInputElement>('face').onchange=event=>applyAppearance({...appearance,face:(event.target as HTMLInputElement).checked});
document.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(button=>button.onclick=()=>{applyAppearance({...appearance,face:true,expression:button.dataset.expression as FaceExpression});status.textContent='New mood, same squishy.';});
canvas.addEventListener('details-error',()=>{status.textContent='Details could not load. Refresh the page to try again.';});
function chooseMode(next:'create'|'modify') {mode=next;for(const m of ['create','modify']){const b=el<HTMLButtonElement>(`${m}-mode`);b.classList.toggle('selected',m===mode);b.setAttribute('aria-pressed',String(m===mode));}}
el('create-mode').onclick=()=>chooseMode('create');el('modify-mode').onclick=()=>chooseMode('modify');
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>button.onclick=()=>{
  delete document.body.dataset.composing;
  cancelRequest();clearComparison();const p=PRESETS[Number(button.dataset.preset)];apply(structuredClone(p.spec),p.name);status.textContent='Local preset ready. Squish to feel the difference.';
  document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
});
el<HTMLFormElement>('prompt-form').onsubmit=async event=>{
  event.preventDefault();if(!prompt.value.trim()){status.textContent='Describe your dream squishy.';prompt.focus();return;}
  delete document.body.dataset.composing;
  if(provider==='disabled'){status.textContent='AI is not configured. Local presets are ready to use.';return;}
  if(provider==='workers-ai'&&!turnstileToken){status.textContent='Complete verification before using AI.';return;}
  scene?.stopComparison();const before=structuredClone(spec),sentMode=mode;
  // An already sent token is spent even if the request is aborted. Mount a new
  // widget generation now; an old finally or callback cannot clear its token.
  const sentToken=turnstileToken;if(provider==='workers-ai')renewVerification();
  requestController?.abort();const ticket=gate.ticket(),controller=new AbortController();requestController=controller;
  const timeout=setTimeout(()=>controller.abort('timeout'),26000);
  submit.disabled=true;el('generate-label').textContent=provider==='mock'?'Interpreting in the demo…':'AI is creating…';status.textContent='Keep squishing while you wait.';
  try {
    const response=await generate({version:1,mode,prompt:prompt.value,...(mode==='modify'?{current:spec}:{}),...(sentToken?{turnstileToken:sentToken}:{})},controller.signal);
    if(!gate.current(ticket))return;
    if(response.status==='ok'){
      clearComparison();apply(response.spec,'Your mochi');document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      if(sentMode==='modify'&&hasMaterialChange(before,response.spec)){
        comparison={before,after:structuredClone(response.spec)};el('comparison-row').hidden=false;
        el('comparison-phase').textContent=copy.comparisonReady;el('comparison-row').dataset.phase='ready';
        el('comparison-details').textContent=`Before: ${materialSummary(before)}. After: ${materialSummary(response.spec)}.`;
      }
    }
    status.textContent=(response.status==='ok'?`${response.provider==='mock'?'Local demo edit':'Squishy updated'}: ${describeChange(before,response.spec)}.`:`This shape or edit is unavailable. ${response.message}`)+(response.corrections.length?' Some near-limit values were adjusted.':'')+(response.repaired?' Response corrected with one repair attempt.':'');
  } catch(error) {if(gate.current(ticket))status.textContent=controller.signal.aborted?'The request timed out. Your squishy is still available.':error instanceof Error?error.message:'The service is unavailable.';}
  finally {clearTimeout(timeout);if(gate.current(ticket)){submit.disabled=false;el('generate-label').textContent='Apply description';requestController=null;}}
};
el('reset').onclick=()=>{cancelRequest();scene?.reset();status.textContent='Shape reset, same material.';};
el('rotate').onclick=()=>scene?.rotate();
const squeeze=el<HTMLButtonElement>('squeeze');
squeeze.onpointerdown=event=>{event.preventDefault();squeeze.setPointerCapture(event.pointerId);scene?.beginStandardPress();};
for(const name of ['pointerup','pointercancel','lostpointercapture','blur'])squeeze.addEventListener(name,()=>scene?.release());
squeeze.onkeydown=event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();scene?.beginStandardPress();}};
squeeze.onkeyup=event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();scene?.release();}};
el('forget').onclick=()=>{cancelRequest();clearComparison();try{localStorage.removeItem('squishy-spec-v1');localStorage.removeItem('squishy-appearance-v1');}catch{/* Storage can be disabled. */}appearance={...DEFAULT_APPEARANCE};scene?.setAppearance(appearance);updateAppearanceControls();scene?.reset();spec=structuredClone(DEFAULT_SPEC);scene?.applySpec(spec);name='Purple cloud';updateSummary();status.textContent='Saved squishy cleared. Descriptions are never stored.';};
updateSummary();updateAppearanceControls();
async function configureProvider() {
  try {
    const response=await fetch(`${import.meta.env.VITE_API_BASE??''}/api/config`,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error();
    const config=await response.json() as {provider:string;model?:string;siteKey?:string};provider=config.provider;
    el('model-credit').textContent=config.model==='@cf/qwen/qwen3-30b-a3b-fp8'?'Qwen3 · Cloudflare Workers AI':'Built with Llama · Cloudflare Workers AI';
    if(provider==='workers-ai') {
      el('model-credit').hidden=false;
      el('mode-badge').textContent='AI · Cloudflare';el('privacy').textContent='Your description is sent to Cloudflare Workers AI. Please avoid personal information. Your squishy runs on your device.';
      if(config.siteKey){verificationSiteKey=config.siteKey;const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=renewVerification;script.onerror=()=>{status.textContent='Verification is unavailable. Try a local preset.';};document.head.append(script);}
    } else if(provider==='evaluation-ai'&&import.meta.env.DEV){
      el('model-credit').hidden=false;el('mode-badge').textContent='Remote AI · local test';
      el('privacy').textContent='Local test with real Cloudflare Workers AI, limited to 12 calls. Descriptions are sent to Cloudflare; please avoid personal information.';
    } else if(provider!=='mock') {provider='disabled';el('mode-badge').textContent='Local presets · AI off';el('privacy').textContent='AI is not configured. Explore the three material presets.';}
  } catch {provider='disabled';el('mode-badge').textContent='Local presets · service offline';el('privacy').textContent='The description service is unreachable. Your squishy and presets are still available.';}
}
void configureProvider();
if(import.meta.env.DEV||new URLSearchParams(location.search).has('evidence'))window.__squishy={snapshot:()=>scene?.diagnostics(),press:()=>scene?.beginStandardPress(),release:()=>scene?.release(),reset:()=>scene?.reset(),setSpec:next=>{cancelRequest();apply(validateSpec(next),'Test material');}};
