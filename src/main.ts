import './style.css';
import { SquishyScene } from './scene';
import { DEFAULT_SPEC, PRESETS, validateSpec, type SquishySpec } from './shared/spec';
import { generate, RequestGate } from './client';
const icon=(name:string)=>name==='reset'?'<path d="M4 10a8 8 0 1 1 2 7M4 4v6h6"/>':name==='rotate'?'<path d="M19 9c-1-3-13-3-14 0s12 6 14 2M16 7l3 2-3 3M5 15v2c0 4 14 4 14 0v-2"/>':'<path d="M7 4v7m5-9v9m5-7v8m-14 0 4 6c2 3 10 3 12-2l2-7M7 11c-3-3-5 0-3 3"/>';
const svg=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<div class="shell">
  <header class="topbar"><a class="brand" href="/" aria-label="Squishy Lab, inizio"><span class="brand-mark">s.</span>squishy<span>lab</span></a><span class="mode-badge" id="mode-badge">Demo locale · senza AI</span></header>
  <main>
    <div class="intro"><div><p class="eyebrow">UN PICCOLO LABORATORIO DI MORBIDEZZA</p><h1>Come lo vuoi, oggi?</h1></div><p class="intro-note">Descrivilo. Premilo.<br/>Lascialo tornare su.</p></div>
    <div class="workspace">
      <div class="object-column">
      <section class="play-area" aria-label="Area di gioco">
        <div class="stage-top"><span class="stage-label">IL TUO SQUISHY</span><span class="state" id="state">Pronto da premere</span></div>
        <canvas id="squishy" tabindex="0" role="application" aria-label="Squishy 3D. Tieni premuto o trascina per comprimere. Con la tastiera, tieni Spazio e rilascia; Escape ripristina la forma." aria-describedby="gesture-help"></canvas>
        <div class="stage-bottom"><p id="gesture-help">Tieni premuto per affondare.<br/><span>Trascina per spostare la pressione.</span></p><button id="rotate" class="icon-button" aria-label="Ruota la vista">${svg('rotate')}</button></div>
        <div id="canvas-error" class="canvas-error" hidden>Il browser non riesce ad avviare WebGL 2. Prova un browser aggiornato con accelerazione grafica.</div>
      </section>
      <section class="under-stage" aria-label="Controlli e materiale"><div class="material-summary"><span id="color-chip"></span><div><strong id="material-name">Nuvola viola</strong><p id="material-description">Morbidissimo · ritorno lento · opaco</p></div></div><div class="play-actions"><button id="squeeze" class="secondary">${svg('hand')}Tieni per premere</button><button id="reset" class="text-button">${svg('reset')}Ripristina forma</button></div></section>
      </div>
      <aside class="composer">
        <div class="composer-heading"><span class="step">01</span><h2>Dagli un’idea</h2></div>
        <form id="prompt-form">
          <label for="prompt">Colore, forma, sensazione…</label>
          <textarea id="prompt" maxlength="500" rows="4" placeholder="Un mochi viola, molto morbido, che torna su lentamente."></textarea>
          <div class="request-kind" role="group" aria-label="Tipo di richiesta"><button type="button" id="modify-mode" class="selected" aria-pressed="true">Modifica questo</button><button type="button" id="create-mode" aria-pressed="false">Crea da zero</button></div>
          <div id="turnstile"></div>
          <button class="primary" id="generate" type="submit"><span id="generate-label">Applica la descrizione</span><span class="button-spark" aria-hidden="true">✦</span></button>
          <p class="privacy" id="privacy">Interprete demo locale: riconosce poche parole, senza usare AI o inviare la descrizione.</p>
          <p id="status" class="status" role="status" aria-live="polite">Prova anche “uguale, ma meno molle”.</p>
        </form>
        <div class="divider"></div>
        <div class="composer-heading"><span class="step">02</span><h2>Oppure, parti da qui</h2></div>
        <p class="preset-note">Tre materiali pronti, tutti locali.</p>
        <div class="presets">${PRESETS.map((p,i)=>`<button class="preset ${i===0?'active':''}" data-preset="${i}" aria-pressed="${i===0}"><span class="swatch" style="--swatch:${p.spec.color}"></span><span><strong>${p.name}</strong><small>${p.description}</small></span><span class="preset-check" aria-hidden="true">✓</span></button>`).join('')}</div>
      </aside>
    </div>
  </main>
  <footer><span>Una forma semplice. Tante sensazioni.</span><span id="model-credit" hidden>Built with Llama · Cloudflare Workers AI</span><button id="forget">Cancella lo squishy salvato</button></footer>
</div>`;
function el<T extends HTMLElement=HTMLElement>(id:string){return document.getElementById(id) as T;}
let spec=structuredClone(DEFAULT_SPEC),name='Nuvola viola';
try {const saved=localStorage.getItem('squishy-spec-v1');if(saved){spec=validateSpec(JSON.parse(saved));name='Il tuo mochi';}}catch{try{localStorage.removeItem('squishy-spec-v1');}catch{/* Storage can be disabled. */}}
const status=el('status'),prompt=el<HTMLTextAreaElement>('prompt'),submit=el<HTMLButtonElement>('generate'),canvas=el<HTMLCanvasElement>('squishy'),gate=new RequestGate();
let scene:SquishyScene;
try {scene=new SquishyScene(canvas,spec,state=>{const text={pressing:'Sotto pressione',recovering:'Sta tornando su…',rest:'Pronto da premere'}[state];if(el('state').textContent!==text)el('state').textContent=text;el('state').dataset.state=state;});}
catch {el('canvas-error').hidden=false;for(const id of ['squeeze','rotate'])el<HTMLButtonElement>(id).disabled=true;}
let mode:'create'|'modify'='modify',provider='mock',requestController:AbortController|null=null;
let turnstileToken='',widget:string|undefined;
interface Turnstile {render(element:HTMLElement,options:Record<string,unknown>):string;reset(id:string):void}
declare global {interface Window {turnstile?:Turnstile; __squishy?:{snapshot:()=>unknown;press:()=>void;release:()=>void;reset:()=>void;setSpec:(spec:SquishySpec)=>void};}}
function updateSummary() {
  el('material-name').textContent=name;el('color-chip').style.backgroundColor=spec.color;
  el('material-description').textContent=`${spec.softness>.75?'Morbidissimo':spec.softness>.45?'Morbido':'Più sodo'} · ${spec.recoverySeconds>3?'ritorno lento':spec.recoverySeconds>1?'ritorno dolce':'ritorno rapido'} · ${spec.finish==='matte'?'opaco':'satinato'}`;
}
function save(){try{localStorage.setItem('squishy-spec-v1',JSON.stringify(spec));}catch{/* Storage is optional. */}}
function apply(next:SquishySpec,label:string){scene?.applySpec(next);spec=next;name=label;updateSummary();save();}
function cancelRequest(){gate.invalidate();requestController?.abort();requestController=null;submit.disabled=false;el('generate-label').textContent='Applica la descrizione';}
function chooseMode(next:'create'|'modify') {mode=next;for(const m of ['create','modify']){const b=el<HTMLButtonElement>(`${m}-mode`);b.classList.toggle('selected',m===mode);b.setAttribute('aria-pressed',String(m===mode));}}
el('create-mode').onclick=()=>chooseMode('create');el('modify-mode').onclick=()=>chooseMode('modify');
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button=>button.onclick=()=>{
  cancelRequest();const p=PRESETS[Number(button.dataset.preset)];apply(structuredClone(p.spec),p.name);status.textContent='Preset locale pronto. Premi per sentire la differenza.';
  document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
});
el<HTMLFormElement>('prompt-form').onsubmit=async event=>{
  event.preventDefault();if(!prompt.value.trim()){status.textContent='Scrivi come vorresti il tuo squishy.';prompt.focus();return;}
  if(provider==='disabled'){status.textContent='AI non configurata. I preset locali sono pronti da usare.';return;}
  if(provider==='workers-ai'&&!turnstileToken){status.textContent='Completa la verifica prima di usare l’AI.';return;}
  requestController?.abort();const ticket=gate.ticket(),controller=new AbortController();requestController=controller;
  const timeout=setTimeout(()=>controller.abort('timeout'),26000);
  submit.disabled=true;el('generate-label').textContent=provider==='mock'?'Interpreto nella demo…':'L’AI sta creando…';status.textContent='Intanto puoi continuare a premere lo squishy.';
  try {
    const response=await generate({version:1,mode,prompt:prompt.value,...(mode==='modify'?{current:spec}:{}),...(turnstileToken?{turnstileToken}:{})},controller.signal);
    if(!gate.current(ticket))return;
    if(response.status==='ok'){apply(response.spec,'Il tuo mochi');document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});}
    status.textContent=response.message+(response.corrections.length?' Alcuni valori al limite sono stati corretti.':'')+(response.repaired?' Risposta corretta dopo un tentativo di riparazione.':'');
  } catch(error) {if(gate.current(ticket))status.textContent=controller.signal.aborted?'La richiesta è scaduta. Lo squishy resta disponibile.':error instanceof Error?error.message:'Il servizio non è disponibile.';}
  finally {clearTimeout(timeout);if(gate.current(ticket)){submit.disabled=false;el('generate-label').textContent='Applica la descrizione';requestController=null;turnstileToken='';if(widget)window.turnstile?.reset(widget);}}
};
el('reset').onclick=()=>{cancelRequest();scene?.reset();status.textContent='Forma ripristinata, stesso materiale.';};
el('rotate').onclick=()=>scene?.rotate();
const squeeze=el<HTMLButtonElement>('squeeze');
squeeze.onpointerdown=event=>{event.preventDefault();squeeze.setPointerCapture(event.pointerId);scene?.beginStandardPress();};
for(const name of ['pointerup','pointercancel','lostpointercapture','blur'])squeeze.addEventListener(name,()=>scene?.release());
squeeze.onkeydown=event=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();scene?.beginStandardPress();}};
squeeze.onkeyup=event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();scene?.release();}};
el('forget').onclick=()=>{cancelRequest();try{localStorage.removeItem('squishy-spec-v1');}catch{/* Storage can be disabled. */}scene?.reset();spec=structuredClone(DEFAULT_SPEC);scene?.applySpec(spec);name='Nuvola viola';updateSummary();status.textContent='Specifica salvata cancellata. Nessuna cronologia delle descrizioni è conservata.';};
updateSummary();
async function configureProvider() {
  try {
    const response=await fetch(`${import.meta.env.VITE_API_BASE??''}/api/config`,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error();
    const config=await response.json() as {provider:string;siteKey?:string};provider=config.provider;
    if(provider==='workers-ai') {
      el('model-credit').hidden=false;
      el('mode-badge').textContent='AI remota · Cloudflare';el('privacy').textContent='La descrizione viene inviata a Cloudflare Workers AI. Non inserire dati personali. Lo squishy si muove sempre sul tuo dispositivo.';
      if(config.siteKey){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>{widget=window.turnstile?.render(el('turnstile'),{sitekey:config.siteKey,action:'squishy',callback:(token:string)=>{turnstileToken=token;},'expired-callback':()=>{turnstileToken='';},'error-callback':()=>{turnstileToken='';status.textContent='Verifica non disponibile. I preset funzionano ancora.';}});};script.onerror=()=>{status.textContent='Verifica non disponibile. Usa un preset locale.';};document.head.append(script);}
    } else if(provider!=='mock') {provider='disabled';el('mode-badge').textContent='Preset locali · AI non attiva';el('privacy').textContent='L’AI non è configurata. Usa i tre preset per provare i materiali.';}
  } catch {provider='disabled';el('mode-badge').textContent='Preset locali · servizio assente';el('privacy').textContent='Il servizio descrizioni non è raggiungibile. Lo squishy e i preset restano utilizzabili.';}
}
void configureProvider();
if(import.meta.env.DEV||new URLSearchParams(location.search).has('evidence'))window.__squishy={snapshot:()=>scene?.diagnostics(),press:()=>scene?.beginStandardPress(),release:()=>scene?.release(),reset:()=>scene?.reset(),setSpec:next=>{cancelRequest();apply(validateSpec(next),'Materiale di prova');}};
