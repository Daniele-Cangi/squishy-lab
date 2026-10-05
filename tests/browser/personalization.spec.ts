import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('clearing a squishy cancels lettering waiting for a font',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__squishy);
 await page.evaluate(async()=>{
  await document.fonts.ready;
  const load=document.fonts.load.bind(document.fonts);
  const target=window as unknown as {releaseFont:()=>void};
  document.fonts.load=()=>new Promise<FontFace[]>(resolve=>{target.releaseFont=()=>{document.fonts.load=load;resolve([]);};});
 });
 await page.getByLabel('A little message').fill('OLD MESSAGE');
 await page.getByRole('button',{name:'Clear saved squishy',exact:true}).click();
 await page.evaluate(async()=>{
  (window as unknown as {releaseFont:()=>void}).releaseFont();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 });
 await expect(page.getByLabel('A little message')).toHaveValue('');
 const saved=await page.evaluate(()=>({appearance:localStorage.getItem('squishy-appearance-v1'),spec:localStorage.getItem('squishy-spec-v1')}));
 expect(saved).toEqual({appearance:null,spec:null});
 const snapshot=await page.evaluate(()=>window.__squishy!.snapshot()) as {appearance:{face:boolean;text?:string}};
 expect(snapshot.appearance.face).toBe(true);expect(snapshot.appearance.text).toBeUndefined();
});
test('cute lettering persists, follows shape changes and exports PNG',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__squishy);await page.getByLabel('A little message').fill('Hello August');await expect.poll(async()=>((await page.evaluate(()=>window.__squishy!.snapshot())) as {appearance:{text?:string}}).appearance.text).toBe('Hello August');
 await page.getByLabel('Text color').fill('#ed4b91');await expect.poll(async()=>((await page.evaluate(()=>window.__squishy!.snapshot())) as {appearance:{textColor?:string}}).appearance.textColor).toBe('#ed4b91');
 for(const name of ['Baloo 2','Pacifico','Short Stack','Chewy']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.getByRole('button',{name:'Cat',exact:true}).click();await expect(page.getByLabel('A little message')).toHaveValue('Hello August');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG ↓',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('my-squishy.png');const bytes=await readFile((await download.path())!);expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(bytes.length).toBeGreaterThan(10000);
 await page.reload();await expect(page.getByLabel('Text color')).toHaveValue('#ed4b91');await expect(page.getByLabel('A little message')).toHaveValue('Hello August');await page.getByLabel('A little message').fill('');await expect.poll(async()=>((await page.evaluate(()=>window.__squishy!.snapshot())) as {appearance:{text?:string;face:boolean}}).appearance.text).toBe('');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

