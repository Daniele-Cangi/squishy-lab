export default {async fetch(request:Request){
  if(request.method!=='POST')return new Response(null,{status:405});
  const url=new URL(request.url);if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403});
  const token=await request.text();if(token.length!==36||!/^[0-9a-f-]{36}$/i.test(token))return new Response(null,{status:400});
  const upstream=process.env.SQUISHY_AI_URL,secret=process.env.SQUISHY_GATEWAY_SECRET;if(!upstream||!secret)return new Response(null,{status:503});
  try{const target=new URL('/api/visits',upstream);const response=await fetch(target,{method:'POST',headers:{'X-Squishy-Gateway':secret},body:token,signal:AbortSignal.timeout(8000)});return new Response(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}catch{return new Response(null,{status:503});}
}};
