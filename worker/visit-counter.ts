interface VisitStorage {sql:{exec<T>(query:string,...args:(string|number)[]):Iterable<T>};transactionSync<T>(fn:()=>T):T}
export class VisitCounter {
  constructor(private ctx:{storage:VisitStorage}){}
  async fetch(request:Request){
    if(request.method!=='POST')return new Response(null,{status:405});
    const token=await request.text();if(!/^[0-9a-f-]{36}$/i.test(token))return new Response(null,{status:400});
    const storage=this.ctx.storage,now=Date.now();
    const result=storage.transactionSync(()=>{
      storage.sql.exec('CREATE TABLE IF NOT EXISTS total (id INTEGER PRIMARY KEY, count INTEGER NOT NULL)');
      storage.sql.exec('CREATE TABLE IF NOT EXISTS visitors (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, number INTEGER NOT NULL)');
      storage.sql.exec('DELETE FROM visitors WHERE expires <= ?',now);
      const existing=[...storage.sql.exec<{number:number}>('SELECT number FROM visitors WHERE token = ?',token)][0];
      if(existing)return {number:existing.number};
      storage.sql.exec('INSERT INTO total VALUES (1,1) ON CONFLICT(id) DO UPDATE SET count = count + 1');
      const total=[...storage.sql.exec<{count:number}>('SELECT count FROM total WHERE id=1')][0].count;
      storage.sql.exec('INSERT INTO visitors VALUES (?,?,?)',token,now+86400000,total);return {number:total};
    });return Response.json(result);
  }
}
