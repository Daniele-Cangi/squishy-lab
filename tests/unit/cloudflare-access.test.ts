import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const child=vi.hoisted(()=>({sync:vi.fn(),async:vi.fn()}));
vi.mock('node:child_process',()=>({execFileSync:child.sync,execFile:child.async}));
import { liveAi } from '../../scripts/cloudflare-access';
beforeEach(()=>{
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID','fixture-account');vi.stubEnv('CLOUDFLARE_API_TOKEN',undefined);vi.stubEnv('SQUISHY_WORKERS_FREE_CONFIRMED','1');
  child.sync.mockReturnValue(JSON.stringify({type:'oauth',token:'startup-fixture'}));
  child.async.mockImplementation((_file,_args,_options,callback)=>{callback(null,JSON.stringify({type:'oauth',token:'current-fixture'}),'');});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
it('retrieves current Wrangler credentials before each inference, preserving the session call cap',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({}, {status:403})).mockImplementation(async()=>Response.json({success:true,result:{response:'fixture'}}));vi.stubGlobal('fetch',fetch);
  const session=await liveAi(2);await session.ai.run('fixture-model',{});
  child.async.mockImplementation((_file,_args,_options,callback)=>{callback(null,JSON.stringify({type:'oauth',token:'renewed-fixture'}),'');});
  await session.ai.run('fixture-model',{});
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer current-fixture');expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer renewed-fixture');
  await expect(session.ai.run('fixture-model',{})).rejects.toMatchObject({status:429,code:'evaluation_limit'});expect(child.async).toHaveBeenCalledTimes(2);expect(fetch).toHaveBeenCalledTimes(3);
});
it('does not refresh explicit environment credentials or retry rejected inference',async()=>{
  vi.stubEnv('CLOUDFLARE_API_TOKEN','environment-fixture');const fetch=vi.fn().mockResolvedValueOnce(Response.json({}, {status:403})).mockResolvedValueOnce(Response.json({success:false},{status:401}));vi.stubGlobal('fetch',fetch);
  const session=await liveAi(2);await expect(session.ai.run('fixture-model',{})).rejects.toThrow('401');
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer environment-fixture');expect(child.sync).not.toHaveBeenCalled();expect(child.async).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(2);
});
it('cancellation during token retrieval prevents inference and does not expose credential output',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({}, {status:403}));vi.stubGlobal('fetch',fetch);
  const session=await liveAi(2),controller=new AbortController();
  child.async.mockImplementation((_file,_args,_options,callback)=>{controller.abort();callback(null,JSON.stringify({token:'private-fixture'}),'');});
  await expect(session.binding(controller.signal).run('fixture-model',{})).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce();
  controller.abort();await expect(session.binding(controller.signal).run('fixture-model',{})).rejects.toThrow();expect(child.async).toHaveBeenCalledOnce();
});
