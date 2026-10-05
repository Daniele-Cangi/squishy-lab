import assert from 'node:assert/strict';

const origin='https://www.squishylab.fun';
const checks:string[]=[];
async function get(path:string){return fetch(new URL(path,origin),{redirect:'manual',signal:AbortSignal.timeout(15000)});}
const home=await get('/');
assert.equal(home.status,200);
assert.ok(!home.headers.get('x-robots-tag')?.includes('noindex'));
const html=await home.text();
assert.ok(html.includes(`<link rel="canonical" href="${origin}/"`));
assert.ok(html.includes('href="/guide/"'));
assert.ok(!html.includes('What can I ask the AI to change?'));
assert.equal((html.match(/<h1[\s>]/g)??[]).length,1);
assert.ok(!html.includes('squishy-lab-phi.vercel.app'));
const structured=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert.ok(structured);
const data=JSON.parse(structured[1]);
assert.ok(data['@graph'].some((item:{'@type':string;url:string})=>item['@type']==='WebApplication'&&item.url===origin+'/'));
const guide=await get('/guide/');assert.equal(guide.status,200);
const guideHtml=await guide.text();
assert.ok(guideHtml.includes(`<link rel="canonical" href="${origin}/guide/"`));
assert.ok(guideHtml.includes('Your free online squishy simulator'));
assert.ok(guideHtml.includes('What can I ask the AI to change?'));
assert.equal((guideHtml.match(/<h1[\s>]/g)??[]).length,1);
checks.push('Canonical, metadata, linked static guide and structured data');
const robots=await get('/robots.txt');assert.equal(robots.status,200);
assert.ok(robots.headers.get('content-type')?.includes('text/plain'));
const policy=await robots.text();assert.ok(policy.includes('Allow: /'));assert.ok(policy.includes('Disallow: /api/'));assert.ok(policy.includes(`Sitemap: ${origin}/sitemap.xml`));
const sitemap=await get('/sitemap.xml');assert.equal(sitemap.status,200);
assert.ok(sitemap.headers.get('content-type')?.includes('xml'));
const xml=await sitemap.text();assert.ok(xml.includes(`<loc>${origin}/</loc>`));assert.ok(xml.includes(`<loc>${origin}/guide/</loc>`));assert.equal((xml.match(/<loc>/g)??[]).length,2);
const llms=await get('/llms.txt');assert.equal(llms.status,200);assert.ok((await llms.text()).includes(`${origin}/guide/`));
checks.push('Robots, sitemap and AI-readable summary');
for(const old of ['https://squishylab.fun/','https://squishy-lab-phi.vercel.app/']){
  const response=await fetch(old,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  assert.ok([301,308].includes(response.status));assert.equal(response.headers.get('location'),origin+'/');
}
const index=await get('/index.html');assert.ok([301,308].includes(index.status));assert.equal(new URL(index.headers.get('location')!,origin).href,origin+'/');
const missing=await get('/this-page-does-not-exist');assert.equal(missing.status,404);
checks.push('Permanent domain redirects and real 404 response');
const image=await get('/share-preview.png');assert.equal(image.status,200);assert.ok(image.headers.get('content-type')?.includes('image/png'));
const config=await get('/api/config');assert.equal(config.status,200);assert.ok(config.headers.get('x-robots-tag')?.includes('noindex'));
assert.equal((await config.json() as {provider:string}).provider,'workers-ai');
checks.push('Social preview and same-origin AI configuration');
console.log(JSON.stringify({origin,checks,passed:true},null,2));
