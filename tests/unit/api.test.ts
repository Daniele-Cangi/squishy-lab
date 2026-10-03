import { afterEach,describe,it,expect,vi } from 'vitest';
import { DEFAULT_SPEC } from '../../src/shared/spec';
import { handleApi, infer, type Env, ApiError, deadline } from '../../worker/api';
const body={version:1,mode:'modify' as const,prompt:'Uguale, ma meno molle.',current:DEFAULT_SPEC};
function request(data:unknown=body,headers:Record<string,string>={},url='http://localhost/api/squishy'){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof data==='string'?data:JSON.stringify(data)});}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('Same-origin bounded API',()=>{
  it('performs a contextual local mock patch and identifies its provider',async()=>{
    const response=await handleApi(request(),{PROVIDER:'mock'});expect(response.status).toBe(200);const data=await response.json();expect(data.provider).toBe('mock');expect(data.spec.softness).toBeLessThan(DEFAULT_SPEC.softness);expect(data.spec.color).toBe(DEFAULT_SPEC.color);
  });
  it.each(['{}','not json','x'.repeat(9000)])('rejects malformed/large request without a model call',async value=>{const ai=vi.fn();const response=await handleApi(request(value),{PROVIDER:'workers-ai',AI:{run:ai}});expect([400,413]).toContain(response.status);expect(ai).not.toHaveBeenCalled();});
  it('refuses cross origin, bad content type and an accidentally deployed mock',async()=>{
    expect((await handleApi(request(body,{origin:'https://evil.example'}),{PROVIDER:'mock'})).status).toBe(403);
    expect((await handleApi(request(body,{'content-type':'text/plain'}),{PROVIDER:'mock'})).status).toBe(415);
    expect((await handleApi(request(body,{},'https://squishy.example/api/squishy'),{PROVIDER:'mock'})).status).toBe(503);
  });
  it('fails closed when live protection is absent',async()=>{const run=vi.fn();expect((await handleApi(request(),{PROVIDER:'workers-ai',AI:{run}})).status).toBe(503);expect(run).not.toHaveBeenCalled();});
  it('rejects rate-limited traffic before provider work',async()=>{
    const run=vi.fn(),env:Env={PROVIDER:'workers-ai',AI:{run},TURNSTILE_SECRET:'fixture',TURNSTILE_SITE_KEY:'fixture',AI_RATE:{limit:async()=>({success:false})},BURST_RATE:{limit:async()=>({success:true})}};
    const response=await handleApi(request({...body,turnstileToken:'fixture'},{'CF-Connecting-IP':'192.0.2.1'}),env);expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('60');expect(run).not.toHaveBeenCalled();
  });
  it('checks Turnstile action and hostname on the server',async()=>{
    const run=vi.fn().mockResolvedValue({response:JSON.stringify({version:1,status:'ok',patch:{softness:.5}})});
    const env:Env={PROVIDER:'workers-ai',AI:{run},TURNSTILE_SECRET:'fixture',TURNSTILE_SITE_KEY:'fixture',AI_RATE:{limit:async()=>({success:true})},BURST_RATE:{limit:async()=>({success:true})}};
    const fetch=vi.fn().mockResolvedValue(Response.json({success:true,hostname:'evil.example',action:'squishy'}));vi.stubGlobal('fetch',fetch);
    expect((await handleApi(request({...body,turnstileToken:'fixture'},{'CF-Connecting-IP':'192.0.2.1'}),env)).status).toBe(403);expect(run).not.toHaveBeenCalled();
    fetch.mockResolvedValue(Response.json({success:true,hostname:'localhost',action:'squishy'}));expect((await handleApi(request({...body,turnstileToken:'fixture'},{'CF-Connecting-IP':'192.0.2.1'}),env)).status).toBe(200);expect(run).toHaveBeenCalledOnce();
  });
  it('repairs invalid model output once and never retries provider quota errors',async()=>{
    const run=vi.fn().mockResolvedValueOnce({response:'not JSON'}).mockResolvedValueOnce({response:'{"version":1,"status":"ok","patch":{"softness":0.5}}'});
    const result=await infer({...body,version:1},{PROVIDER:'workers-ai',AI:{run}});expect(result.repaired).toBe(true);expect(run).toHaveBeenCalledTimes(2);
    const failed=vi.fn().mockResolvedValue({response:'{"code":"bad"}'});await expect(infer({...body,version:1},{PROVIDER:'workers-ai',AI:{run:failed}})).rejects.toMatchObject({status:502});expect(failed).toHaveBeenCalledTimes(2);
    const quota=vi.fn().mockRejectedValue(new Error('daily neuron quota exceeded'));await expect(infer({...body,version:1},{PROVIDER:'workers-ai',AI:{run:quota}})).rejects.toMatchObject({code:'quota'});expect(quota).toHaveBeenCalledOnce();
  });
  it('does not expose provider internals and bounds operation duration',async()=>{
    await expect(deadline(new Promise(()=>{}),10)).rejects.toBeInstanceOf(ApiError);
    const response=await handleApi(request(),{PROVIDER:'disabled'});expect(response.status).toBe(503);expect(await response.text()).not.toContain('fixture');
  });
});
