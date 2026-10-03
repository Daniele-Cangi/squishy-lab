import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync,renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { evidenceContext } from './evidence';
import { COLLECTION } from '../src/collection';
const directory=resolve('evidence/collection');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1100},deviceScaleFactor:1,recordVideo:{dir:directory,size:{width:1366,height:1100}}});
const page=await context.newPage(),errors:string[]=[],captures:unknown[]=[],performanceSamples:unknown[]=[];
page.on('pageerror',e=>errors.push(e.message));
async function capture(name:string){
  await page.screenshot({path:resolve(directory,`${name}.png`)});
  captures.push({name,wallTime:Date.now(),snapshot:await page.evaluate(()=>{const s=window.__squishy!.snapshot() as Record<string,unknown>;return {...s,samples:undefined,renderer:undefined};})});
}
try{
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
  const rendering=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
  for(const c of COLLECTION.slice(1)){
    await page.getByRole('button',{name:c.name,exact:true}).click();await page.waitForTimeout(250);await capture(`${c.id}-rest`);
    await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2200);await capture(`${c.id}-held`);await page.evaluate(()=>window.__squishy!.release());await page.waitForTimeout(1800);await capture(`${c.id}-recovering`);
    const sample=await page.evaluate(()=>{const s=window.__squishy!.snapshot() as {appearance:unknown;samples:Record<string,number>[]};return {appearance:s.appearance,samples:s.samples.slice(-120)};});
    const stats=(key:string)=>{const values=sample.samples.map(v=>v[key]).sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};};
    performanceSamples.push({appearance:sample.appearance,count:sample.samples.length,frame:stats('frameMs'),solver:stats('solverMs'),surface:stats('surfaceMs'),renderCpu:stats('renderMs')});
    await page.getByRole('button',{name:'Ripristina forma'}).click();
  }
  await page.getByRole('button',{name:'Strawberry',exact:true}).click();await page.getByRole('button',{name:'✦ Glitter',exact:true}).click();await page.getByLabel('Con il viso').check();await page.waitForTimeout(350);await capture('printed-glitter-face');
  // Real pointer drag over the bar: no injected deformation or accelerated clock.
  const box=(await page.locator('#squishy').boundingBox())!;await page.mouse.move(box.x+box.width*.48,box.y+box.height*.44);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.move(box.x+box.width*.59,box.y+box.height*.52,{steps:20});await page.waitForTimeout(800);await capture('printed-glitter-drag');await page.mouse.up();await page.waitForTimeout(600);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Fragolina',exact:true}).click();await page.locator('#squishy').scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.screenshot({path:resolve(directory,'mobile.png'),fullPage:true});
  const video=page.video()!;await context.close();renameSync(await video.path(),resolve(directory,'collection.webm'));
  writeFileSync(resolve(directory,'collection.json'),JSON.stringify({...evidenceContext(),workingTree:execFileSync('git',['status','--short'],{encoding:'utf8'}),conditions:'Normal browser time, installed Chrome; each form rests, holds standard pressure for 2.2s and recovers for 1.8s. Snapshots record actual achieved physics time. Glitter bar also uses a real pointer drag. No remote AI calls.',rendering,errors,captures,performanceSamples},null,2));
  console.log(JSON.stringify({directory,errors,captures:captures.length,rendering,performanceSamples},null,2));
}finally{await browser.close();}
