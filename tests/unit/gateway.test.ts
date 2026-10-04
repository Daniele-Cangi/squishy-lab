import {it,expect,vi,afterEach} from 'vitest';
import {proxyApi} from '../../server/gateway';
import {handleApi,type Env} from '../../worker/api';
import {DEFAULT_SPEC} from '../../src/shared/spec';
const origin='https://squishy.example',upstream='https://private.workers.dev',secret='test-only-gateway';
const settings={SQUISHY_AI_URL:upstream,SQUISHY_GATEWAY_SECRET:secret};
afterEach(()=>vi.unstubAllGlobals());
it('unconfigured public API fails closed, with presets still available',async()=>{expect(await(await proxyApi(new Request(origin+'/api/config'),{})).json()).toEqual({provider:'disabled'});expect((await proxyApi(new Request(origin+'/api/squishy',{method:'POST'}),{})).status).toBe(503);});
it('gateway rejects foreign origins, invalid IPs and oversized bodies before reaching AI',async()=>{
 const call=vi.fn();vi.stubGlobal('fetch',call);
 for(const [headers,body,status]of [[{'Content-Type':'application/json',Origin:'https://evil.example','x-forwarded-for':'192.0.2.1'},'{}',403],[{'Content-Type':'application/json'},'{}',403],[{'Content-Type':'application/json','x-forwarded-for':'192.0.2.1'},'x'.repeat(9000),413]]as const)expect((await proxyApi(new Request(origin+'/api/squishy',{method:'POST',headers,body}),settings)).status).toBe(status);
 expect(call).not.toHaveBeenCalled();
});
it('gateway forwards only server-owned credentials and the verified platform IP',async()=>{
 const call=vi.fn().mockResolvedValue(new Response('{"message":"rate"}',{status:429}));vi.stubGlobal('fetch',call);
 const response=await proxyApi(new Request(origin+'/api/squishy',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'x-forwarded-for':'192.0.2.1','X-Squishy-Gateway':'forged','X-Squishy-Client-IP':'203.0.113.2'},body:'{}'}),settings);
 const [target,init]=call.mock.calls[0] as [URL,RequestInit];expect(target.href).toBe(upstream+'/api/squishy');expect(new Headers(init.headers).get('X-Squishy-Gateway')).toBe(secret);expect(new Headers(init.headers).get('X-Squishy-Client-IP')).toBe('192.0.2.1');expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('60');expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('private Worker rejects direct requests, missing secrets and foreign app origins',async()=>{
 for(const env of [{PUBLIC_ORIGIN:origin},{PUBLIC_ORIGIN:origin,GATEWAY_SECRET:secret}])expect((await handleApi(new Request(upstream+'/api/config'),env)).status).toBe(403);
 const request=new Request(upstream+'/api/squishy',{method:'POST',headers:{'X-Squishy-Gateway':secret,Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});expect((await handleApi(request,{PUBLIC_ORIGIN:origin,GATEWAY_SECRET:secret})).status).toBe(403);
});
it('private Worker validates the public Turnstile hostname and rates the real client',async()=>{
 const rate=vi.fn().mockResolvedValue({success:true}),run=vi.fn().mockResolvedValue({version:1,status:'ok',patch:{softness:.5},message:'Firmer.'});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,hostname:'squishy.example',action:'squishy'}))));
 const env:Env={PUBLIC_ORIGIN:origin,GATEWAY_SECRET:secret,PROVIDER:'workers-ai',TURNSTILE_SECRET:'test-only',TURNSTILE_SITE_KEY:'public-test',AI_RATE:{limit:rate},BURST_RATE:{limit:vi.fn().mockResolvedValue({success:true})},AI:{run}};
 const response=await handleApi(new Request(upstream+'/api/squishy',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Squishy-Gateway':secret,'X-Squishy-Client-IP':'192.0.2.10','CF-Connecting-IP':'203.0.113.20'},body:JSON.stringify({version:1,mode:'modify',current:DEFAULT_SPEC,prompt:'Firmer.',turnstileToken:'test-token'})}),env);
 expect(response.status).toBe(200);expect(rate).toHaveBeenCalledWith({key:'192.0.2.10'});expect(run).toHaveBeenCalledOnce();expect((await response.json()).spec.softness).toBe(.5);
});
