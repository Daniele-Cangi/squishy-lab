import { afterEach,describe,it,expect,vi } from 'vitest';
import { DEFAULT_SPEC } from '../../src/shared/spec';
import { handleApi, infer, type Env, ApiError, deadline } from '../../worker/api';
import { protectedFields,validateRecoveryDirection } from '../../src/shared/protection';
const body={version:1 as const,mode:'modify' as const,prompt:'Uguale, ma meno molle.',current:DEFAULT_SPEC};
function request(data:unknown=body,headers:Record<string,string>={},url='http://localhost/api/squishy'){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof data==='string'?data:JSON.stringify(data)});}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('Same-origin bounded API',()=>{
  it('accepts a bounded no-op at recovery limits while rejecting the opposite direction',()=>{
    expect(()=>validateRecoveryDirection('Faster recovery.',{...DEFAULT_SPEC,recoverySeconds:.3},{recoverySeconds:.3})).not.toThrow();
    expect(()=>validateRecoveryDirection('Slower recovery.',{...DEFAULT_SPEC,recoverySeconds:12},{recoverySeconds:12})).not.toThrow();
    expect(()=>validateRecoveryDirection('Faster recovery.',{...DEFAULT_SPEC,recoverySeconds:.3},{recoverySeconds:.5})).toThrow();
    expect(()=>validateRecoveryDirection('Slower recovery.',{...DEFAULT_SPEC,recoverySeconds:12},{recoverySeconds:11})).toThrow();
  });
  it('detects explicit protected fields without inventing a material edit',()=>{
    expect(protectedFields('Keep the color and shape, but make it softer.')).toEqual(['color','proportions']);
    expect(protectedFields('Più morbido, ma con lo stesso tempo di recupero.')).toEqual(['recoverySeconds']);
    expect(protectedFields('Non più morbido: deve solo tornare lentamente.')).toEqual(['softness']);
    expect(protectedFields('Non più morbido, ma più sodo.')).toEqual([]);
    expect(protectedFields('Same, but less soft.')).toEqual([]);
    expect(protectedFields('Keep the silhouette and shade, reduce softness and speed up recovery.')).toEqual(['color','proportions']);
  });
  it('repairs a contradictory recovery direction instead of applying the opposite meaning',async()=>{
    const run=vi.fn().mockResolvedValueOnce({response:JSON.stringify({version:1,status:'ok',patch:{recoverySeconds:6.75}})}).mockResolvedValueOnce({response:JSON.stringify({version:1,status:'ok',patch:{recoverySeconds:2.025}})});
    const result=await infer({...body,prompt:'Accorcia la risalita.'},{PROVIDER:'workers-ai',AI:{run}});
    expect(result.spec.recoverySeconds).toBeLessThan(DEFAULT_SPEC.recoverySeconds);expect(result.repaired).toBe(true);expect(run).toHaveBeenCalledTimes(2);
  });
  it('rejects an edit to an explicitly protected field, repairs once, and never substitutes a preset',async()=>{
    const run=vi.fn().mockResolvedValueOnce({response:JSON.stringify({version:1,status:'ok',patch:{color:'#77c8ea',recoverySeconds:1.5}})}).mockResolvedValueOnce({response:JSON.stringify({version:1,status:'ok',patch:{recoverySeconds:1.5}})});
    const observations:unknown[]=[];
    const result=await infer({...body,prompt:'Non cambiare colore: fallo riprendere più velocemente.'},{PROVIDER:'workers-ai',AI:{run}},undefined,v=>observations.push(v));
    expect(result.spec.color).toBe(DEFAULT_SPEC.color);expect(result.patch).toEqual({recoverySeconds:1.5});expect(result.repaired).toBe(true);expect(observations).toEqual([{schemaValid:true,protectedFieldsRejected:true},{schemaValid:true,protectedFieldsRejected:false}]);
    run.mockResolvedValue({response:JSON.stringify({version:1,status:'ok',patch:{color:'#77c8ea'}})});await expect(infer({...body,prompt:'Keep the color.'},{PROVIDER:'workers-ai',AI:{run}})).rejects.toMatchObject({code:'invalid_output'});
  });
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
  it.each(['invalid JSON','JSON Mode could not be met'])('does not start a repair after the total budget expires: %s',async failure=>{
    const now=vi.spyOn(Date,'now').mockReturnValue(0);
    const run=vi.fn().mockImplementation(async()=>{
      now.mockReturnValue(18000);
      if(failure.startsWith('JSON Mode'))throw new Error("JSON Mode couldn't be met");
      return {response:failure};
    });
    await expect(infer(body,{PROVIDER:'workers-ai',AI:{run}})).rejects.toMatchObject({code:'timeout'});expect(run).toHaveBeenCalledOnce();
  });
  it('cancels awaiting work and never repairs a late invalid binding response',async()=>{
    const controller=new AbortController();let finish!:(result:unknown)=>void;
    const run=vi.fn().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=infer(body,{PROVIDER:'workers-ai',AI:{run}},controller.signal);
    const assertion=expect(pending).rejects.toMatchObject({code:'cancelled'});controller.abort();await assertion;
    finish({response:'invalid JSON'});await Promise.resolve();expect(run).toHaveBeenCalledOnce();
    await expect(infer(body,{PROVIDER:'workers-ai',AI:{run}},controller.signal)).rejects.toMatchObject({code:'cancelled'});expect(run).toHaveBeenCalledOnce();
  });
  it('a deadline rejects the caller without claiming to cancel the binding',async()=>{
    let finish!:(result:unknown)=>void;const run=vi.fn().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    vi.useFakeTimers();
    try{const pending=infer(body,{PROVIDER:'workers-ai',AI:{run}});const assertion=expect(pending).rejects.toMatchObject({code:'timeout'});await vi.advanceTimersByTimeAsync(18000);await assertion;finish({response:'invalid JSON'});await Promise.resolve();expect(run).toHaveBeenCalledOnce();}
    finally{vi.useRealTimers();}
  });
});
