import type { Plugin } from 'vite';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { ApiError,boundedBody,deadline,infer,json } from '../worker/api.ts';
import { validateRequest } from '../src/shared/spec.ts';
import { liveAi } from './cloudflare-access.ts';
import { MODEL_3B,MODEL_8B,MODEL_QWEN,SYSTEM_PROMPT } from '../src/shared/prompt.ts';
// Explicit opt-in evaluation only. This plugin is never in the deployed Worker.
// Credentials stay in this Node process. No paid plan or resource is created.
export async function localAiPlugin():Promise<Plugin>{
  const model=process.env.SQUISHY_AI_MODEL??MODEL_QWEN;
  if(![MODEL_3B,MODEL_8B,MODEL_QWEN].includes(model))throw new Error('Evaluation model is not allowlisted.');
  const session=await liveAi(12);let busy=false;
  console.log(`LIVE Workers AI evaluation: loopback only, ${model}, maximum 12 inference calls. ${session.freeCheck}`);
  return {name:'bounded-local-live-evaluation',configureServer(server){
    server.middlewares.use('/api',async(req,res)=>{
      const controller=new AbortController();res.on('close',()=>controller.abort());
      let response:Response;
      try{
        const url=new URL(`http://${req.headers.host}/api${req.url??''}`);
        const peer=req.socket.remoteAddress??'';
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new ApiError(403,'origin','Solo test locale.');
        if(req.headers.origin&&req.headers.origin!==url.origin)throw new ApiError(403,'origin','Origine non consentita.');
        if(req.headers['sec-fetch-site']==='cross-site')throw new ApiError(403,'origin','Origine non consentita.');
        if(url.pathname==='/api/config'&&req.method==='GET')response=json({provider:'evaluation-ai',model});
        else if(url.pathname==='/api/evaluation-report'&&req.method==='GET')response=json({provider:'LIVE Workers AI, local evaluation; production Turnstile not exercised',systemPromptSha256:createHash('sha256').update(SYSTEM_PROMPT).digest('hex'),freeCheck:session.freeCheck,calls:session.calls,limit:12});
        else{
          if(url.pathname!=='/api/squishy'||req.method!=='POST')throw new ApiError(405,'method','Metodo non consentito.');
          if(busy)throw new ApiError(429,'busy','Un test è già in corso.');
          if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError(415,'content_type','Usa JSON.');
          busy=true;
          try{
            const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
            const request=new Request(url,{method:'POST',headers,body:Readable.toWeb(req) as ReadableStream<Uint8Array>,duplex:'half',signal:controller.signal} as RequestInit);
            const body=validateRequest(JSON.parse(await deadline(boundedBody(request),5000,controller.signal)));
            response=json(await infer(body,{PROVIDER:'workers-ai',MODEL:model,AI:session.binding(controller.signal)},controller.signal));
          }finally{busy=false;}
        }
      }catch(error){response=json({message:error instanceof ApiError?error.message:'Test AI non disponibile. Lo squishy resta utilizzabile.'},error instanceof ApiError?error.status:400);}
      if(!res.destroyed){res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());}
    });
  }};
}
