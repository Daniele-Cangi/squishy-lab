// Native fullscreen where available; a viewport-sized playground on mobile
// browsers that cannot fullscreen arbitrary elements (including older iPhones).
export function setupFullscreen(area:HTMLElement,button:HTMLButtonElement,onRelease:()=>void){
  let expanded=false,native=false;const inertStates=new Map<HTMLElement,boolean>();let overflow='';const enterIcon=button.innerHTML;
  function close(){
    if(!expanded)return;expanded=false;onRelease();area.classList.remove('is-expanded');area.removeAttribute('role');area.removeAttribute('aria-modal');document.body.style.overflow=overflow;
    for(const [element,value]of inertStates)element.inert=value;inertStates.clear();
    button.innerHTML=enterIcon;button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Enter fullscreen');button.title='Enter fullscreen';button.focus({preventScroll:true});
    if(document.fullscreenElement===area)void document.exitFullscreen().catch(()=>{});
  }
  button.onclick=()=>{
    if(expanded){close();return;}expanded=true;onRelease();delete document.body.dataset.composing;overflow=document.body.style.overflow;document.body.style.overflow='hidden';area.classList.add('is-expanded');area.setAttribute('role','dialog');area.setAttribute('aria-modal','true');
    for(let node:HTMLElement|null=area;node?.parentElement;node=node.parentElement)for(const sibling of node.parentElement.children)if(sibling!==node&&sibling instanceof HTMLElement){inertStates.set(sibling,sibling.inert);sibling.inert=true;}
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';button.setAttribute('aria-expanded','true');button.setAttribute('aria-label','Exit fullscreen');button.title='Exit fullscreen';button.focus({preventScroll:true});
    if(area.requestFullscreen)void area.requestFullscreen().then(()=>{if(!expanded&&document.fullscreenElement===area)void document.exitFullscreen().catch(()=>{});}).catch(()=>{/* Viewport fallback remains active. */});
  };
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===area)native=true;else if(native){native=false;close();}});
  document.addEventListener('keydown',event=>{
    if(!expanded)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
    if(event.key==='Tab'){
      const targets=Array.from(area.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),canvas[tabindex]')).filter(element=>element.getClientRects().length);
      const first=targets[0],last=targets.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  },true);
}

