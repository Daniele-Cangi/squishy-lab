import {proxyApi} from '../server/gateway.ts';
export default {fetch(request:Request){return proxyApi(request);}};
