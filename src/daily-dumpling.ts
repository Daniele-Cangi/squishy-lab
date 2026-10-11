import { FACE_EXPRESSIONS, type Appearance } from './collection.ts';

export const DAILY_KEY='squishy-daily-dumpling-v1';
export const DAY_MS=86400000;
export const DUMPLING_COLORS=[
  {name:'Vanilla cloud',color:'#f5dfb6'}, {name:'Strawberry milk',color:'#f0a9c5'},
  {name:'Lavender dream',color:'#baabed'}, {name:'Blue bubble',color:'#91cde5'},
  {name:'Mint hug',color:'#a9dbb6'}, {name:'Peach sunshine',color:'#f4bd91'},
];
export interface DailyDumpling {version:1;openedAt:number;colorIndex:number;expressionIndex:number;glitter:boolean}
export function readDumpling(raw:string|null):DailyDumpling|null {
  try {
    const v=JSON.parse(raw??'null') as DailyDumpling|null;
    if(!v||v.version!==1||!Number.isSafeInteger(v.openedAt)||v.openedAt<0||typeof v.glitter!=='boolean'||
      !Number.isInteger(v.colorIndex)||v.colorIndex<0||v.colorIndex>=DUMPLING_COLORS.length||
      !Number.isInteger(v.expressionIndex)||v.expressionIndex<0||v.expressionIndex>=FACE_EXPRESSIONS.length)return null;
    return {version:1,openedAt:v.openedAt,colorIndex:v.colorIndex,expressionIndex:v.expressionIndex,glitter:v.glitter};
  }catch{return null;}
}
export function nextOpening(reward:DailyDumpling|null){return reward?reward.openedAt+DAY_MS:0;}
export function drawDumpling(now:number,random:()=>number):DailyDumpling {
  return {version:1,openedAt:now,colorIndex:Math.floor(random()*DUMPLING_COLORS.length),expressionIndex:Math.floor(random()*FACE_EXPRESSIONS.length),glitter:random()<.15};
}
export function dumplingAppearance(reward:DailyDumpling):Appearance {
  return {shape:'dumpling',label:'none',face:true,expression:FACE_EXPRESSIONS[reward.expressionIndex],effect:reward.glitter?'glitter':'foam'};
}
// Browser persistence matches the visitor sticker: no account or server identity.
// Writing before revealing prevents refreshing the page from drawing again.
export function claimDumpling(storage:Pick<Storage,'getItem'|'setItem'>,now:number,random:()=>number){
  const previous=readDumpling(storage.getItem(DAILY_KEY));
  if(previous&&now<nextOpening(previous))return {reward:previous,fresh:false};
  const reward=drawDumpling(now,random);storage.setItem(DAILY_KEY,JSON.stringify(reward));
  return {reward,fresh:true};
}

export const dailyMarkup=`<section class="daily-dumpling" aria-labelledby="daily-heading">
  <div class="daily-art" aria-hidden="true"><svg viewBox="0 0 220 150">
    <ellipse cx="110" cy="137" rx="83" ry="9" fill="#d8c5aa" opacity=".5"/>
    <g id="daily-prize" visibility="hidden"><path id="daily-prize-body" d="M58 94C53 60 74 48 92 39Q110 17 128 39C148 48 167 60 162 94Q111 115 58 94" fill="#f5dfb6" stroke="#9c775b" stroke-width="2"/><g fill="none" stroke="#ad8869" stroke-width="2" stroke-linecap="round"><path d="M110 32Q90 42 85 68M110 32Q104 48 102 67M110 32Q122 46 123 68M112 33Q140 46 141 70"/></g><g id="daily-prize-face" stroke="#47334e" stroke-width="2.5" stroke-linecap="round" fill="none"></g><g id="daily-prize-glitter" visibility="hidden" fill="#fff8d2"><path d="m72 58 2 5 5 2-5 2-2 5-2-5-5-2 5-2zm77 16 2 5 5 2-5 2-2 5-2-5-5-2 5-2zm-31-31 2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><circle cx="94" cy="52" r="2"/><circle cx="135" cy="92" r="2"/></g></g>
    <path d="M30 102V124Q110 155 190 124V102" fill="#c39760" stroke="#8d6541" stroke-width="2"/><ellipse cx="110" cy="102" rx="80" ry="23" fill="none" stroke="#e8bc80" stroke-width="7"/>
    <g stroke="#a77849" stroke-width="2"><path d="M47 113v16m18-11v18m18-13v17m18-16v18m18-18v18m18-19v17m18-22v18m18-24v16"/></g>
    <g class="steamer-lid"><path d="M28 80v18Q110 126 192 98V80" fill="#d9ab70" stroke="#8d6541" stroke-width="2"/><ellipse cx="110" cy="80" rx="82" ry="24" fill="#efcd97" stroke="#8d6541" stroke-width="2"/><ellipse cx="110" cy="80" rx="69" ry="17" fill="none" stroke="#bf945e" stroke-width="2"/><path d="m57 74 103 15m-92-23 105 16m-95-21 97 14m-100 18 55-32m-30 36 60-34m-31 36 61-33" stroke="#c79e69" stroke-width="3"/><path d="M97 77v-8q13-12 26 0v8" fill="none" stroke="#916745" stroke-width="4" stroke-linecap="round"/></g>
  </svg></div><div class="daily-copy"><span class="daily-kicker">A LITTLE DAILY SURPRISE</span><h2 id="daily-heading">Your daily dumpling 🥟</h2><p id="daily-description">Lift the lid. Find a color, a mood… maybe a little sparkle.</p><p class="daily-odds">One free opening every 24 hours · 15% glitter chance</p></div>
  <div class="daily-actions"><button id="daily-open" type="button" class="secondary">Open my steamer ✨</button><button id="daily-play" type="button" class="text-button" hidden>Squish my dumpling ↗</button><p id="daily-status" role="status" aria-live="polite"></p></div>
</section>`;

export function setupDailyDumpling(onPlay:(reward:DailyDumpling)=>void){
  const el=(id:string)=>document.getElementById(id)!;
  const open=el('daily-open') as HTMLButtonElement,play=el('daily-play') as HTMLButtonElement;
  const card=document.querySelector<HTMLElement>('.daily-dumpling')!;
  let reward:DailyDumpling|null=null,busy=false,available=true;
  const refresh=()=>{
    try{reward=readDumpling(localStorage.getItem(DAILY_KEY));}catch{available=false;}
    const remaining=nextOpening(reward)-Date.now(),locked=remaining>0,minutes=Math.ceil(Math.max(0,remaining)/60000);
    open.disabled=busy||locked||!available;
    open.textContent=locked?'Tomorrow’s surprise is resting':'Open my steamer ✨';
    play.hidden=!reward;play.disabled=busy;
    card.classList.toggle('is-open',locked);
    el('daily-prize').setAttribute('visibility',locked?'visible':'hidden');
    if(reward){
      const color=DUMPLING_COLORS[reward.colorIndex],mood=FACE_EXPRESSIONS[reward.expressionIndex];
      el('daily-prize-body').setAttribute('fill',color.color);
      el('daily-prize-glitter').setAttribute('visibility',reward.glitter?'visible':'hidden');
      const eyes=mood==='happy'?'<path d="M88 80q4-6 8 0m28 0q4-6 8 0"/>':mood==='sleepy'?'<path d="M88 78q4 6 8 0m28 0q4 6 8 0"/>':mood==='wink'?'<circle cx="92" cy="80" r="2" fill="#47334e"/><path d="M124 80q4-6 8 0"/>':'<circle cx="92" cy="80" r="2" fill="#47334e"/><circle cx="128" cy="80" r="2" fill="#47334e"/>';
      el('daily-prize-face').innerHTML=eyes+(mood==='surprised'?'<ellipse cx="110" cy="91" rx="3" ry="4"/>':mood==='sleepy'?'<path d="M106 92h8"/>':'<path d="M104 89q6 9 12 0"/>');
      el('daily-description').textContent=`${reward.glitter?'✨ Glitter surprise! ':''}${color.name} · ${mood} face. Ready for a squeeze.`;
    }else el('daily-description').textContent='Lift the lid. Find a color, a mood… maybe a little sparkle.';
    el('daily-status').textContent=!available?'Enable browser storage to save your daily surprise.':locked?`Next opening in ${Math.floor(minutes/60)}h ${minutes%60}m`:'Your steamer is ready!';
  };
  open.onclick=async()=>{
    if(busy)return;busy=true;open.disabled=true;
    try{
      const claim=()=>claimDumpling(localStorage,Date.now(),()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
      // Serialize claims from multiple tabs where Web Locks is available.
      const result=navigator.locks?await navigator.locks.request(DAILY_KEY,claim):claim();
      refresh();
      if(result.fresh){
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,850));
        onPlay(result.reward);
      }
    }catch{available=false;}finally{busy=false;refresh();}
  };
  play.onclick=()=>{if(reward)onPlay(reward);};
  window.addEventListener('storage',event=>{if(event.key===DAILY_KEY||event.key===null)refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(refresh,60000);refresh();
}
