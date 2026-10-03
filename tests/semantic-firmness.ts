import { DEFAULT_SPEC,type SquishyRequest } from '../src/shared/spec';
import type { SemanticCase } from './semantic-corpus';
const modify=(prompt:string):SquishyRequest=>({version:1,mode:'modify',prompt,current:DEFAULT_SPEC});
const create=(prompt:string):SquishyRequest=>({version:1,mode:'create',prompt});
// Fixed before the follow-up live run. These become regressions once used to
// refine the prompt; they are not an unseen model-quality benchmark.
export const FIRMNESS_CASES:SemanticCase[]=[
  {id:'it-typo-very-hard',request:modify('un monchi giallo molto duro'),status:'ok',affected:['color','softness'],color:'yellow',bands:{softness:[.1,.25]}},
  {id:'it-create-very-hard',request:create('Un mochi giallo molto duro.'),status:'ok',affected:['color','softness'],color:'yellow',bands:{softness:[.1,.25]}},
  {id:'it-harder-protected-color',request:modify('Uguale, ma più duro. Non cambiare colore.'),status:'ok',affected:['softness'],bands:{softness:[.1,.7]}},
  {id:'it-not-hard-soft',request:modify('Un mochi giallo, non duro: molto morbido.'),status:'ok',affected:['color','softness'],color:'yellow',bands:{softness:[.85,1]}},
  {id:'en-very-firm',request:create('A very firm yellow mochi.'),status:'ok',affected:['color','softness'],color:'yellow',bands:{softness:[.1,.25]}},
  {id:'it-hard-unsupported-animal',request:create('Un panda giallo molto duro.'),status:'unsupported',affected:[]},
];
