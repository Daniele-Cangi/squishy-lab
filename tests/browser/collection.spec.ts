import { test,expect,type Page } from '@playwright/test';
import { DEFAULT_SPEC } from '../../src/shared/spec';
type Snapshot={appearance:{shape:string;label:string;face:boolean;effect:string};contactDepthUnits:number;contact:{sustain:number;normal:number[]}|null;detailsReady:boolean;decorationVertices:number;spec:typeof DEFAULT_SPEC;physicsTime:number;maxDisplacement:number;minVolumeRatio:number;safetyBackoffs:number;renderer:{render:{frame:number}}};
const snapshot=async(page:Page)=>await page.evaluate(()=>window.__squishy!.snapshot()) as Snapshot;
const ready=async(page:Page)=>{await page.goto('/');await expect.poll(async()=>(await snapshot(page))?.detailsReady).toBe(true);};
for(const name of ['Mochi','Banana','Peanut','Cioccolato'])test(`${name}: stationary mouse hold continues sinking, then recovers`,async({page})=>{
  test.setTimeout(90000);
  await page.clock.install({time:new Date('2026-10-04T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-04T01:00:00Z'));
  await page.getByRole('button',{name,exact:true}).click();const box=(await page.locator('#squishy').boundingBox())!;
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.48);await page.mouse.down();await page.clock.runFor(1000);const short=await snapshot(page);expect(short.contact).not.toBeNull();expect(short.contactDepthUnits).toBeGreaterThan(.015);
  if(name==='Cioccolato'){expect(short.contact!.normal[1]).toBeGreaterThan(.8);expect(short.contactDepthUnits).toBeGreaterThan(.03);}
  await page.clock.runFor(5500);const long=await snapshot(page);expect(long.contact?.sustain).toBe(1);expect(long.contactDepthUnits).toBeGreaterThan(short.contactDepthUnits*1.35);expect(long.minVolumeRatio).toBeGreaterThan(.17);
  if(name==='Cioccolato')expect(long.safetyBackoffs).toBe(0);
  await page.mouse.up();await page.clock.runFor(2000);expect((await snapshot(page)).maxDisplacement).toBeLessThan(long.maxDisplacement);expect((await snapshot(page)).contact).toBeNull();
});
// A virtual clock can queue many expensive transmission frames faster than
// SwiftShader consumes them. Release that test's GL context before its browser
// context is torn down, so the next fixture does not wait on its GPU backlog.
test.afterEach(async({page})=>{
  if(!page.isClosed())await page.evaluate(()=>document.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
});
test('all collectible forms load details and withstand keyboard pressure',async({page})=>{
  test.setTimeout(90000);
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-03T01:00:00Z'));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [name,shape,label]of [['Butter','butter','butter'],['Strawberry','butter','strawberry'],['Fragolina','strawberry','none'],['Jelly cube','cube','none']]){
    await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'Ripristina forma'}).click();const rest=await snapshot(page);expect(rest.appearance.shape).toBe(shape);expect(rest.appearance.label).toBe(label);expect(rest.decorationVertices).toBeGreaterThan(100);expect(rest.maxDisplacement).toBeLessThan(.001);
    await page.locator('#squishy').focus();await page.keyboard.down('Space');await page.clock.runFor(1800);const held=await snapshot(page);expect(held.maxDisplacement).toBeGreaterThan(.07);expect(held.minVolumeRatio).toBeGreaterThan(.17);await page.keyboard.up('Space');await page.clock.runFor(1200);expect((await snapshot(page)).maxDisplacement).toBeLessThan(held.maxDisplacement);
  }expect(errors).toEqual([]);
});
for(const [name,shape]of [['Cioccolato','chocolate'],['Banana','banana'],['Gatto','cat'],['Formaggio','cheese'],['Peanut','peanut']])test(`${name}: new body and Blender details deform and recover`,async({page})=>{
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-03T01:00:00Z'));
  await page.getByRole('button',{name,exact:true}).click();const rest=await snapshot(page);expect(rest.appearance.shape).toBe(shape);expect(rest.decorationVertices).toBeGreaterThan(100);
  await page.locator('#squishy').focus();await page.keyboard.down('Space');await page.clock.runFor(1200);const held=await snapshot(page);expect(held.maxDisplacement).toBeGreaterThan(.05);expect(held.minVolumeRatio).toBeGreaterThan(.17);
  await page.keyboard.up('Space');await page.clock.runFor(1400);expect((await snapshot(page)).maxDisplacement).toBeLessThan(held.maxDisplacement);
  await page.getByRole('button',{name:'Ripristina forma'}).click();expect((await snapshot(page)).maxDisplacement).toBeLessThan(.001);
});
test('effects and face preserve deformation; saved collection survives reload and deletion',async({page})=>{
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-03T01:00:00Z'));await page.getByRole('button',{name:'Butter',exact:true}).click();await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(1400);await page.evaluate(()=>window.__squishy!.release());const held=await snapshot(page);
  await page.getByRole('button',{name:'✦ Glitter',exact:true}).click();await page.getByLabel('Con il viso').check();const fx=await snapshot(page);expect(fx.maxDisplacement).toBe(held.maxDisplacement);expect(fx.physicsTime).toBe(held.physicsTime);expect(fx.appearance).toMatchObject({shape:'butter',effect:'glitter',face:true});
  await page.reload();await expect.poll(async()=>(await snapshot(page)).detailsReady).toBe(true);expect((await snapshot(page)).appearance).toEqual(fx.appearance);await expect(page.getByRole('button',{name:'Butter',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('Con il viso')).toBeChecked();
  await page.getByRole('button',{name:'Cancella lo squishy salvato'}).click();expect((await snapshot(page)).appearance.shape).toBe('mochi');expect(await page.evaluate(()=>localStorage.getItem('squishy-appearance-v1'))).toBeNull();
});
test('material AI edits keep the selected panetto and its lettering',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'Strawberry',exact:true}).click();const before=await snapshot(page);
  await page.getByRole('textbox').fill('Uguale, ma meno molle.');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(async()=>(await snapshot(page)).spec.softness).toBeLessThan(before.spec.softness);
  expect((await snapshot(page)).appearance).toEqual(before.appearance);expect((await snapshot(page)).spec.color).toBe(before.spec.color);expect((await snapshot(page)).decorationVertices).toBe(before.decorationVertices);
  await page.getByRole('button',{name:'Confronta prima e dopo'}).click();expect((await snapshot(page)).appearance).toEqual(before.appearance);await page.getByRole('button',{name:'Interrompi confronto'}).click();expect((await snapshot(page)).appearance).toEqual(before.appearance);
});
test('mobile collection has no overflow and yields space while typing',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page);await expect(page.locator('[data-shape]')).toHaveCount(10);await page.getByRole('button',{name:'Banana',exact:true}).click();expect((await snapshot(page)).appearance.shape).toBe('banana');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.getByRole('textbox').focus();await expect(page.getByRole('region',{name:'Forme e superfici'})).toBeHidden();await page.getByRole('textbox').blur();await expect(page.getByRole('region',{name:'Forme e superfici'})).toBeVisible();
});
test('choosing a collection cancels an older material reply',async({page})=>{
  await ready(page);let arrived=false;
  await page.route('**/api/squishy',async route=>{arrived=true;await new Promise(resolve=>setTimeout(resolve,650));await route.fulfill({json:{version:1,status:'ok',provider:'mock',repaired:false,corrections:[],message:'Old result',patch:{color:'#77c8ea'},spec:{...DEFAULT_SPEC,color:'#77c8ea'}}}).catch(()=>{});});
  await page.getByRole('textbox').fill('Blu');await page.getByRole('button',{name:'Applica la descrizione'}).click();await expect.poll(()=>arrived).toBe(true);await page.getByRole('button',{name:'Strawberry',exact:true}).click();await page.waitForTimeout(800);const current=await snapshot(page);expect(current.spec.color).toBe('#f29bb5');expect(current.appearance.label).toBe('strawberry');await expect(page.locator('#generate')).toBeEnabled();
});
test('idle scene stops physics and rendering, then wakes for rotation and pressure',async({page})=>{
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-03T01:00:00Z'));await page.clock.runFor(40);const idle=await snapshot(page);await page.clock.runFor(600);const still=await snapshot(page);expect(still.physicsTime).toBe(idle.physicsTime);expect(still.renderer.render.frame).toBe(idle.renderer.render.frame);
  await page.getByRole('button',{name:'Ruota la vista'}).click();await page.clock.runFor(40);expect((await snapshot(page)).renderer.render.frame).toBeGreaterThan(still.renderer.render.frame);await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(1000);expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.06);await page.evaluate(()=>window.__squishy!.release());
});
