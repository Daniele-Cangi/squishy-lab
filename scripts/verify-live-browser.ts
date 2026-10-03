import { chromium,expect } from '@playwright/test';
import { mkdirSync,writeFileSync,renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { evidenceContext } from './evidence';
import type { SquishySpec } from '../src/shared/spec';
const directory=resolve('evidence/refined');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1080},recordVideo:{dir:resolve('work/live-recordings'),size:{width:1366,height:1080}}});
const page=await context.newPage(),errors:string[]=[],responses:unknown[]=[],samples:unknown[]=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',async response=>{if(response.url().endsWith('/api/squishy'))responses.push({status:response.status(),body:await response.json()});});
const snapshot=()=>page.evaluate(()=>window.__squishy!.snapshot() as {spec:SquishySpec;renderedSurfaceDepthUnits:number;internalCageDepthUnits:number;physicsTime:number;safetyBackoffs:number});
const pressSample=(phase:'before'|'after')=>page.evaluate(`new Promise(resolve=>{
  // Sample in the browser on the first matching rendered frame, independent of
  // test-runner polling delays. The video itself continues at normal speed.
  const tick=()=>{const s=window.__squishy.snapshot();
    if(document.querySelector('#comparison-row').dataset.phase===${JSON.stringify(phase)}&&s.physicsTime>=1.5)resolve(s);else requestAnimationFrame(tick);
  };tick();
})`);
try{
  await page.goto('http://127.0.0.1:5174/');await expect(page.locator('#mode-badge')).toHaveText('AI remota · test locale');
  const before=await snapshot();
  await page.getByRole('textbox').fill('Uguale, ma meno molle.');await page.locator('#generate').click();
  await expect(page.locator('#comparison-row')).toBeVisible({timeout:25000});
  const edited=await snapshot();expect(edited.spec.color).toBe(before.spec.color);expect(edited.spec.softness).toBeLessThan(before.spec.softness);expect(edited.spec.recoverySeconds).toBe(before.spec.recoverySeconds);
  await page.locator('#compare').click();await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','before');
  samples.push({phase:'before',snapshot:await pressSample('before')});await page.screenshot({path:resolve(directory,'ai-live-before.png')});
  await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','after',{timeout:10000});
  samples.push({phase:'after',snapshot:await pressSample('after')});await page.screenshot({path:resolve(directory,'ai-live-after.png')});
  await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','ready',{timeout:10000});
  expect((await snapshot()).spec).toEqual(edited.spec);
  const a=(samples[0] as {snapshot:{renderedSurfaceDepthUnits:number}}).snapshot.renderedSurfaceDepthUnits,b=(samples[1] as {snapshot:{renderedSurfaceDepthUnits:number}}).snapshot.renderedSurfaceDepthUnits;expect(a).toBeGreaterThan(b*1.1);
  await page.getByRole('textbox').fill('Non cambiare colore: fallo riprendere più velocemente.');await page.locator('#generate').click();
  await expect.poll(async()=>(await snapshot()).spec.recoverySeconds,{timeout:25000}).toBeLessThan(edited.spec.recoverySeconds);expect((await snapshot()).spec.color).toBe(edited.spec.color);
  await page.locator('#create-mode').click();await page.getByRole('textbox').fill('Fammi uno squalo blu.');await page.locator('#generate').click();
  await expect(page.locator('#status')).toContainText('non è disponibile',{timeout:25000});
  const report=await (await page.request.get('http://127.0.0.1:5174/api/evaluation-report')).json();
  const video=page.video()!;await context.close();renameSync(await video.path(),resolve(directory,'ai-live-browser.webm'));
  writeFileSync(resolve(directory,'ai-live-browser.json'),JSON.stringify({...evidenceContext(),conditions:'Real Workers AI REST inference through an opt-in loopback adapter; model identified in calls. Production Turnstile not exercised. Normal browser time; A/B uses identical geometry, color, camera and fixed-step gesture, reset between phases.',errors,responses,samples,report},null,2));
  console.log({realResponses:responses.length,errors,surfaceDepthBefore:a,surfaceDepthAfter:b,modelCalls:report.calls.length});
}finally{await browser.close();}
