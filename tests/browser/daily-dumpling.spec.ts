import { test,expect,type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const snapshot=(page:Page)=>page.evaluate(()=>window.__squishy!.snapshot()) as Promise<{appearance:{shape:string;effect:string;expression:string};detailsReady:boolean;maxDisplacement:number;renderedSurfaceDepthUnits:number;minVolumeRatio:number;decorationVertices:number}>;
const key='squishy-daily-dumpling-v1';
// Drain virtual-time rendering before tearing down a software GL context.
test.afterEach(async({page})=>{
  if(!page.isClosed())await page.evaluate(()=>document.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
});
test('daily prize persists, cannot reroll in a second tab and can be recalled',async({page,context})=>{
  test.setTimeout(90000);
  await page.goto('/');await expect.poll(async()=>(await snapshot(page)).detailsReady,{timeout:15000}).toBe(true);
  await page.getByRole('button',{name:'Open the dumpling basket'}).click();
  await expect(page.locator('.daily-dumpling')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#daily-basket')).toBeDisabled();
  await expect.poll(async()=>(await snapshot(page)).appearance.shape,{timeout:15000}).toBe('dumpling');
  const prize=await page.evaluate(key=>localStorage.getItem(key),key),first=await snapshot(page);
  expect(first.decorationVertices).toBeGreaterThan(0);
  await expect(page.locator('#daily-open')).toBeDisabled();
  await page.screenshot({path:'work/daily-dumpling/desktop.png',fullPage:true});
  await page.reload();await expect(page.locator('#daily-open')).toBeDisabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(prize);
  const other=await context.newPage();await other.goto('/');await expect(other.locator('#daily-open')).toBeDisabled();await other.close();
  await page.getByRole('button',{name:'Mochi',exact:true}).click();
  await page.getByRole('button',{name:'Squish today’s dumpling'}).click();expect((await snapshot(page)).appearance).toEqual(first.appearance);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(prize);
  await page.locator('#forget').click();await expect(page.locator('#daily-open')).toBeDisabled();
});

test('reduced motion opens from the keyboard without an animation or reroll',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await expect.poll(async()=>(await snapshot(page)).detailsReady,{timeout:15000}).toBe(true);
  await page.locator('#daily-basket').focus();await page.keyboard.press('Enter');
  await expect.poll(async()=>(await snapshot(page)).appearance.shape,{timeout:15000}).toBe('dumpling');
  await expect(page.locator('.daily-dumpling')).toHaveAttribute('aria-busy','false');
  expect(await page.locator('.steamer-lid').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  const prize=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.locator('#daily-basket').click();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(prize);
});
test('pleated dumpling visibly deforms under a long hold and recovers',async({page})=>{
  test.setTimeout(90000);
  await page.clock.install({time:new Date('2026-10-12T00:00:00Z')});
  await page.goto('/');await expect.poll(async()=>(await snapshot(page)).detailsReady,{timeout:15000}).toBe(true);
  await page.clock.pauseAt(new Date('2026-10-12T01:00:00Z'));
  await page.getByRole('button',{name:'Dumpling',exact:true}).click();
  await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(3500);
  const held=await snapshot(page);
  expect(held.maxDisplacement).toBeGreaterThan(.1);expect(held.renderedSurfaceDepthUnits).toBeGreaterThan(.02);expect(held.minVolumeRatio).toBeGreaterThan(.17);
  await page.evaluate(()=>window.__squishy!.release());await page.clock.runFor(8000);
  expect((await snapshot(page)).maxDisplacement).toBeLessThan(held.maxDisplacement*.2);
  await page.evaluate(()=>window.__squishy!.reset());expect((await snapshot(page)).maxDisplacement).toBe(0);
});
test('mobile glitter reward, expiry, no horizontal overflow and keyboard opening',async({page})=>{
  test.setTimeout(60000);mkdirSync('work/daily-dumpling',{recursive:true});
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:1,openedAt:Date.now(),colorIndex:2,expressionIndex:3,glitter:true})),key);
  await page.goto('/');await expect.poll(async()=>(await snapshot(page)).detailsReady,{timeout:15000}).toBe(true);
  await page.locator('#daily-play').click();expect((await snapshot(page)).appearance).toMatchObject({shape:'dumpling',expression:'wink',effect:'glitter'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'work/daily-dumpling/mobile-glitter.png',fullPage:true});
  const expired=await page.evaluate(key=>{const v=JSON.parse(localStorage.getItem(key)!);v.openedAt=Date.now()-86400001;localStorage.setItem(key,JSON.stringify(v));document.dispatchEvent(new Event('visibilitychange'));return v.openedAt as number;},key);
  await expect(page.locator('#daily-open')).toBeEnabled();await page.locator('#daily-open').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#daily-open')).toBeDisabled();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).openedAt as number,key),{timeout:15000}).toBeGreaterThan(expired);
  await expect(page.locator('#daily-open')).toHaveText('Tomorrow’s surprise is resting');
});
