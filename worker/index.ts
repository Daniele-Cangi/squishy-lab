import { handleApi, type Env } from './api';
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env);
    return env.ASSETS?.fetch(request)??new Response('Assets not configured',{status:503});
  },
};
