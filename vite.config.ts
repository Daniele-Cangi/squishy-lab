import { defineConfig,type Plugin } from 'vite';
import { Readable } from 'node:stream';
import { handleApi } from './worker/api.ts';
const mockPlugin:Plugin={
    name:'explicit-local-mock-api',
    configureServer(server) {
      server.middlewares.use('/api',async(req,res)=>{
        try {
          const url=`http://${req.headers.host??'127.0.0.1:5173'}/api${req.url??''}`;
          const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
          const init={method:req.method,headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Readable.toWeb(req) as ReadableStream<Uint8Array>,duplex:'half'}:{})};
          const response=await handleApi(new Request(url,init),{PROVIDER:'mock'});
          res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
        } catch {res.statusCode=500;res.end('{"message":"Local adapter error"}');}
      });
    },
};
export default defineConfig(async({mode})=>({
  server:{port:5173,strictPort:true},
  plugins:mode==='ai-evaluation'?[await (await import('./scripts/local-ai-plugin.ts')).localAiPlugin()]:[mockPlugin],
  build:{chunkSizeWarningLimit:700},
}));
