import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evidenceContext} from './evidence';
import type {SquishySpec} from '../src/shared/spec';
const origin='https://squishy-lab-phi.vercel.app',directory=resolve('evidence/vercel-release');mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const configResponse=await page.request.get(origin+'/api/config'),config=await configResponse.json();expect(configResponse.status()).toBe(200);expect(config.provider).toBe('workers-ai');
 const privateResponse=await page.request.get('https://squishy-lab-ai.daniele-cangi-squishy.workers.dev/api/config');expect(privateResponse.status()).toBe(403);
 const unverified=await page.request.post(origin+'/api/squishy',{headers:{Origin:origin},data:{version:1,mode:'create',prompt:'A purple mochi, very soft.'}});expect(unverified.status()).toBe(403);
 await page.goto(origin+'/?evidence');await expect(page.locator('#mode-badge')).toHaveText('AI · Cloudflare');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.waitForFunction(()=>!!window.__squishy&&(window.__squishy.snapshot() as {detailsReady:boolean}).detailsReady);
 const before=await page.evaluate(()=>(window.__squishy!.snapshot() as {spec:SquishySpec}).spec);let after=before,realAI:number|undefined,body:unknown;
 if(process.argv.includes('--ai')){
 await page.getByRole('textbox').fill('Same, but a little firmer.');
 // Observe readiness only. The production widget obtains a genuine token;
 // this verifier never creates, prints, persists or bypasses a challenge token.
 await page.waitForFunction(()=>!!document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value,null,{timeout:45000});
 const responsePromise=page.waitForResponse(r=>r.url()===origin+'/api/squishy'&&r.request().method()==='POST');await page.locator('#generate').click();const response=await responsePromise;body=await response.json();realAI=response.status();expect(realAI).toBe(200);
 await expect(page.locator('#comparison-row')).toBeVisible({timeout:25000});after=await page.evaluate(()=>(window.__squishy!.snapshot() as {spec:SquishySpec}).spec);expect(after.softness).toBeLessThan(before.softness);expect(after.color).toBe(before.color);expect(after.recoverySeconds).toBe(before.recoverySeconds);
 }
 await page.screenshot({path:resolve(directory,'production-desktop.png'),fullPage:true});await page.getByRole('button',{name:'Happy face',exact:true}).click();await page.getByRole('button',{name:'Clear ✦',exact:true}).click();await page.locator('#squishy').screenshot({path:resolve(directory,'production-clear-mochi.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(directory,'production-mobile.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);expect(errors).toEqual([]);
 writeFileSync(resolve(directory,realAI?'automated-ai.json':'release.json'),JSON.stringify({...evidenceContext(),origin,conditions:realAI?'Production Vercel Node gateway → authenticated Cloudflare Worker → genuine Turnstile → Workers AI. Synthetic English prompt, installed headless Chrome.':'Production UI and HTTP protections checked with installed headless Chrome. Zero inference in this run. Real AI separately verified in Codex in-app browser; see production-ui.txt and production-ai.jpg. Automated Chrome was not granted a challenge token; no bypass attempted.',http:{config:configResponse.status(),privateWorker:privateResponse.status(),missingTurnstile:unverified.status(),realAI},config,before,after,response:body,errors},null,2));console.log(JSON.stringify({origin,realAI:realAI??'separate IAB verification',errors}));
}finally{await browser.close();}
