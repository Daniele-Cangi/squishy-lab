import { test,expect,type Page } from '@playwright/test';
import { DEFAULT_SPEC } from '../../src/shared/spec';
interface Snapshot {maxDisplacement:number;renderedSurfaceDepthUnits:number;minVolumeRatio:number;spec:typeof DEFAULT_SPEC;physicsTime:number;vertices:number;safetyBackoffs:number}
async function snapshot(page:Page){return page.evaluate(()=>window.__squishy!.snapshot() as Snapshot);}
async function ready(page:Page){await page.goto('/');await expect(page.locator('#mode-badge')).toHaveText('Local demo · no AI');await expect.poll(async()=>page.evaluate(()=>!!window.__squishy)).toBe(true);}

test('material comparison resets memory and preserves appearance; interruption restores the actual edit',async({page})=>{
  test.setTimeout(90000);
  await ready(page);const before=(await snapshot(page)).spec;
  // A controlled multi-field reply proves the comparison really holds visual
  // appearance fixed, even when the actual edit changes color and proportions.
  await page.route('**/api/squishy',route=>route.fulfill({json:{version:1,status:'ok',provider:'mock',patch:{softness:.5,color:'#77c8ea',proportions:{height:.78}},spec:{...before,softness:.5,color:'#77c8ea',proportions:{...before.proportions,height:.78}},message:'Fixture edit.',corrections:[],repaired:false}}));
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Same, but a little firmer.');await page.locator('#generate').click();await expect(page.locator('#comparison-row')).toBeVisible();
  const edited=(await snapshot(page)).spec;
  // Comparison phases follow fixed simulation time, not runner/GPU wall time.
  await page.clock.install({time:new Date('2026-10-06T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-06T01:00:00Z'));
  await page.locator('#compare').click();await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','before');
  expect((await snapshot(page)).spec).toEqual(before);await page.clock.runFor(1000);expect((await snapshot(page)).renderedSurfaceDepthUnits).toBeGreaterThan(.1);
  await page.clock.runFor(6200);await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','after');
  const after=await snapshot(page);expect(after.physicsTime).toBeLessThan(1);expect(after.spec.color).toBe(before.color);expect(after.spec.proportions).toEqual(before.proportions);expect(after.spec.softness).toBe(edited.softness);
  await page.locator('#compare').click();await expect(page.locator('#comparison-row')).toHaveAttribute('data-phase','ready');expect((await snapshot(page)).spec).toEqual(edited);expect((await snapshot(page)).maxDisplacement).toBeLessThan(.001);
});

test('focus loss and hidden-tab interruption release pressure; resized mobile composer stays usable',async({page})=>{
  await ready(page);await page.locator('#squishy').focus();await page.keyboard.down('Space');await expect(page.locator('#state')).toHaveText('Being squished');
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).focus();await expect(page.locator('#state')).not.toHaveText('Being squished');await page.keyboard.up('Space');
  await page.evaluate(()=>window.__squishy!.press());await expect(page.locator('#state')).toHaveText('Being squished');await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('#state')).not.toHaveText('Being squished');
  await page.setViewportSize({width:390,height:504});await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('A little firmer');
  await expect.poll(async()=>{const field=(await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).boundingBox())!;return field.y+field.height;}).toBeLessThanOrEqual(504);
  const dock=(await page.locator('#squishy').boundingBox())!;expect(dock.height).toBeGreaterThanOrEqual(150);expect(dock.height).toBeLessThan(230);expect(dock.y).toBeGreaterThanOrEqual(-1);expect(dock.y+dock.height).toBeLessThan(504);
  const field=(await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).boundingBox())!;expect(field.y).toBeGreaterThan(dock.y+dock.height);
  await page.screenshot({path:'evidence/refined/browser-smoke/mobile-composing.png'});
  // Leaving the textarea for composer controls must not move their tap target.
  await page.locator('#create-mode').click();await expect(page.locator('#create-mode')).toHaveAttribute('aria-pressed','true');
  await page.locator('#modify-mode').click();await expect(page.locator('#modify-mode')).toHaveAttribute('aria-pressed','true');
  await page.locator('#generate').click();await expect(page.locator('#status')).toContainText('Local demo');await expect(page.locator('body')).not.toHaveAttribute('data-composing','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.locator('#squeeze').scrollIntoViewIfNeeded();await page.locator('#squeeze').focus();await page.keyboard.down('Enter');await expect(page.locator('#state')).toHaveText('Being squished');await page.keyboard.up('Enter');
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
  await page.mouse.up();await expect(page.locator('#state')).toHaveText('Bouncing back…');
  await page.waitForTimeout(1000);await page.screenshot({path:'evidence/refined/browser-smoke/recovering.png',fullPage:true});
  expect((await snapshot(page)).maxDisplacement).toBeLessThan(compressed);expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.03);
  await page.getByRole('button',{name:'Reset shape'}).click();await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeLessThan(.001);
  await page.getByRole('button',{name:'Hold to squish'}).focus();await page.keyboard.down('Space');await expect.poll(async()=>(await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);await page.keyboard.up('Space');
  expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);expect(errors).toEqual([]);
});
test('contextual MOCK modification preserves color and changes simulated response',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'Purple cloud Foam · slow rise'}).click();
  await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2000);const before=await snapshot(page);await page.screenshot({path:'evidence/refined/browser-smoke/mock-before-firm.png',fullPage:true});await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Same, but a little firmer.');await page.getByRole('button',{name:'Apply description'}).click();await expect(page.locator('#status')).toContainText('Local demo');
  const edited=await snapshot(page);expect(edited.spec.color).toBe(before.spec.color);expect(edited.spec.recoverySeconds).toBe(before.spec.recoverySeconds);expect(edited.spec.softness).toBeLessThan(before.spec.softness);
  await page.getByRole('button',{name:'Reset shape'}).click();await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(2000);const after=await snapshot(page);await page.screenshot({path:'evidence/refined/browser-smoke/mock-after-firm.png',fullPage:true});expect(after.maxDisplacement).toBeLessThan(before.maxDisplacement*.9);await page.evaluate(()=>window.__squishy!.release());
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Keep the color and make it recover faster.');await page.getByRole('button',{name:'Apply description'}).click();await expect.poll(async()=>(await snapshot(page)).spec.recoverySeconds).toBeLessThan(before.spec.recoverySeconds);
  expect((await snapshot(page)).spec.color).toBe(before.spec.color);
});
test('color-only patch keeps physical state; unsupported shape and network failure retain object',async({page})=>{
  await page.clock.install({time:new Date('2026-10-03T00:00:00Z')});await ready(page);await page.clock.pauseAt(new Date('2026-10-03T01:00:00Z'));
  await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(2000);await page.evaluate(()=>window.__squishy!.release());
  // Keep simulation time fixed across the real HTTP round trip: recovery speed
  // and CI rendering throughput must not hide a reset caused by a color edit.
  const deformed=await snapshot(page);expect(deformed.maxDisplacement).toBeGreaterThan(.12);
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Change only the color to blue.');await page.getByRole('button',{name:'Apply description'}).click();await expect.poll(async()=>(await snapshot(page)).spec.color).toBe('#77c8ea');
  const recolored=await snapshot(page);expect(recolored.maxDisplacement).toBe(deformed.maxDisplacement);expect(recolored.physicsTime).toBe(deformed.physicsTime);expect(recolored.minVolumeRatio).toBe(deformed.minVolumeRatio);
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Make me a blue shark.');await page.getByRole('button',{name:'Apply description'}).click();await expect(page.locator('#status')).toContainText('is unavailable');expect((await snapshot(page)).spec.archetype).toBe('mochi');
  await page.route('**/api/squishy',route=>route.fulfill({status:429,contentType:'application/json',body:'{"message":"Today’s AI quota is exhausted."}'}));
  const old=(await snapshot(page)).spec;await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Softer');await page.getByRole('button',{name:'Apply description'}).click();await expect(page.locator('#status')).toContainText('quota');expect((await snapshot(page)).spec).toEqual(old);await page.getByRole('button',{name:'Reset shape'}).click();
  await page.route('**/api/squishy',route=>route.abort());await page.getByRole('button',{name:'Apply description'}).click();await expect(page.locator('#generate')).toBeEnabled();await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(2000);expect((await snapshot(page)).maxDisplacement).toBeGreaterThan(.08);
});
test('outdated request cannot override a later preset or shape generation',async({page})=>{
  await ready(page);let arrived=false;await page.route('**/api/squishy',async route=>{arrived=true;await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({version:1,status:'ok',provider:'mock',repaired:false,corrections:[],message:'old response',patch:{softness:.4},spec:{...DEFAULT_SPEC,softness:.4}})}).catch(()=>{});});
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('A little firmer');await page.getByRole('button',{name:'Apply description'}).click();await expect.poll(()=>arrived).toBe(true);await page.getByRole('button',{name:'Blue pop Bouncy · quick return'}).click();await page.waitForTimeout(1000);expect((await snapshot(page)).spec.color).toBe('#77c8ea');expect((await snapshot(page)).spec.recoverySeconds).toBe(.45);
  await page.unroute('**/api/squishy');await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Make it flatter, not smaller.');await page.getByRole('button',{name:'Apply description'}).click();await expect.poll(async()=>(await snapshot(page)).spec.proportions.height).toBeLessThan(DEFAULT_SPEC.proportions.height);expect((await snapshot(page)).minVolumeRatio).toBeGreaterThan(.17);
});
test('touch layout, pointer cancellation, outside release and optional storage',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'evidence/refined/browser-smoke/mobile.png',fullPage:true});
  const canvas=page.locator('#squishy'),box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.5);await page.mouse.down();await page.waitForTimeout(900);await canvas.dispatchEvent('pointercancel',{pointerId:1});await expect(page.locator('#state')).not.toHaveText('Being squished');await page.mouse.up();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(380,10);await page.mouse.up();await expect(page.locator('#state')).not.toHaveText('Being squished');
  await page.getByRole('button',{name:'Peach mochi Foam · a little firmer'}).click();await page.reload();await expect.poll(async()=>(await snapshot(page)).spec.color).toBe('#f6aa8b');await page.getByRole('button',{name:'Clear saved squishy'}).click();expect(await page.evaluate(()=>localStorage.getItem('squishy-spec-v1'))).toBeNull();
});
test('mobile can scroll on the render background and tap the options shortcut',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  try{
    await ready(page);const box=(await page.locator('#squishy').boundingBox())!,session=await context.newCDPSession(page),x=box.x+box.width*.08,y=box.y+box.height*.5;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-180,id:1}]});await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('#state')).not.toHaveText('Being squished');
    await page.evaluate(()=>window.scrollTo(0,0));await page.getByRole('link',{name:'Shapes & styles ↓'}).tap();await expect(page).toHaveURL(/#collection$/);expect((await page.locator('#collection').boundingBox())!.y).toBeLessThan(100);
  }finally{await context.close();}
});
test('touch pressure survives vertical finger movement until release, including fullscreen',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  try{
    await ready(page);const session=await context.newCDPSession(page);
    for(const fullscreen of [false,true]){
      if(fullscreen)await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
      const box=(await page.locator('#squishy').boundingBox())!,x=box.x+box.width*.5,y=box.y+box.height*.5,initialScroll=await page.evaluate(()=>scrollY);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await expect(page.locator('#state')).toHaveText('Being squished');await page.waitForTimeout(700);
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-40,id:1}]});await page.waitForTimeout(300);await expect(page.locator('#state')).toHaveText('Being squished');expect(await page.evaluate(()=>scrollY)).toBe(initialScroll);
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y+35,id:1}]});await page.waitForTimeout(300);await expect(page.locator('#state')).toHaveText('Being squished');
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('#state')).not.toHaveText('Being squished');
    }
  }finally{await context.close();}
});
test('stationary touch maintains pressure for the full sustained hold and releases on lift',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  try{
    await ready(page);const box=(await page.locator('#squishy').boundingBox())!,session=await context.newCDPSession(page),x=box.x+box.width*.5,y=box.y+box.height*.5,initialScroll=await page.evaluate(()=>scrollY);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(const delay of [700,2000,3500]){
      await page.waitForTimeout(delay);await expect(page.locator('#state')).toHaveText('Being squished');expect(await page.evaluate(()=>(window.__squishy!.snapshot() as {contact:unknown}).contact)).not.toBeNull();
    }
    expect(await page.evaluate(()=>scrollY)).toBe(initialScroll);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('#state')).not.toHaveText('Being squished');expect(await page.evaluate(()=>(window.__squishy!.snapshot() as {contact:unknown}).contact)).toBeNull();
  }finally{await context.close();}
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
    await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('#state')).not.toHaveText('Being squished');
    await page.getByRole('button',{name:'Clear saved squishy'}).click();await expect(page.locator('#status')).toContainText('cleared');
  }finally{await context.close();}
});
