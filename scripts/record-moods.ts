import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {strict as assert} from 'node:assert';
import {evidenceContext} from './evidence';
const directory=resolve('evidence/english-moods');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1000},deviceScaleFactor:1}),page=await context.newPage();const errors:string[]=[],captures:unknown[]=[];page.on('pageerror',e=>errors.push(e.message));
async function capture(name:string,fullPage=false){await(fullPage?page:page.locator('#squishy')).screenshot({path:resolve(directory,name+'.png'),...(fullPage?{fullPage:true}:{})});const s=await page.evaluate(()=>{const s=window.__squishy!.snapshot() as Record<string,unknown>;return {viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,language:document.documentElement.lang,snapshot:{...s,samples:undefined,renderer:undefined}};});assert.equal(s.documentWidth,s.viewport[0]);assert.equal(s.language,'en');captures.push({name,...s});}
try{
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
 const rendering=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'};});
 await page.getByRole('button',{name:'Mochi',exact:true}).click();await capture('desktop',true);
 for(const mood of ['Smile','Happy','Sleepy','Wink','Surprised']){await page.getByRole('button',{name:mood+' face',exact:true}).click();await page.waitForTimeout(100);await capture('mochi-'+mood.toLowerCase());}
 await page.getByRole('button',{name:'Cat',exact:true}).click();await page.getByRole('button',{name:'Wink face',exact:true}).click();await capture('cat-wink');
 await page.getByRole('button',{name:'Strawberry face',exact:true}).click();await page.getByRole('button',{name:'Happy face',exact:true}).click();await capture('strawberry-happy');
 await page.getByRole('button',{name:'Jelly cube',exact:true}).click();await page.waitForTimeout(250);await capture('clear-tray');
 await page.getByRole('button',{name:'Mochi',exact:true}).click();await page.getByRole('button',{name:'Clear ✦',exact:true}).click();await page.waitForTimeout(250);await capture('clear-mochi');
 await page.getByRole('button',{name:'Soft touch',exact:true}).click();await page.setViewportSize({width:390,height:844});await capture('mobile',true);await page.setViewportSize({width:320,height:740});await capture('mobile-narrow',true);
 assert.deepEqual(errors,[]);writeFileSync(resolve(directory,'moods.json'),JSON.stringify({...evidenceContext(),conditions:'Installed Chrome, hardware WebGL, normal time, real UI controls on local demo. No remote inference or concurrent browser tests. Mobile viewport emulation.',rendering,errors,captures},null,2));console.log(JSON.stringify({directory,errors,captures:captures.length}));
}finally{await context.close();await browser.close();}
