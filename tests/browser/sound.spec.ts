import {test,expect} from '@playwright/test';
test('opt-in real Web Audio responds to every shape, mutes immediately and remains usable in fullscreen',async({page})=>{
 let recordings=0;page.on('request',request=>{if(request.url().match(/\/audio\/(gel|crinkle)\.mp3$/))recordings++;});
 await page.addInitScript(()=>{
  const probe={contexts:0,sources:0,peak:0,state:''};(window as unknown as {__audioProbe:typeof probe}).__audioProbe=probe;
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
   constructor(options?:AudioContextOptions){super(options);probe.contexts++;const analyser=this.createAnalyser(),samples=new Float32Array(analyser.fftSize);const connect=AudioNode.prototype.connect as (this:AudioNode,destination:AudioNode)=>AudioNode;
    const originalGain=this.createGain.bind(this);this.createGain=()=>{const gain=originalGain();gain.connect=((destination:AudioNode)=>{if(destination===this.destination)connect.call(gain,analyser);return connect.call(gain,destination);}) as typeof gain.connect;return gain;};
    const originalSource=this.createBufferSource.bind(this);this.createBufferSource=()=>{probe.sources++;return originalSource();};
    const sample=()=>{analyser.getFloatTimeDomainData(samples);probe.peak=Math.max(probe.peak,...samples.map(Math.abs));probe.state=this.state;requestAnimationFrame(sample);};requestAnimationFrame(sample);
   }
  };
 });
 const probe=()=>page.evaluate(()=>(window as unknown as {__audioProbe:{contexts:number;sources:number;peak:number;state:string}}).__audioProbe);
 await page.goto('/');await page.waitForFunction(()=>!!window.__squishy);await page.getByRole('button',{name:'Disable squishy sound'}).click();await expect(page.getByRole('button',{name:'Enable squishy sound'})).toHaveAttribute('aria-pressed','false');await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(300);await page.evaluate(()=>window.__squishy!.release());expect((await probe()).contexts).toBe(0);expect(recordings).toBe(0);
 await page.getByRole('button',{name:'Enable squishy sound'}).click();await expect(page.getByRole('button',{name:'Disable squishy sound'})).toHaveAttribute('aria-pressed','true');
 expect(recordings).toBe(1);
 for(const name of ['Mochi','Butter','Strawberry','Strawberry face','Jelly cube','Chocolate','Banana','Cat','Cheese','Peanut']){await page.getByRole('button',{name,exact:true}).click();const count=(await probe()).sources;await page.evaluate(()=>window.__squishy!.press());await expect.poll(async()=>(await probe()).sources).toBeGreaterThan(count);await page.evaluate(()=>window.__squishy!.release());}
 await page.getByLabel('Sound texture').click();await expect(page.getByRole('button',{name:'Disable squishy sound'})).toBeEnabled();expect(recordings).toBe(2);await page.getByLabel('Sound texture').click();await expect(page.getByRole('button',{name:'Disable squishy sound'})).toBeEnabled();
 expect((await probe()).peak).toBeGreaterThan(.0001);await page.getByRole('button',{name:'Disable squishy sound'}).click();await expect.poll(async()=>(await probe()).state).toBe('suspended');const count=(await probe()).sources;await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(300);expect((await probe()).sources).toBe(count);await page.evaluate(()=>window.__squishy!.release());
 await page.setViewportSize({width:320,height:740});await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.getByRole('button',{name:'Enable squishy sound'}).click();await expect(page.getByRole('button',{name:'Disable squishy sound'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);await page.getByRole('button',{name:'Disable squishy sound'}).click();await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();expect(recordings).toBe(2);await page.reload();await expect(page.getByRole('button',{name:'Disable squishy sound'})).toHaveAttribute('aria-pressed','true');
});



