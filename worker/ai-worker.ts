import {handleApi,type Env} from './api';
export default {fetch(request:Request,env:Env){return handleApi(request,env);}};
