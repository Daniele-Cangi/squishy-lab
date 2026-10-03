import { it,expect } from 'vitest';
import { CORPUS,assess } from '../semantic-corpus';
import { infer } from '../../worker/api';
import { FIRMNESS_CASES } from '../semantic-firmness';
it.each([...CORPUS,...FIRMNESS_CASES])('explicit MOCK corpus: $id',async case_=>{
  const response=await infer(case_.request,{PROVIDER:'mock'});expect(response.provider).toBe('mock');expect(assess(case_,response)).toMatchObject({semanticPass:true,preserved:true});
});
