import {test,expect} from '@playwright/test';

test('the homepage links to a separate guide that works without JavaScript',async({browser,request})=>{
  const response=await request.get('/');
  expect(response.status()).toBe(200);
  const html=await response.text();
  expect(html).toContain('Guide &amp; FAQ');
  expect(html).not.toContain('What can I ask the AI to change?');
  expect(html).toContain('https://www.squishylab.fun/');
  expect(html).not.toContain('Local demo · no AI');
  expect(html).not.toContain('Built with Llama');
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:5173/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#mode-badge')).toHaveText('Squishy playground');
    await expect(page.locator('#about')).toHaveCount(0);
    await page.getByRole('link',{name:'Guide & FAQ'}).click();
    await expect(page).toHaveURL('http://127.0.0.1:5173/guide/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading',{name:'Your free online squishy simulator'})).toBeVisible();
    await page.getByText('What can I ask the AI to change?',{exact:true}).click();
    await expect(page.getByText('Describe material edits in English,',{exact:false})).toBeVisible();
    await page.getByRole('link',{name:'Back to squishing'}).click();
    await expect(page).toHaveURL('http://127.0.0.1:5173/');
    await expect(page.locator('h1')).toContainText('Happiness');
  } finally {await context.close();}
});

for(const [model,label] of [['@cf/qwen/qwen3-30b-a3b-fp8','Qwen3 · Cloudflare Workers AI'],['@cf/meta/llama-3.1-8b-instruct','Built with Llama · Cloudflare Workers AI'],[undefined,'Cloudflare Workers AI']] as const){
  test(`the runtime credit matches the configured model: ${model??'unspecified'}`,async({page})=>{
    await page.route('**/api/config',route=>route.fulfill({json:{provider:'workers-ai',model}}));
    await page.goto('/');
    await expect(page.locator('#mode-badge')).toHaveText('AI · Cloudflare');
    await expect(page.locator('#model-credit')).toBeVisible();
    await expect(page.locator('#model-credit')).toHaveText(label);
  });
}

test('client initialization preserves one static page and enables personalization',async({page})=>{
  await page.goto('/');
  await page.waitForFunction(()=>!!window.__squishy);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('#about')).toHaveCount(0);
  await page.getByRole('button',{name:'Jelly cube',exact:true}).click();
  await expect(page.locator('#material-name')).toHaveText('Jelly cube');
  await page.locator('#custom-text').fill('Hello, sunshine!');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('squishy-appearance-v1')??'{}').text)).toBe('Hello, sunshine!');
});
