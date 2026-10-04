import {handleApi,type Env} from './api';
export {DailyQuota} from './daily-quota';
export default {fetch(request:Request,env:Env){return handleApi(request,env);}};
