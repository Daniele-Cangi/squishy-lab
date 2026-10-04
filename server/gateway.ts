import {isIP} from 'node:net';
import {ApiError,boundedBody,deadline,json} from '../worker/api.ts';
export async function proxyApi(request:Request,env=process.env):Promise<Response>{
  const url=new URL(request.url),config=url.pathname==='/api/config';
  if(!(config&&request.method==='GET')&&!(url.pathname==='/api/squishy'&&request.method==='POST'))return json({message:'Method not allowed.'},405);
  if(!env.SQUISHY_AI_URL||!env.SQUISHY_GATEWAY_SECRET)return config?json({provider:'disabled'}):json({message:'AI is not configured. Local presets still work.'},503);
  try{
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw new ApiError(403,'origin','Origin not allowed.');
    if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'origin','Origin not allowed.');
    const headers=new Headers({'X-Squishy-Gateway':env.SQUISHY_GATEWAY_SECRET});
    const origin=request.headers.get('origin');if(origin)headers.set('Origin',origin);
    let body:string|undefined;
    if(!config){
      if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'content_type','Use JSON.');
      // Vercel overwrites this forwarding header. Never forward a client-supplied
      // gateway header, secret, CF IP, or arbitrary upstream URL.
      const ip=(request.headers.get('x-forwarded-for')??'').split(',')[0].trim();
      if(!isIP(ip))throw new ApiError(403,'verification','Unverified request source.');
      headers.set('X-Squishy-Client-IP',ip);headers.set('Content-Type','application/json');
      body=await deadline(boundedBody(request),5000,request.signal);
    }
    const target=new URL(env.SQUISHY_AI_URL);if(target.protocol!=='https:')throw new Error('Invalid upstream');target.pathname=url.pathname;target.search='';
    const response=await fetch(target,{method:request.method,headers,body,signal:AbortSignal.any([request.signal,AbortSignal.timeout(22000)]),redirect:'error'});
    const text=await boundedBody(new Request('https://response.invalid',{method:'POST',body:response.body,duplex:'half'} as RequestInit),12000);
    const outgoing=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(response.status===429)outgoing.set('Retry-After','60');
    return new Response(text,{status:response.status,headers:outgoing});
  }catch(error){return error instanceof ApiError?json({code:error.code,message:error.message},error.status):json({code:'unavailable',message:'AI is unavailable. Your squishy and presets still work.'},503);}
}
