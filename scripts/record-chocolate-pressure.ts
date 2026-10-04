import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {strict as assert} from 'node:assert';
import {evidenceContext} from './evidence';
const directory=resolve('evidence/chocolate-pressure');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1000},deviceScaleFactor:1});
const page=await context.newPage(),errors:string[]=[],captures:unknown[]=[];
page.on('pageerror',e=>errors.push(e.message));
type Snapshot={appearance:{shape:string};physicsTime:number;contactDepthUnits:number;maxDisplacement:number;minVolumeRatio:number;safetyBackoffs:number;contact:{normal:number[];sustain:number}|null};
async function snapshot(){return await page.evaluate(()=>{const s=window.__squishy!.snapshot() as Snapshot&Record<string,unknown>;return {...s,samples:undefined,renderer:undefined};});}
async function capture(name:string){await page.locator('#squishy').screenshot({path:resolve(directory,`${name}.png`)});const s=await snapshot();captures.push({name,snapshot:s});return s;}
try{
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
 await page.getByRole('button',{name:'Cioccolato',exact:true}).click();assert.equal((await snapshot()).appearance.shape,'chocolate');
 await page.locator('#squishy').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
 const rendering=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
 const rest=await capture('rest'),box=(await page.locator('#squishy').boundingBox())!;
 // Real input at the upper surface near the center of the bar.
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.48);await page.mouse.down();
 const contact=(await snapshot()).contact;assert(contact&&contact.normal[1]>.8,`Expected upper contact, got ${JSON.stringify(contact)}`);
 await page.waitForFunction(t=>(window.__squishy!.snapshot() as Snapshot).physicsTime>=t,rest.physicsTime+1);const short=await capture('short');assert(short.contactDepthUnits>.03);
 await page.waitForFunction(t=>(window.__squishy!.snapshot() as Snapshot).physicsTime>=t,rest.physicsTime+6.5);const long=await capture('long');assert.equal(long.contact?.sustain,1);assert(long.contactDepthUnits>short.contactDepthUnits*1.35);assert(long.minVolumeRatio>.17);assert.equal(long.safetyBackoffs,0);
 await page.mouse.up();await page.waitForTimeout(2500);const recovery=await capture('recovering');assert.equal(recovery.contact,null);assert(recovery.maxDisplacement<long.maxDisplacement);
 assert.deepEqual(errors,[]);writeFileSync(resolve(directory,'browser.json'),JSON.stringify({...evidenceContext(),conditions:'Installed Chrome, normal animation time, real stationary mouse on upper surface (50%, 48%) for at least 6.5 physics seconds. Snapshot times include screenshot time. Local demo; no remote AI calls.',rendering,errors,captures},null,2));console.log(JSON.stringify({rendering,short,long,recovery}));
}finally{await context.close();await browser.close();}
