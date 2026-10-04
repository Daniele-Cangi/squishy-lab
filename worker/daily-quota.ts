export const QUOTA_WINDOW_MS=24*60*60*1000;
export interface QuotaStorage {
  kv:{get<T>(key:string):T|undefined;put(key:string,value:unknown):void;delete(key:string):boolean};
  transactionSync<T>(callback:()=>T):T;
  setAlarm(time:number):Promise<void>;
}
// One SQLite-backed object per keyed IP hash. Synchronous storage transactions
// serialize reservations; no prompt, raw IP or user profile is stored.
export class DailyQuota {
  constructor(private ctx:{storage:QuotaStorage}){}
  async fetch(request:Request):Promise<Response>{
    if(request.method!=='POST'||new URL(request.url).pathname!=='/consume')return new Response(null,{status:405});
    const now=Date.now(),storage=this.ctx.storage;
    const result=storage.transactionSync(()=>{
      const uses=(storage.kv.get<number[]>('uses')??[]).filter(time=>time>now-QUOTA_WINDOW_MS);
      if(uses.length>=3)return {success:false,retryAfter:Math.max(1,Math.ceil((uses[0]+QUOTA_WINDOW_MS-now)/1000)),remaining:0};
      uses.push(now);storage.kv.put('uses',uses);
      return {success:true,retryAfter:0,remaining:3-uses.length};
    });
    // Expiration only removes timestamps outside the rolling window. An alarm
    // racing a new request cannot erase its reservation.
    await storage.setAlarm((storage.kv.get<number[]>('uses')??[now])[0]+QUOTA_WINDOW_MS);
    return Response.json(result);
  }
  async alarm(){
    const storage=this.ctx.storage,uses=(storage.kv.get<number[]>('uses')??[]).filter(time=>time>Date.now()-QUOTA_WINDOW_MS);
    if(uses.length){storage.kv.put('uses',uses);await storage.setAlarm(uses[0]+QUOTA_WINDOW_MS);}else storage.kv.delete('uses');
  }
}
export async function quotaKey(ip:string,secret:string){
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(ip))),b=>b.toString(16).padStart(2,'0')).join('');
}
