import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {evidenceContext} from './evidence';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});const page=await browser.newPage({viewport:{width:1366,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const directory='evidence/collection-next';mkdirSync(directory,{recursive:true});
try{
 await page.goto((process.argv[2]??'http://127.0.0.1:5173')+'/?evidence');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
 const captures=[];const context=evidenceContext();
 for(const [name,id] of [['Jelly Drop','drop'],['Sugar Drop','gumdrop'],['Kitty Paw','paw'],['Sleepy Capybara','capybara'],['Glazed Donut','donut']]){
  await page.getByRole('button',{name,exact:true}).click();await page.locator('#squishy').screenshot({path:`${directory}/${id}-rest.png`});
  const rest=await page.evaluate(()=>window.__squishy!.snapshot());
  await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2200);const held=await page.evaluate(()=>window.__squishy!.snapshot());await page.locator('#squishy').screenshot({path:`${directory}/${id}-held.png`});await page.evaluate(()=>window.__squishy!.release());await page.waitForTimeout(1800);const recovered=await page.evaluate(()=>window.__squishy!.snapshot());
  await page.getByRole('button',{name:'Reset shape',exact:true}).click();
  captures.push({id,rest,held,recovered});
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${directory}/mobile.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);expect(errors).toEqual([]);
 writeFileSync(`${directory}/captures.json`,JSON.stringify({...context,conditions:'Installed headless Chrome, normal wall time, desktop GPU. Emulated 390px mobile layout. No AI requests.',errors,captures},null,2));console.log('Five models captured at rest and held, with recovery snapshots.');
}finally{await browser.close();}
