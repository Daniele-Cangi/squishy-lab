import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, renameSync,existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { evidenceContext } from './evidence';

const label=process.argv.includes('--baseline')?'baseline-b169dc8':'refined';
const directory=resolve('evidence',label);mkdirSync(directory,{recursive:true});
if(label.startsWith('baseline')&&existsSync(resolve(directory,'experience.json')))throw new Error('The baseline recording is immutable.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const context=await browser.newContext({viewport:{width:1366,height:1000},deviceScaleFactor:1,recordVideo:{dir:directory,size:{width:1366,height:1000}}});
const page=await context.newPage(),errors:string[]=[],samples:unknown[]=[];
page.on('pageerror',e=>errors.push(e.message));
const capture=async(name:string)=>{
  await page.screenshot({path:resolve(directory,`${name}.png`)});
  samples.push({name,wallTimeMs:Date.now(),snapshot:await page.evaluate(()=>window.__squishy!.snapshot())});
};
try {
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy);
  await capture('rest');await page.evaluate(()=>window.__squishy!.press());
  await page.waitForTimeout(250);await capture('light');await page.waitForTimeout(1500);await capture('held');
  await page.evaluate(()=>window.__squishy!.release());await page.waitForTimeout(450);await capture('released');
  await page.waitForTimeout(2000);await capture('recovering');await page.waitForTimeout(3000);
  await page.getByRole('button',{name:'Reset shape'}).click();
  const box=(await page.locator('#squishy').boundingBox())!;
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.49);await page.mouse.down();await page.waitForTimeout(400);
  await page.mouse.move(box.x+box.width*.59,box.y+box.height*.56,{steps:20});await page.waitForTimeout(700);await capture('drag');
  await page.mouse.up();await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'Peach mochi Foam · a little firmer'}).click();await page.getByRole('button',{name:'Reset shape'}).click();
  await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(1800);await capture('firm');await page.evaluate(()=>window.__squishy!.release());await page.waitForTimeout(1600);
  const video=page.video()!;
  const rendering=await page.evaluate(()=>{
    const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {browser:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};
  });
  await context.close();renameSync(await video.path(),resolve(directory,'experience.webm'));
  writeFileSync(resolve(directory,'experience.json'),JSON.stringify({...evidenceContext(),label,workingTree:execFileSync('git',['status','--short'],{encoding:'utf8'}),rendering,conditions:'Normal browser time; same press/release waits, pointer drag, then firm preset. Snapshot physicsTime identifies achieved simulation time. Standard contact location changed in v2; compare baseline visually, not as identical force-location measurements.',errors,samples},null,2));
  console.log({directory,errors,captures:samples.length,rendering});
}finally{await browser.close();}
