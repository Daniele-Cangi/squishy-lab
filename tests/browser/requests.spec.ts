import { test,expect } from '@playwright/test';
import { DEFAULT_SPEC } from '../../src/shared/spec';

test('consumed verification is renewed on send; cancellation and old callbacks cannot reuse or clear tokens',async({page})=>{
  const sent:string[]=[];
  await page.route('**/api/config',route=>route.fulfill({json:{provider:'workers-ai',siteKey:'public-test-fixture'}}));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*',route=>route.fulfill({contentType:'application/javascript',body:`
    const callbacks=[];
    window.__verificationFixture={callbacks};
    window.turnstile={
      render(element,options){callbacks.push(options);return String(callbacks.length);},
      reset(){},remove(){}
    };` }));
  await page.route('**/api/squishy',async route=>{
    const request=route.request().postDataJSON();sent.push(request.turnstileToken);
    await new Promise(resolve=>setTimeout(resolve,1200));
    await route.fulfill({json:{version:1,status:'ok',provider:'workers-ai',patch:{softness:.5},spec:{...(request.current??DEFAULT_SPEC),softness:.5},repaired:false,corrections:[],message:'Squishy updated.'}}).catch(()=>{});
  });
  await page.goto('/');await expect(page.locator('#mode-badge')).toHaveText('AI · Cloudflare');
  const complete=async(token:string,index:number)=>page.evaluate(({token,index})=>{
    const fixture=(window as unknown as {__verificationFixture:{callbacks:{callback:(token:string)=>void}[]}}).__verificationFixture;
    fixture.callbacks[index].callback(token);
  },{token,index});
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {__verificationFixture:{callbacks:unknown[]}}).__verificationFixture?.callbacks.length)).toBe(1);
  expect(await page.evaluate(()=>{const options=(window as unknown as {__verificationFixture:{callbacks:Record<string,unknown>[]}}).__verificationFixture.callbacks[0];return {language:options.language,size:options.size,appearance:options.appearance};})).toEqual({language:'en',size:'compact',appearance:'interaction-only'});
  await complete('fixture-one',0);await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('A little firmer');await page.locator('#generate').click();await expect.poll(()=>sent.length).toBe(1);
  await page.getByRole('button',{name:'Peach mochi Foam · a little firmer'}).click();
  await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('Softer');await page.locator('#generate').click();await expect(page.locator('#status')).toContainText('Complete verification');expect(sent).toEqual(['fixture-one']);
  await complete('fixture-stale',0);await page.locator('#generate').click();expect(sent).toEqual(['fixture-one']);
  await complete('fixture-two',1);await page.locator('#generate').click();await expect.poll(()=>sent.length).toBe(2);expect(sent).toEqual(['fixture-one','fixture-two']);
  await complete('fixture-three',2);await expect(page.locator('#generate')).toBeEnabled();
  await page.locator('#generate').click();await expect.poll(()=>sent.length).toBe(3);expect(sent[2]).toBe('fixture-three');
  await page.getByRole('button',{name:'Reset shape'}).click();await complete('fixture-four',3);await page.locator('#generate').click();await expect.poll(()=>sent.length).toBe(4);expect(sent[3]).toBe('fixture-four');
});

test('client timeout leaves the object playable and retains the next verification generation',async({page})=>{
  const sent:string[]=[];await page.clock.install();
  await page.route('**/api/config',route=>route.fulfill({json:{provider:'workers-ai',siteKey:'public-test-fixture'}}));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.__verificationFixture={callbacks:[]};window.turnstile={render(element,options){window.__verificationFixture.callbacks.push(options);return String(window.__verificationFixture.callbacks.length);},remove(){}};`}));
  const held:import('@playwright/test').Route[]=[];
  await page.route('**/api/squishy',route=>{sent.push(route.request().postDataJSON().turnstileToken);held.push(route);});
  await page.goto('/');await expect(page.locator('#mode-badge')).toHaveText('AI · Cloudflare');
  const complete=(token:string,index:number)=>page.evaluate(({token,index})=>(window as unknown as {__verificationFixture:{callbacks:{callback:(token:string)=>void}[]}}).__verificationFixture.callbacks[index].callback(token),{token,index});
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {__verificationFixture:{callbacks:unknown[]}}).__verificationFixture?.callbacks.length)).toBe(1);
  await complete('timeout-one',0);await page.getByRole('textbox',{name:'Color, softness, recovery…',exact:true}).fill('A little firmer');await page.locator('#generate').click();await expect.poll(()=>sent.length).toBe(1);
  await complete('next-token',1);await page.clock.fastForward(26001);await expect(page.locator('#status')).toContainText('timed out');await expect(page.locator('#generate')).toBeEnabled();
  await complete('stale-token',0);await page.locator('#generate').click();await expect.poll(()=>sent.length).toBe(2);expect(sent).toEqual(['timeout-one','next-token']);
  await page.getByRole('button',{name:'Reset shape'}).click();await page.evaluate(()=>window.__squishy!.press());await expect(page.locator('#state')).toHaveText('Being squished');
  for(const route of held)await route.abort().catch(()=>{});
});
