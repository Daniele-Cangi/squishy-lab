import { describe,it,expect } from 'vitest';
import { DEFAULT_SPEC, applyPatch, compileSpec, validateModelOutput, validateSpec, validatePatch, validateRequest } from '../../src/shared/spec';
import { RequestGate } from '../../src/client';
describe('Untrusted data contract',()=>{
  it('preserves all fields absent from a contextual patch',()=>{
    const next=applyPatch(DEFAULT_SPEC,{softness:.42});
    expect(next).toEqual({...DEFAULT_SPEC,softness:.42});
  });
  it('flattens without shrinking reference volume',()=>{
    const before=compileSpec(DEFAULT_SPEC).radii,after=compileSpec(applyPatch(DEFAULT_SPEC,{proportions:{height:.65}})).radii;
    expect(after[1]).toBeLessThan(before[1]);expect(after[0]).toBeGreaterThan(before[0]);
    expect(after.reduce((a,b)=>a*b)).toBeCloseTo(before.reduce((a,b)=>a*b),10);
  });
  it.each([{softness:NaN},{softness:Infinity},{softness:'0.8'},{softness:1.5},{code:'alert(1)'},{color:'red'},{finish:'glass'},{proportions:{height:0}},{proportions:{url:'https://bad.example'}}])('rejects unsafe patch %j',value=>expect(()=>validatePatch(value)).toThrow());
  it('reports tiny boundary corrections and refuses large ones',()=>{
    const value=validateModelOutput({version:1,status:'ok',patch:{softness:1.005}});expect(value.output.patch.softness).toBe(1);expect(value.corrections).toHaveLength(1);
    expect(()=>validateModelOutput({version:1,status:'ok',patch:{softness:1.05}})).toThrow();
  });
  it('refuses incompatible proportions rather than clipping silently',()=>expect(()=>applyPatch(DEFAULT_SPEC,{proportions:{width:1.6,height:.65}})).toThrow());
  it('rejects missing fields, invented archetypes, unsupported edits, empty success',()=>{
    expect(()=>validateSpec({...DEFAULT_SPEC,archetype:'shark'})).toThrow();expect(()=>validateSpec({...DEFAULT_SPEC,damping:undefined})).toThrow();
    expect(()=>validateModelOutput({version:1,status:'unsupported',patch:{color:'#123456'}})).toThrow();
    expect(()=>validateModelOutput({version:1,status:'ok',patch:{}})).toThrow();
  });
  it('requires contextual state only on modify and bounds descriptions',()=>{
    expect(()=>validateRequest({version:1,mode:'modify',prompt:'faster'})).toThrow();
    expect(()=>validateRequest({version:1,mode:'create',prompt:'x'.repeat(501)})).toThrow();
  });
  it('invalidates stale replies on a newer request or reset',()=>{
    const gate=new RequestGate(),first=gate.ticket(),second=gate.ticket();expect(gate.current(first)).toBe(false);expect(gate.current(second)).toBe(true);gate.invalidate();expect(gate.current(second)).toBe(false);
  });
});
