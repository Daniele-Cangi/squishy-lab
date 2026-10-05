import {test,expect,type Page,type Route} from '@playwright/test';
import {readFile} from 'node:fs/promises';

type ProbeWindow=Window&{audioProbe:{sources:number;decodes:number};audioContext:AudioContext};
async function delayedAudio(page:Page,hasTouch:boolean){
 const pending:Route[]=[];
 await page.route(/\/audio\/(gel|crinkle)\.mp3$/,route=>{pending.push(route);});
 await page.addInitScript(()=>{
  const target=window as unknown as ProbeWindow;
  target.audioProbe={sources:0,decodes:0};
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
   constructor(){
    super();target.audioContext=this;
    const source=this.createBufferSource.bind(this),decode=this.decodeAudioData.bind(this);
    this.createBufferSource=()=>{target.audioProbe.sources++;return source();};
    this.decodeAudioData=async buffer=>{const recording=await decode(buffer);target.audioProbe.decodes++;return recording;};
   }
  };
 });
 await page.goto('/');await page.waitForFunction(()=>!!window.__squishy);
 const complete=async(index:number)=>{
  const route=pending[index],file=route.request().url().endsWith('/gel.mp3')?'gel.mp3':'crinkle.mp3';
  await route.fulfill({contentType:'audio/mpeg',body:await readFile(`public/audio/${file}`)});
 };
 const probe=()=>page.evaluate(()=>{const target=window as unknown as ProbeWindow;return {...target.audioProbe,state:target.audioContext?.state};});
 const settle=()=>page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const activate=(name:string)=>{const button=page.getByRole('button',{name,exact:true});return hasTouch?button.tap():button.click();};
 return {pending,complete,probe,settle,activate};
}

test('first squeeze and Test sound keep the toggle consistent while audio loads',async({page,hasTouch})=>{
 const audio=await delayedAudio(page,hasTouch);
 await audio.activate('Hold to squish');
 await expect.poll(()=>audio.pending.length).toBe(1);
 await audio.activate('Test sound');
 await expect.poll(()=>audio.pending.length).toBe(2);
 await audio.complete(0);await expect.poll(async()=>(await audio.probe()).decodes).toBe(1);await audio.settle();
 await audio.complete(1);await expect(page.locator('#status')).toContainText('Sound test playing');
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
 await expect.poll(async()=>(await audio.probe()).sources).toBeGreaterThan(0);
 await audio.activate('Disable squishy sound');
 await expect.poll(async()=>(await audio.probe()).state).toBe('suspended');
 const count=(await audio.probe()).sources;
 await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(300);
 expect((await audio.probe()).sources).toBe(count);
 await page.evaluate(()=>window.__squishy!.release());
});

test('muting a pending Test sound prevents its completion from resuming audio',async({page,hasTouch})=>{
 const audio=await delayedAudio(page,hasTouch);
 await audio.activate('Test sound');
 await expect.poll(()=>audio.pending.length).toBe(1);
 await audio.activate('Disable squishy sound');
 await expect.poll(async()=>(await audio.probe()).state).toBe('suspended');
 await audio.complete(0);await expect.poll(async()=>(await audio.probe()).decodes).toBe(1);await audio.settle();
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
 expect(await audio.probe()).toMatchObject({state:'suspended',sources:0});
 await expect(page.locator('#status')).not.toContainText('Sound test playing');
});

test('switching to Crunchy cancels an older pending Gel sound preview',async({page,hasTouch})=>{
 const audio=await delayedAudio(page,hasTouch);
 await audio.activate('Test sound');
 await expect.poll(()=>audio.pending.length).toBe(1);
 await audio.activate('Sound texture');await expect.poll(()=>audio.pending.length).toBe(2);
 expect(audio.pending[1].request().url()).toContain('/audio/crinkle.mp3');
 await audio.complete(1);await expect.poll(async()=>(await audio.probe()).decodes).toBe(1);await audio.settle();
 await audio.complete(0);await expect.poll(async()=>(await audio.probe()).decodes).toBe(2);await audio.settle();
 await expect(page.getByLabel('Sound texture')).toHaveText('Crunchy ↻');
 await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
 expect((await audio.probe()).sources).toBe(0);
 await page.evaluate(()=>window.__squishy!.press());
 await expect.poll(async()=>(await audio.probe()).sources).toBeGreaterThan(0);
 await page.evaluate(()=>window.__squishy!.release());
});
