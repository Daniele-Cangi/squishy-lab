import { PRESETS } from './shared/spec';
import { COLLECTION } from './collection';
const thumbnail=(id:string)=>`<svg viewBox="0 0 80 52" aria-hidden="true" class="shape-thumbnail">${id==='berry'?'<path d="M19 17Q13 34 39 49Q64 34 61 17Q40 5 19 17" fill="#ee7890"/><path d="M22 17L32 8L40 15L48 7L58 16L42 22Z" fill="#67a67c"/><circle cx="31" cy="28" r="2.4" fill="#4c3c46"/><circle cx="47" cy="28" r="2.4" fill="#4c3c46"/><path d="M36 32Q39 37 43 32" fill="none" stroke="#4c3c46" stroke-width="1.8"/>':id==='mochi'?'<ellipse cx="40" cy="29" rx="28" ry="18" fill="#b8a5ef"/><ellipse cx="32" cy="21" rx="16" ry="7" fill="#d7c7ff" opacity=".5"/>':`<path d="M10 18L25 9L69 13L69 36L53 45L10 40Z" fill="${id==='jelly'?'#96d5e4':id==='butter'?'#e5c45e':'#e994b1'}"/><path d="M10 18L25 9L69 13L53 23Z" fill="${id==='jelly'?'#c9eef3':id==='butter'?'#f6df89':'#f8b8ce'}"/><path d="M53 23L69 13L69 36L53 45Z" fill="#ffffff" opacity=".16"/>${id==='jelly'?'<path d="M28 18L31 25L38 27L31 29L28 36L26 29L19 27L26 25Z" fill="#fff"/><circle cx="49" cy="17" r="2" fill="#fff"/>':`<text x="31" y="33" text-anchor="middle" fill="#fff9e9" font-size="${id==='butter'?8:5.8}" font-weight="800">${id==='butter'?'BUTTER':'STRAWBERRY'}</text>`}`}</svg>`;
const foodThumbnails:Record<string,string>={
  chocolate:'<path d="M9 19L22 9L69 15V36L57 45L9 38Z" fill="#75422e"/><path d="M12 18L24 11L66 16L55 25Z" fill="#aa7050"/><path d="M28 13L18 21M43 15L33 23M59 17L48 25M18 16L59 22" stroke="#643a2c" stroke-width="2"/><path d="M9 26L56 33L69 24" fill="none" stroke="#5d3427"/>',
  banana:'<path d="M12 16Q35 44 63 15L67 13Q64 43 41 45Q18 44 10 22Z" fill="#f4ce54"/><path d="M16 26Q37 48 60 27" fill="none" stroke="#d4aa36" stroke-width="2"/><path d="M10 16L14 13L19 19L14 23Z M61 16L65 10L70 11L67 17Z" fill="#84613d"/>',
  cat:'<path d="M15 24L16 8L30 18Q40 14 50 18L65 8L65 27Q72 48 41 49Q10 49 15 24" fill="#e9ab77"/><path d="M19 15L20 27L29 21M61 15L51 21L61 27" fill="#df8e91"/><circle cx="30" cy="30" r="2.5" fill="#423545"/><circle cx="50" cy="30" r="2.5" fill="#423545"/><path d="M37 35L43 35L40 38Z" fill="#af6b6b"/><path d="M27 36L17 34M53 36L63 34M36 20V24M44 20V24" stroke="#795b50" stroke-width="1.5"/>',
  cheese:'<path d="M10 25L42 9L69 24V43L10 43Z" fill="#e2a83b"/><path d="M10 25L42 9L69 24Z" fill="#ffe087"/><circle cx="24" cy="33" r="5" fill="#b7802c"/><circle cx="51" cy="35" r="6" fill="#b7802c"/><ellipse cx="41" cy="21" rx="5" ry="2.7" fill="#d79730"/>',
  peanut:'<path d="M10 26Q7 10 25 10Q34 10 40 17Q47 10 57 10Q74 10 72 27Q73 45 56 44Q46 44 40 37Q33 44 24 44Q7 43 10 26" fill="#d4a46e"/><path d="M12 20L28 39M15 13L37 35M28 12L38 24M12 32L28 14M20 42L35 23M45 23L56 12M44 35L65 13M54 41L70 23M46 17L69 35M44 28L58 43" stroke="#b78350" stroke-width="1.4"/>',
};
const collectionThumbnail=(id:string)=>foodThumbnails[id]?`<svg viewBox="0 0 80 52" aria-hidden="true" class="shape-thumbnail">${foodThumbnails[id]}</svg>`:thumbnail(id);
// Italian presentation copy stays separate from request and simulation logic.
const icon=(name:string)=>name==='reset'?'<path d="M4 10a8 8 0 1 1 2 7M4 4v6h6"/>':name==='rotate'?'<path d="M19 9c-1-3-13-3-14 0s12 6 14 2M16 7l3 2-3 3M5 15v2c0 4 14 4 14 0v-2"/>':'<path d="M7 4v7m5-9v9m5-7v8m-14 0 4 6c2 3 10 3 12-2l2-7M7 11c-3-3-5 0-3 3"/>';
const svg=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`;
export const labMarkup=`
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
      <section class="collection" aria-label="Forme e superfici"><div class="collection-heading"><h2>Scegli una forma</h2><span>Scritte, sorrisi e piccoli dettagli</span></div><div class="shape-list" role="group" aria-label="Collezione">${COLLECTION.map(c=>`<button class="shape-choice" data-shape="${c.id}" aria-label="${c.name}" title="${c.note}" aria-pressed="${c.id==='mochi'}">${collectionThumbnail(c.id)}<span>${c.name}</span></button>`).join('')}</div><div class="finish-row"><div class="finish-options" role="group" aria-label="Effetto della superficie"><button data-effect="foam" aria-pressed="true">Soft touch</button><button data-effect="glitter" aria-pressed="false">✦ Glitter</button><button data-effect="clear" aria-pressed="false">Trasparente ✦</button></div><label class="face-option"><input type="checkbox" id="face"/>Con il viso</label></div></section>
      <section class="under-stage" aria-label="Controlli e materiale"><div class="material-summary"><span id="color-chip"></span><div><strong id="material-name">Nuvola viola</strong><p id="material-description">Morbidissimo · ritorno lento · opaco</p></div></div><div class="play-actions"><button id="squeeze" class="secondary">${svg('hand')}Tieni per premere</button><button id="reset" class="text-button">${svg('reset')}Ripristina forma</button></div></section>
      <section id="comparison-row" class="comparison-row" aria-label="Confronto del materiale" hidden><button id="compare" class="secondary">Confronta prima e dopo</button><div><strong id="comparison-phase">Stessa forma e colore, la stessa pressione.</strong><p id="comparison-details"></p></div></section>
      </div>
      <aside class="composer">
        <div class="composer-heading"><span class="step">01</span><h2>Dagli un’idea</h2></div>
        <form id="prompt-form">
          <label for="prompt">Colore, morbidezza, ritorno…</label>
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
  <footer><span>Piccole forme. Tante sensazioni.</span><span id="model-credit" hidden>Built with Llama · Cloudflare Workers AI</span><button id="forget">Cancella lo squishy salvato</button></footer>
</div>`;
