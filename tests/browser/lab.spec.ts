import { test,expect,type Page } from '@playwright/test';
import { DEFAULT_SPEC } from '../../src/shared/spec';
interface Snapshot {maxDisplacement:number;minVolumeRatio:number;spec:typeof DEFAULT_SPEC;physicsTime:number;vertices:number;safetyBackoffs:number}
async function snapshot(page:Page){return page.evaluate(()=>window.__squishy!.snapshot() as Snapshot);}
async function ready(page:Page){await page.goto('/');await expect(page.locator('#mode-badge')).toHaveText('Demo locale · senza AI');await expect.poll(async()=>page.evaluate(()=>!!window.__squishy)).toBe(true);}
test('rendered WebGL canvas, local dent, release, keyboard and reset',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
  const canvas=page.locator('#squishy');expect((await snapshot(page)).vertices).toBeGreaterThan(5000);
  const box=(await canvas.boundingBox())!;
  await page.screenshot({path:'evidence/rest.png',fullPage:true});
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.49);await page.mouse.down();
  await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.12);
  await page.waitForTimeout(1000);const compressed=(await snapshot(page)).maxDisplacement;
  await page.screenshot({path:'evidence/compressed.png',fullPage:true});
  await page.mouse.up();await expect(page.locator('#state')).toHaveText('Sta tornando su…');
  await page.waitForTimeout(1000);await page.screenshot({path:'evidence/recovering.png',fullPage:true});
  expect((await snapshot(page)).maxDisplacement).toBeLessThan(compressed);expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.03);
  await page.getByRole('button',{name:'Ripristina forma'}).click();await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeLessThan(.001);
  await page.getByRole('button',{name:'Tieni per premere'}).focus();await page.keyboard.down('Space');await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);await page.keyboard.up('Space');
  expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);expect(errors).toEqual([]);
});
test('contextual MOCK modification preserves color and changes simulated response',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'Nuvola viola Schiuma · risale piano'}).click();
  await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2000);const before=await snapshot(page);await page.screenshot({path:'evidence/mock-before-firm.png',fullPage:true});await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox').fill('Uguale, ma meno molle.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#status')).toContainText('demo locale');
  const edited=await snapshot(page);expect(edited.spec.color).toBe(before.spec.color);expect(edited.spec.recoverySeconds).toBe(before.spec.recoverySeconds);expect(edited.spec.softness).toBeLessThan(before.spec.softness);
  await page.getByRole('button',{name:'Ripristina forma'}).click();await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2000);const after=await snapshot(page);await page.screenshot({path:'evidence/mock-after-firm.png',fullPage:true});expect(after.maxDisplacement).toBeLessThan(before.maxDisplacement*.9);await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox').fill('Non cambiare colore: fallo riprendere più velocemente.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.recoverySeconds).toBeLessThan(before.spec.recoverySeconds);
  expect((await snapshot(page)).spec.color).toBe(before.spec.color);
});
test('color-only patch keeps physical state; unsupported shape and network failure retain object',async({page})=>{
  await ready(page);await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(1200);await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox').fill('Cambia soltanto il colore in blu.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.color).toBe('#77c8ea');expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.02);
  await page.getByRole('textbox').fill('Fammi uno squalo blu.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#status')).toContainText('non è disponibile');expect((await snapshot(page)).spec.archetype).toBe('mochi');
  await page.route('**/api/squishy',route=>route.fulfill({status:429,contentType:'application/json',body:'{"message":"La quota AI di oggi è esaurita."}'}));
  const old=(await snapshot(page)).spec;await page.getByRole('textbox').fill('Più morbido');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#status')).toContainText('quota');expect((await snapshot(page)).spec).toEqual(old);await page.getByRole('button',{name:'Ripristina forma'}).click();
  await page.route('**/api/squishy',route=>route.abort());await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect(page.locator('#generate')).toBeEnabled();await page.evaluate(()=>window.__squishy!.press());await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);
});
test('outdated request cannot override a later preset or shape generation',async({page})=>{
  await ready(page);let arrived=false;await page.route('**/api/squishy',async route=>{arrived=true;await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({version:1,status:'ok',provider:'mock',repaired:false,corrections:[],message:'old response',patch:{softness:.4},spec:{...DEFAULT_SPEC,softness:.4}})}).catch(()=>{});});
  await page.getByRole('textbox').fill('Meno molle');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(()=>arrived).toBe(true);await page.getByRole('button',{name:'Pop azzurro Elastico · ritorna subito'}).click();await page.waitForTimeout(1000);expect((await snapshot(page)).spec.color).toBe('#77c8ea');expect((await snapshot(page)).spec.recoverySeconds).toBe(.45);
  await page.unroute('**/api/squishy');await page.getByRole('textbox').fill('Lo voglio più schiacciato, non più piccolo.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.proportions.height).toBeLessThan(DEFAULT_SPEC.proportions.height);expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);
});
test('touch layout, pointer cancellation, outside release and optional storage',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'evidence/mobile.png',fullPage:true});
  const canvas=page.locator('#squishy'),box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.5);await page.mouse.down();await page.waitForTimeout(900);await canvas.dispatchEvent('pointercancel',{pointerId:1});await expect(page.locator('#state')).not.toHaveText('Sotto pressione');await page.mouse.up();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(380,10);await page.mouse.up();await expect(page.locator('#state')).not.toHaveText('Sotto pressione');
  await page.getByRole('button',{name:'Mochi pesca Schiuma · un po’ più sodo'}).click();await page.reload();await expect.poll(async()=>(await snapshot(page)).spec.color).toBe('#f6aa8b');await page.getByRole('button',{name:'Cancella lo squishy salvato'}).click();expect(await page.evaluate(()=>localStorage.getItem('squishy-spec-v1'))).toBeNull();
});
test('API validation on the running adapter',async({request})=>{
  expect((await request.post('/api/squishy',{data:{version:1,mode:'create',prompt:''}})).status()).toBe(400);
  expect((await request.post('/api/squishy',{data:'x'.repeat(9000),headers:{'Content-Type':'application/json'}})).status()).toBe(413);
});
