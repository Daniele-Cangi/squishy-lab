import {it,expect,vi,afterEach} from 'vitest';
import {DailyQuota,QUOTA_WINDOW_MS,quotaKey,type QuotaStorage} from '../../worker/daily-quota';
import {handleApi,type Env} from '../../worker/api';
import {DEFAULT_SPEC} from '../../src/shared/spec';
function store(){const data=new Map<string,unknown>();return {kv:{get:<T>(key:string)=>structuredClone(data.get(key)) as T|undefined,put:(key:string,value:unknown)=>{data.set(key,structuredClone(value));},delete:(key:string)=>data.delete(key)},transactionSync:<T>(callback:()=>T)=>callback(),setAlarm:vi.fn().mockResolvedValue(undefined)} satisfies QuotaStorage;}
const consume=(object:DailyQuota)=>object.fetch(new Request('https://quota.internal/consume',{method:'POST'})).then(response=>response.json());
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('persists the limit across reconstruction and serializes concurrent reservations',async()=>{
 const storage=store(),object=new DailyQuota({storage}),results=await Promise.all(Array.from({length:20},()=>consume(object)));
 expect(results.filter(r=>r.success)).toHaveLength(3);expect((await consume(new DailyQuota({storage}))).success).toBe(false);expect(storage.kv.get<number[]>('uses')).toHaveLength(3);
});
it('uses a rolling 24-hour window and releases each slot exactly at expiry',async()=>{
 vi.useFakeTimers();vi.setSystemTime(100000);const object=new DailyQuota({storage:store()});await consume(object);
 vi.setSystemTime(110000);await consume(object);vi.setSystemTime(120000);await consume(object);
 vi.setSystemTime(100000+QUOTA_WINDOW_MS-1);expect(await consume(object)).toMatchObject({success:false,retryAfter:1});
 vi.setSystemTime(100000+QUOTA_WINDOW_MS);expect((await consume(object)).success).toBe(true);expect(await consume(object)).toMatchObject({success:false,retryAfter:10});
});
it('cleans expired timestamps without erasing a newer reservation',async()=>{
 vi.useFakeTimers();vi.setSystemTime(100000);const storage=store(),object=new DailyQuota({storage});await consume(object);
 vi.setSystemTime(100000+QUOTA_WINDOW_MS);await consume(object);await object.alarm();expect(storage.kv.get<number[]>('uses')).toHaveLength(1);
 vi.setSystemTime(100000+2*QUOTA_WINDOW_MS);await object.alarm();expect(storage.kv.get('uses')).toBeUndefined();
});
it('keys IPs deterministically with a secret, without storing the raw address',async()=>{
 const a=await quotaKey('192.0.2.1','test-only');expect(a).toMatch(/^[a-f0-9]{64}$/);expect(a).toBe(await quotaKey('192.0.2.1','test-only'));expect(a).not.toBe(await quotaKey('192.0.2.2','test-only'));expect(a).not.toBe(await quotaKey('192.0.2.1','another-secret'));
});
it('counts only verified requests and refuses the fourth before model inference',async()=>{
 const storage=store(),object=new DailyQuota({storage}),run=vi.fn().mockResolvedValue({version:1,status:'ok',patch:{softness:.5},message:'Firmer.'}),fetchQuota=vi.fn(request=>object.fetch(request));let verified=false;
 vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(Response.json({success:verified,hostname:'squishy.example',action:'squishy'}))));
 const env:Env={PUBLIC_ORIGIN:'https://squishy.example',GATEWAY_SECRET:'test-only',PROVIDER:'workers-ai',AI:{run},TURNSTILE_SITE_KEY:'test-public',TURNSTILE_SECRET:'test-only',AI_RATE:{limit:async()=>({success:true})},BURST_RATE:{limit:async()=>({success:true})},DAILY_QUOTA:{idFromName:name=>name,get:()=>({fetch:fetchQuota})}};
 const request=()=>new Request('https://private.workers.dev/api/squishy',{method:'POST',headers:{'Content-Type':'application/json','X-Squishy-Gateway':'test-only','X-Squishy-Client-IP':'192.0.2.1'},body:JSON.stringify({version:1,mode:'modify',prompt:'Same.',current:DEFAULT_SPEC,turnstileToken:'test-token'})});
 expect((await handleApi(request(),env)).status).toBe(403);expect(fetchQuota).not.toHaveBeenCalled();verified=true;
 for(let i=0;i<3;i++)expect((await handleApi(request(),env)).status).toBe(200);
 const denied=await handleApi(request(),env);expect(denied.status).toBe(429);expect(Number(denied.headers.get('Retry-After'))).toBeGreaterThan(86000);expect((await denied.json()).code).toBe('daily_limit');expect(run).toHaveBeenCalledTimes(3);
});
