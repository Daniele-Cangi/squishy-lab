import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { evidenceContext } from './evidence';

const before=process.argv.includes('--before'),directory=resolve(before?'work/style-before':'evidence/playful-interface');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1000},deviceScaleFactor:1});
const page=await context.newPage(),errors:string[]=[],captures:unknown[]=[];
page.on('pageerror',error=>errors.push(error.message));
async function capture(name:string,fullPage=true){
  await page.screenshot({path:resolve(directory,`${name}.png`),fullPage});
  const layout=await page.evaluate(()=>{const snapshot=window.__squishy!.snapshot() as Record<string,unknown>;return {viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,composing:document.body.dataset.composing,canvas:[document.querySelector('canvas')!.clientWidth,document.querySelector('canvas')!.clientHeight],title:document.title,themeColor:document.querySelector('meta[name="theme-color"]')!.getAttribute('content'),mode:document.querySelector('#mode-badge')!.textContent,snapshot:{...snapshot,samples:undefined,renderer:undefined}};});
  assert.equal(layout.documentWidth,layout.viewport[0]);captures.push({name,layout});
}
try{
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);await page.waitForTimeout(350);
  const rendering=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!,extension=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable',dpr:devicePixelRatio};});
  await capture('desktop');
  if(!before){
    await page.getByRole('button',{name:'Banana',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(250);await capture('banana');
    await page.getByRole('button',{name:'Peanut',exact:true}).click();await page.getByRole('button',{name:'✦ Glitter',exact:true}).click();await page.getByLabel('Show face').check();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(250);await capture('peanut-glitter');
    await page.getByRole('button',{name:'Jelly cube',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(250);await capture('jelly');
    await page.getByRole('button',{name:'Mochi',exact:true}).click();
    await page.setViewportSize({width:960,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await capture('tablet');
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await capture('mobile');await capture('mobile-fold',false);
  if(!before){
    await page.setViewportSize({width:320,height:740});await page.waitForTimeout(150);await capture('mobile-narrow');
    await page.setViewportSize({width:390,height:504});await page.getByRole('textbox').focus();await page.waitForTimeout(200);await capture('mobile-composing',false);
  }
  assert.deepEqual(errors,[]);const documentHashes=Object.fromEntries(['index.html','public/favicon.svg'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
  writeFileSync(resolve(directory,'interface.json'),JSON.stringify({...evidenceContext(),documentHashes,rendering,conditions:'Installed Chrome, normal browser time, local demo. No remote AI calls. Desktop, tablet, mobile and composer focus captures; no overflow at captured widths.',errors,captures},null,2));console.log(JSON.stringify({directory,errors,captures:captures.map(c=>(c as {name:string}).name)}));
}finally{await context.close();await browser.close();}
