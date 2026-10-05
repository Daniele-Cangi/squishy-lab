import { defineConfig,type Plugin } from 'vite';
import { Readable } from 'node:stream';
import { handleApi } from './worker/api.ts';
import { labMarkup } from './src/view.ts';
// Serve the same complete HTML to people and crawlers, in dev and production.
// Client code attaches behavior to these elements instead of replacing them.
const staticPagePlugin:Plugin={
  name:'squishy-static-page',
  transformIndexHtml:{order:'pre',handler(html,context){
    if(context.filename.replaceAll('\\','/').endsWith('/guide/index.html'))return html;
    const mount='<div id="app"></div>';
    if(!html.includes(mount))throw new Error('Static page mount is missing.');
    return html.replace(mount,()=>`<div id="app">${labMarkup}</div>`);
  }},
};
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
  plugins:[staticPagePlugin,...(mode==='ai-evaluation'?[await (await import('./scripts/local-ai-plugin.ts')).localAiPlugin()]:[mockPlugin])],
  build:{chunkSizeWarningLimit:700,rollupOptions:{input:{playground:'index.html',guide:'guide/index.html'}}},
}));
