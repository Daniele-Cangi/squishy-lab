import {test,expect} from '@playwright/test';
test('default gel starts on first squeeze and responsive controls stay ordered',async({page})=>{
 let gel=0;page.on('request',r=>{if(r.url().endsWith('/audio/gel.mp3'))gel++;});
 await page.setViewportSize({width:1280,height:900});await page.goto('/');await page.waitForFunction(()=>!!window.__squishy);
 await expect(page.getByRole('button',{name:'Disable squishy sound'})).toHaveAttribute('aria-pressed','true');expect(gel).toBe(0);
 const stage=await page.locator('.play-area').boundingBox(),collection=await page.locator('.collection').boundingBox(),ai=await page.locator('.composer').boundingBox();expect(collection!.x).toBeGreaterThan(stage!.x+stage!.width);expect(ai!.y).toBeGreaterThan(collection!.y);
 await page.locator('#squeeze').dispatchEvent('pointerdown');await expect.poll(()=>gel).toBe(1);await expect(page.locator('#sound')).toBeEnabled();await page.locator('#squeeze').dispatchEvent('pointerup');
 await page.getByLabel('Sound texture').selectOption('crunchy');await expect(page.locator('#sound')).toBeEnabled();await page.getByRole('button',{name:'Disable squishy sound'}).click();await expect(page.getByRole('button',{name:'Enable squishy sound'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});const mobileStage=await page.locator('.play-area').boundingBox(),mobileCollection=await page.locator('.collection').boundingBox();expect(mobileCollection!.y).toBeGreaterThan(mobileStage!.y+mobileStage!.height);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await expect(page.getByLabel('Sound texture')).toBeVisible();await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
});
