import { test,expect,type Page } from '@playwright/test';
import { DEFAULT_SPEC } from '../../src/shared/spec';
interface Snapshot {maxDisplacement:number;renderedSurfaceDepthUnits:number;minVolumeRatio:number;spec:typeof DEFAULT_SPEC;physicsTime:number;vertices:number;safetyBackoffs:number}
async function snapshot(page:Page){return page.evaluate(()=>window.__squishy!.snapshot() as Snapshot);}
async function ready(page:Page){await page.goto('/');await expect(page.locator('#mode-badge')).toHaveText('Demo locale · senza AI');await expect.poll(async()=>page.evaluate(()=>!!window.__squishy)).toBe(true);}

test('material comparison resets memory and preserves appearance; interruption restores the actual edit',async({page})=>{
  await ready(page);const before=(await snapshot(page)).spec;
  // A controlled multi-field reply proves the comparison really holds visual
  // appearance fixed, even when the actual edit changes color and proportions.
  await page.route('**/api/squishy',route=>route.fulfill({json:{version:1,status:'ok',provider:'mock',patch:{softness:.5,color:'#77c8ea',proportions:{height:.78}},spec:{...before,softness:.5,color:'#77c8ea',proportions:{...before.proportions,height:.78}},message:'Fixture edit.',corrections:[],repaired:false}}));
  await page.getByRole('textbox').fill('Uguale, ma meno molle.');await page.locator('#generate').click();await expect(page.locator('#comparison-row')).toBeVisible();
  const edited=(await snapshot(page)).spec;await page.locator('#compare').click();await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','before');
  expect((await snapshot(page)).spec).toEqual(before);await expect.poll(async()=>(await snapshot(page)).renderedSurfaceDepthUnits).toBeGreaterThan(.1);
  await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','after',{timeout:16000});
  const after=await snapshot(page);expect(after.physicsTime).toBeLessThan(1);expect(after.spec.color).toBe(before.color);expect(after.spec.proportions).toEqual(before.proportions);expect(after.spec.softness).toBe(edited.softness);
  await page.locator('#compare').click();await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','ready');expect((await snapshot(page)).spec).toEqual(edited);expect((await snapshot(page)).maxDisplacement).toBeLessThan(.001);
});

test('focus loss and hidden-tab interruption release pressure; resized mobile composer stays usable',async({page})=>{
  await ready(page);await page.locator('#squishy').focus();await page.keyboard.down('Space');await expect(page.locator('#state')).toHaveText('Sotto pressione');
  await page.getByRole('textbox').focus();await expect(page.locator('#state')).not.toHaveText('Sotto pressione');await page.keyboard.up('Space');
  await page.evaluate(()=>window.__squishy!.press());await expect(page.locator('#state')).toHaveText('Sotto pressione');await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('#state')).not.toHaveText('Sotto pressione');
  await page.setViewportSize({width:390,height:504});await page.getByRole('textbox').fill('Meno molle');
  await expect.poll(async()=>{const field=(await page.getByRole('textbox').boundingBox())!;return field.y+field.height;}).toBeLessThanOrEqual(504);
  const dock=(await page.locator('#squishy').boundingBox())!;expect(dock.height).toBeGreaterThanOrEqual(150);expect(dock.height).toBeLessThan(230);expect(dock.y).toBeGreaterThanOrEqual(-1);expect(dock.y+dock.height).toBeLessThan(504);
  const field=(await page.getByRole('textbox').boundingBox())!;expect(field.y).toBeGreaterThan(dock.y+dock.height);
  await page.screenshot({path:'evidence/refined/browser-smoke/mobile-composing.png'});
  // Leaving the textarea for composer controls must not move their tap target.
  await page.locator('#create-mode').click();await expect(page.locator('#create-mode')).toHaveAttribute('aria-pressed','true');
  await page.locator('#modify-mode').click();await expect(page.locator('#modify-mode')).toHaveAttribute('aria-pressed','true');
  await page.locator('#generate').click();await expect(page.locator('#status')).toContainText('demo locale');await expect(page.locator('body')).not.toHaveAttribute('data-composing','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.locator('#squeeze').scrollIntoViewIfNeeded();await page.locator('#squeeze').focus();await page.keyboard.down('Enter');await expect(page.locator('#state')).toHaveText('Sotto pressione');await page.keyboard.up('Enter');
});
test('rendered WebGL canvas, local dent, release, keyboard and reset',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
  const canvas=page.locator('#squishy');expect((await snapshot(page)).vertices).toBeGreaterThan(5000);
  const box=(await canvas.boundingBox())!;
  await page.screenshot({path:'evidence/refined/browser-smoke/rest.png',fullPage:true});
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.49);await page.mouse.down();
  await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.12);
  await page.waitForTimeout(1000);const compressed=(await snapshot(page)).maxDisplacement;
  await page.screenshot({path:'evidence/refined/browser-smoke/compressed.png',fullPage:true});
  await page.mouse.up();await expect(page.locator('#state')).toHaveText('Sta tornando su…');
  await page.waitForTimeout(1000);await page.screenshot({path:'evidence/refined/browser-smoke/recovering.png',fullPage:true});
  expect((await snapshot(page)).maxDisplacement).toBeLessThan(compressed);expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.03);
  await page.getByRole('button',{name:'Ripristina forma'}).click();await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeLessThan(.001);
  await page.getByRole('button',{name:'Tieni per premere'}).focus();await page.keyboard.down('Space');await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);await page.keyboard.up('Space');
  expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);expect(errors).toEqual([]);
});
test('contextual MOCK modification preserves color and changes simulated response',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'Nuvola viola Schiuma · risale piano'}).click();
  await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2000);const before=await snapshot(page);await page.screenshot({path:'evidence/refined/browser-smoke/mock-before-firm.png',fullPage:true});await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox').fill('Uguale, ma meno molle.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#status')).toContainText('demo locale');
  const edited=await snapshot(page);expect(edited.spec.color).toBe(before.spec.color);expect(edited.spec.recoverySeconds).toBe(before.spec.recoverySeconds);expect(edited.spec.softness).toBeLessThan(before.spec.softness);
  await page.getByRole('button',{name:'Ripristina forma'}).click();await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2000);const after=await snapshot(page);await page.screenshot({path:'evidence/refined/browser-smoke/mock-after-firm.png',fullPage:true});expect(after.maxDisplacement).toBeLessThan(before.maxDisplacement*.9);await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox').fill('Non cambiare colore: fallo riprendere più velocemente.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.recoverySeconds).toBeLessThan(before.spec.recoverySeconds);
  expect((await snapshot(page)).spec.color).toBe(before.spec.color);
});
test('color-only patch keeps physical state; unsupported shape and network failure retain object',async({page})=>{
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-03T01:00:00Z'));
  await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(2000);await page.evaluate(()=>window.__squishy!.release());
  // Keep simulation time fixed across the real HTTP round trip: recovery speed
  // and CI rendering throughput must not hide a reset caused by a color edit.
  const deformed=await snapshot(page);expect(deformed.maxDisplacement).toBeGreaterThan(.12);
  await page.getByRole('textbox').fill('Cambia soltanto il colore in blu.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.color).toBe('#77c8ea');
  const recolored=await snapshot(page);expect(recolored.maxDisplacement).toBe(deformed.maxDisplacement);expect(recolored.physicsTime).toBe(deformed.physicsTime);expect(recolored.minVolumeRatio).toBe(deformed.minVolumeRatio);
  await page.getByRole('textbox').fill('Fammi uno squalo blu.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#status')).toContainText('non è disponibile');expect((await snapshot(page)).spec.archetype).toBe('mochi');
  await page.route('**/api/squishy',route=>route.fulfill({status:429,contentType:'application/json',body:'{"message":"La quota AI di oggi è esaurita."}'}));
  const old=(await snapshot(page)).spec;await page.getByRole('textbox').fill('Più morbido');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#status')).toContainText('quota');expect((await snapshot(page)).spec).toEqual(old);await page.getByRole('button',{name:'Ripristina forma'}).click();
  await page.route('**/api/squishy',route=>route.abort());await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#generate')).toBeEnabled();await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(2000);expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);
});
test('outdated request cannot override a later preset or shape generation',async({page})=>{
  await ready(page);let arrived=false;await page.route('**/api/squishy',async route=>{arrived=true;await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({version:1,status:'ok',provider:'mock',repaired:false,corrections:[],message:'old response',patch:{softness:.4},spec:{...DEFAULT_SPEC,softness:.4}})}).catch(()=>{});});
  await page.getByRole('textbox').fill('Meno molle');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(()=>arrived).toBe(true);await page.getByRole('button',{name:'Pop azzurro Elastico · ritorna subito'}).click();await page.waitForTimeout(1000);expect((await snapshot(page)).spec.color).toBe('#77c8ea');expect((await snapshot(page)).spec.recoverySeconds).toBe(.45);
  await page.unroute('**/api/squishy');await page.getByRole('textbox').fill('Lo voglio più schiacciato, non più piccolo.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.proportions.height).toBeLessThan(DEFAULT_SPEC.proportions.height);expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);
});
test('touch layout, pointer cancellation, outside release and optional storage',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'evidence/refined/browser-smoke/mobile.png',fullPage:true});
  const canvas=page.locator('#squishy'),box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.5);await page.mouse.down();await page.waitForTimeout(900);await canvas.dispatchEvent('pointercancel',{pointerId:1});await expect(page.locator('#state')).not.toHaveText('Sotto pressione');await page.mouse.up();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(380,10);await page.mouse.up();await expect(page.locator('#state')).not.toHaveText('Sotto pressione');
  await page.getByRole('button',{name:'Mochi pesca Schiuma · un po’ più sodo'}).click();await page.reload();await expect.poll(async()=>(await snapshot(page)).spec.color).toBe('#f6aa8b');await page.getByRole('button',{name:'Cancella lo squishy salvato'}).click();expect(await page.evaluate(()=>localStorage.getItem('squishy-spec-v1'))).toBeNull();
});
test('API validation on the running adapter',async({request})=>{
  expect((await request.post('/api/squishy',{data:{version:1,mode:'create',prompt:''}})).status()).toBe(400);
  expect((await request.post('/api/squishy',{data:'x'.repeat(9000),headers:{'Content-Type':'application/json'}})).status()).toBe(413);
});
test('emulated touch drag/cancel and denied storage still allow playing',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.addInitScript(()=>{for(const name of ['getItem','setItem','removeItem'])Object.defineProperty(Storage.prototype,name,{value(){throw new DOMException('Blocked','SecurityError');}});});
  try{
    await ready(page);const box=(await page.locator('#squishy').boundingBox())!,session=await context.newCDPSession(page),x=box.x+box.width*.5,y=box.y+box.height*.5;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+25}]});await page.waitForTimeout(300);expect(await page.evaluate(()=>scrollY)).toBe(0);expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);
    await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('#state')).not.toHaveText('Sotto pressione');
    await page.getByRole('button',{name:'Cancella lo squishy salvato'}).click();await expect(page.locator('#status')).toContainText('cancellata');
  }finally{await context.close();}
});
