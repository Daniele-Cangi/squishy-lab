import {handleApi,type Env} from './api';
export {DailyQuota} from './daily-quota';
export {VisitCounter} from './visit-counter';
interface VisitsEnv {VISITS:{getByName(name:string):{fetch(request:Request):Promise<Response>}};GATEWAY_SECRET?:string}
export default {fetch(request:Request,env:Env&VisitsEnv){
  if(new URL(request.url).pathname==='/api/visits'){
    if(!env.GATEWAY_SECRET||request.headers.get('X-Squishy-Gateway')!==env.GATEWAY_SECRET)return new Response(null,{status:403});
    return env.VISITS.getByName('global').fetch(request);
  }
  return handleApi(request,env);
}};
