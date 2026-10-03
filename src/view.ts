import { PRESETS } from './shared/spec';
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
      <section class="under-stage" aria-label="Controlli e materiale"><div class="material-summary"><span id="color-chip"></span><div><strong id="material-name">Nuvola viola</strong><p id="material-description">Morbidissimo · ritorno lento · opaco</p></div></div><div class="play-actions"><button id="squeeze" class="secondary">${svg('hand')}Tieni per premere</button><button id="reset" class="text-button">${svg('reset')}Ripristina forma</button></div></section>
      <section id="comparison-row" class="comparison-row" aria-label="Confronto del materiale" hidden><button id="compare" class="secondary">Confronta prima e dopo</button><div><strong id="comparison-phase">Stessa forma e colore, la stessa pressione.</strong><p id="comparison-details"></p></div></section>
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
