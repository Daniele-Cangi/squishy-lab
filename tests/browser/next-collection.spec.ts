import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
for(const [name,shape] of [['Jelly Drop','drop'],['Sugar Drop','gumdrop'],['Kitty Paw','paw'],['Sleepy Capybara','capybara'],['Glazed Donut','donut']])test(`${name}: pressure, reset, finishes and emoji PNG`,async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-06T00:00:00Z')});await page.goto('/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
 await page.clock.pauseAt(new Date('2026-10-06T01:00:00Z'));await page.getByRole('button',{name,exact:true}).click();
 const snapshot=async()=>await page.evaluate(()=>window.__squishy!.snapshot()) as {appearance:{shape:string;text?:string};maxDisplacement:number;minVolumeRatio:number;contact:unknown;decorationVertices:number};
 expect((await snapshot()).appearance.shape).toBe(shape);await page.getByRole('button',{name:'Soft touch',exact:true}).click();
 await page.locator('#squishy').focus();await page.keyboard.down('Space');await page.clock.runFor(1700);const held=await snapshot();expect(held.maxDisplacement).toBeGreaterThan(.05);expect(held.minVolumeRatio).toBeGreaterThan(.17);
 await page.keyboard.up('Space');await page.clock.runFor(1700);expect((await snapshot()).maxDisplacement).toBeLessThan(held.maxDisplacement);expect((await snapshot()).contact).toBeNull();
 await page.getByRole('button',{name:'Reset shape',exact:true}).click();expect((await snapshot()).maxDisplacement).toBeLessThan(.001);
 await page.getByRole('button',{name:'Clear ✦',exact:true}).click();await page.clock.runFor(40);await page.getByRole('button',{name:'Happy face',exact:true}).click();
 await page.getByLabel('A little message').fill('Hi 😊');await expect.poll(async()=>(await snapshot()).appearance.text).toBe('Hi 😊');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG ↓',exact:true}).click();const download=await downloadPromise;const bytes=await readFile((await download.path())!);expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);expect(errors).toEqual([]);
});
test('donut hole does not capture a press; ring accepts mouse pressure and returns to Mochi',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);await page.getByRole('button',{name:'Glazed Donut',exact:true}).click();
 const box=(await page.locator('#squishy').boundingBox())!;await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.waitForTimeout(150);expect(((await page.evaluate(()=>window.__squishy!.snapshot())) as {contact:unknown}).contact).toBeNull();await page.mouse.up();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.64);await page.mouse.down();
 await expect.poll(async()=>((await page.evaluate(()=>window.__squishy!.snapshot())) as {contact:unknown}).contact).not.toBeNull();await page.mouse.up();
 await expect.poll(async()=>((await page.evaluate(()=>window.__squishy!.snapshot())) as {contact:unknown}).contact).toBeNull();
 await page.getByRole('button',{name:'Reset shape',exact:true}).click();await page.getByRole('button',{name:'Mochi',exact:true}).click();await expect(page.getByRole('button',{name:'Mochi',exact:true})).toHaveAttribute('aria-pressed','true');
});
