import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
// Gesture assertions use geometry, not pixel fidelity. Reduce software GPU
// rasterization cost while keeping the same CSS viewport and raycast coordinates.
test.use({deviceScaleFactor:.75});
type State={maxDisplacement:number;contactDepthUnits:number;safetyBackoffs:number;minVolumeRatio:number;contact:unknown};
for(const name of ['Chocolate','Glazed Donut'])test(`${name}: sustained mouse hold, recovery and exact reset`,async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-06T00:00:00Z')});await page.goto('/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);await page.clock.pauseAt(new Date('2026-10-06T01:00:00Z'));
 await page.getByRole('button',{name,exact:true}).click();const box=(await page.locator('#squishy').boundingBox())!,snapshot=async()=>await page.evaluate(()=>window.__squishy!.snapshot()) as State;
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*(name==='Chocolate'?.48:.64));await page.mouse.down();await page.clock.runFor(1000);const short=await snapshot();expect(short.contact).not.toBeNull();expect(short.contactDepthUnits).toBeGreaterThan(.03);
 await page.clock.runFor(5500);const held=await snapshot();expect(held.contactDepthUnits).toBeGreaterThan(short.contactDepthUnits*1.35);expect(held.safetyBackoffs).toBe(0);expect(held.minVolumeRatio).toBeGreaterThan(.17);
 mkdirSync('work/low-shapes',{recursive:true});await page.locator('#squishy').screenshot({path:`work/low-shapes/${name==='Chocolate'?'chocolate':'donut'}-held.png`});
 // Full 12-second recovery is checked in low-shapes.test.ts. Here verify
 // pointer release and visible recovery, then the exact user-facing reset.
 await page.mouse.up();await page.clock.runFor(3000);const released=await snapshot();expect(released.contact).toBeNull();expect(released.maxDisplacement).toBeLessThan(held.maxDisplacement*.5);expect(released.safetyBackoffs).toBe(0);
 await page.getByRole('button',{name:'Reset shape',exact:true}).click();expect((await snapshot()).maxDisplacement).toBe(0);expect(errors).toEqual([]);
});
// Drain the software renderer's queued work before starting the next fixture.
test.afterEach(async({page})=>{
 if(!page.isClosed())await page.evaluate(()=>document.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
});
test('low shapes: touch hold and release in mobile Chrome emulation',async({browser})=>{
 test.setTimeout(90000);const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),cdp=await context.newCDPSession(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto('/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
 for(const name of ['Chocolate','Glazed Donut']){
 await page.getByRole('button',{name,exact:true}).click();await page.locator('#squishy').scrollIntoViewIfNeeded();const box=(await page.locator('#squishy').boundingBox())!,x=box.x+box.width*.5,y=box.y+box.height*(name==='Chocolate'?.48:.64);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:10,radiusY:10,force:1}]});await page.waitForTimeout(2200);const held=await page.evaluate(()=>window.__squishy!.snapshot()) as State;expect(held.contact).not.toBeNull();expect(held.contactDepthUnits).toBeGreaterThan(.03);expect(held.safetyBackoffs).toBe(0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1800);const released=await page.evaluate(()=>window.__squishy!.snapshot()) as State;expect(released.contact).toBeNull();expect(released.maxDisplacement).toBeLessThan(held.maxDisplacement);await page.getByRole('button',{name:'Reset shape',exact:true}).click();
 }
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 }finally{await context.close();}
});
