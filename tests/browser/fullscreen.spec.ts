import {test,expect} from '@playwright/test';
test('mobile viewport fullscreen preserves the squishy and restores controls, focus and scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('Unsupported mobile fullscreen'));});
 await page.goto('/');await page.waitForFunction(()=>!!window.__squishy);await page.clock.install();
 const before=await page.evaluate(()=>window.__squishy!.snapshot() as {spec:unknown});
 await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();const area=page.getByRole('dialog',{name:'Playground'});await expect(area).toBeVisible();
 expect(await area.boundingBox()).toMatchObject({x:0,y:0,width:390,height:844});await expect(page.getByRole('button',{name:'Reset shape in fullscreen'})).toBeVisible();
 expect(await page.locator('.controls-column').evaluate(el=>(el as HTMLElement).inert)).toBe(true);
 await page.evaluate(()=>window.__squishy!.press());await page.clock.runFor(2000);const pressed=await page.evaluate(()=>window.__squishy!.snapshot() as {maxDisplacement:number;spec:unknown});expect(pressed.maxDisplacement).toBeGreaterThan(.08);expect(pressed.spec).toEqual(before.spec);
 await page.getByRole('button',{name:'Exit fullscreen',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.locator('#sound-mode')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Enter fullscreen',exact:true})).toBeFocused();expect(await page.locator('.controls-column').evaluate(el=>(el as HTMLElement).inert)).toBe(false);expect(await page.locator('body').evaluate(el=>(el as HTMLElement).style.overflow)).toBe('');
 await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();expect(await page.getByRole('dialog').boundingBox()).toMatchObject({width:844,height:390});await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('native fullscreen and browser exit restore the playground',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.evaluate(()=>document.exitFullscreen());await expect(page.getByRole('button',{name:'Enter fullscreen',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
});


