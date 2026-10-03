import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync,renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { evidenceContext } from './evidence';

const directory=resolve('evidence/shape-refinement');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1100},deviceScaleFactor:1,recordVideo:{dir:directory,size:{width:1366,height:1100}}});
const page=await context.newPage(),errors:string[]=[],captures:unknown[]=[],comparisons:unknown[]=[];
page.on('pageerror',e=>errors.push(e.message));
type Snapshot={physicsTime:number;contactDepthUnits:number;maxDisplacement:number;minVolumeRatio:number;contact:{sustain:number}|null};
async function capture(name:string){
  await page.locator('#squishy').screenshot({path:resolve(directory,`${name}.png`)});
  const snapshot=await page.evaluate(()=>{const s=window.__squishy!.snapshot() as Snapshot&Record<string,unknown>;return {...s,samples:undefined,renderer:undefined};});
  captures.push({name,wallTime:Date.now(),snapshot});return snapshot;
}
try{
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
  const rendering=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
  for(const name of ['Mochi','Banana','Peanut']){
    const id=name.toLowerCase();await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'Ripristina forma'}).click();await page.waitForTimeout(250);
    const rest=await capture(`${id}-rest`);await page.screenshot({path:resolve(directory,`${id}-interface.png`)});
    const box=(await page.locator('#squishy').boundingBox())!;await page.mouse.move(box.x+box.width*.5,box.y+box.height*.48);await page.mouse.down();
    await page.waitForFunction(time=>(window.__squishy!.snapshot() as Snapshot).physicsTime>=time,rest.physicsTime+1);const short=await capture(`${id}-short`);assert(short.contact&&short.contactDepthUnits>.015);
    await page.waitForFunction(time=>(window.__squishy!.snapshot() as Snapshot).physicsTime>=time,rest.physicsTime+6.5);const long=await capture(`${id}-long`);assert.equal(long.contact?.sustain,1);assert(long.contactDepthUnits>short.contactDepthUnits*1.35);assert(long.minVolumeRatio>.17);
    await page.mouse.up();await page.waitForTimeout(2500);const recovered=await capture(`${id}-recovering`);assert.equal(recovered.contact,null);assert(recovered.maxDisplacement<long.maxDisplacement);
    comparisons.push({shape:id,shortPhysicsAge:short.physicsTime-rest.physicsTime,longPhysicsAge:long.physicsTime-rest.physicsTime,shortDepth:short.contactDepthUnits,longDepth:long.contactDepthUnits,depthRatio:long.contactDepthUnits/short.contactDepthUnits,heldMaxDisplacement:long.maxDisplacement,recoveringMaxDisplacement:recovered.maxDisplacement,minimumHeldTetRatio:long.minVolumeRatio});
  }
  await page.getByRole('button',{name:'Banana',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.locator('#squishy').scrollIntoViewIfNeeded();await page.waitForTimeout(250);await capture('banana-mobile');await page.screenshot({path:resolve(directory,'mobile-interface.png'),fullPage:true});
  assert.deepEqual(errors,[]);const video=page.video()!;await context.close();renameSync(await video.path(),resolve(directory,'shape-refinement.webm'));
  writeFileSync(resolve(directory,'shape-refinement.json'),JSON.stringify({...evidenceContext(),workingTree:execFileSync('git',['status','--short'],{encoding:'utf8'}),conditions:'Installed Chrome, hardware WebGL, normal animation time. Real stationary mouse contact at canvas (50%, 48%), held for at least 6.5 actual physics seconds, then released for 2.5 wall seconds. Captures record actual achieved times and rendered contact-axis depth. No injected deformation, accelerated clock, concurrent tests or remote AI calls. Old collection evidence is retained.',rendering,errors,captures,comparisons},null,2));
  console.log(JSON.stringify({directory,errors,rendering,comparisons},null,2));
}finally{await context.close();await browser.close();}
