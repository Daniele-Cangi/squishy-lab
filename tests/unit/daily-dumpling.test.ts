import { expect,it } from 'vitest';
import { claimDumpling,DAILY_KEY,DAY_MS,drawDumpling,dumplingAppearance,readDumpling } from '../../src/daily-dumpling';
import { shapePoint } from '../../src/physics/cage';

it('one opening per rolling day survives reloads, repeated clicks and the exact boundary',()=>{
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  const first=claimDumpling(storage,1000,()=>.1);
  expect(first.fresh).toBe(true);expect(first.reward.glitter).toBe(true);
  for(const now of [1000,2000,DAY_MS,DAY_MS+999]){
    const again=claimDumpling(storage,now,()=>{throw new Error('Must not reroll');});
    expect(again).toEqual({reward:first.reward,fresh:false});
  }
  const next=claimDumpling(storage,1000+DAY_MS,()=>.9);
  expect(next.fresh).toBe(true);expect(next.reward.glitter).toBe(false);
  expect(readDumpling(storage.getItem(DAILY_KEY))).toEqual(next.reward);
});
it('draw selects colors, moods and the documented glitter boundary',()=>{
  expect(dumplingAppearance(drawDumpling(1000,()=>0))).toMatchObject({shape:'dumpling',face:true,expression:'smile',effect:'glitter'});
  expect(drawDumpling(1000,()=>.15).glitter).toBe(false);
  expect(drawDumpling(1000,()=>.999999)).toMatchObject({colorIndex:5,expressionIndex:4,glitter:false});
});
it('malformed records cannot become a prize; failed persistence does not grant an opening',()=>{
  for(const raw of ['broken','null','{}',JSON.stringify({...drawDumpling(1,()=>0),colorIndex:99}),JSON.stringify({...drawDumpling(1,()=>0),openedAt:'1'})])expect(readDumpling(raw)).toBeNull();
  expect(()=>claimDumpling({getItem:()=>null,setItem:()=>{throw new Error('Storage disabled');}},1000,()=>.5)).toThrow('Storage disabled');
});
it('dumpling folds are actual upper relief and fade into the smooth belly',()=>{
  const top=Array.from({length:144},(_,i)=>{const a=i*Math.PI/72;return shapePoint(.65*Math.cos(a),1,.65*Math.sin(a),[1,1,1],'dumpling')[1];});
  expect(Math.max(...top)-Math.min(...top)).toBeGreaterThan(.16);
  for(const a of [0,.3,1,2]){
    const q:[number,number,number]=[Math.cos(a),0,Math.sin(a)];
    expect(shapePoint(...q,[1,1,1],'dumpling')).toEqual(shapePoint(...q,[1,1,1],'mochi'));
  }
});
