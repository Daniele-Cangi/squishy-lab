import { DEFAULT_SPEC,type SquishyRequest } from '../src/shared/spec';
import type { SemanticCase } from './semantic-corpus';
const modify=(prompt:string):SquishyRequest=>({version:1,mode:'modify',prompt,current:DEFAULT_SPEC});
// Frozen before the first live campaign; these phrases are absent from the prompt examples.
export const HOLDOUT:SemanticCase[]=[
  {id:'held-it-protect-recovery',request:modify('Più morbido, ma con lo stesso tempo di recupero.'),status:'ok',affected:['softness'],bands:{softness:[.89,1]}},
  {id:'held-it-negation',request:modify('Non più morbido: deve solo tornare lentamente.'),status:'ok',affected:['recoverySeconds'],bands:{recoverySeconds:[5.5,12]}},
  {id:'held-en-hue',request:modify('Leave the hue exactly as it is, but let the dent disappear sooner.'),status:'ok',affected:['recoverySeconds'],bands:{recoverySeconds:[.3,3]}},
  {id:'held-it-typo',request:modify('Un po piu sodo, tinta identica.'),status:'ok',affected:['softness'],bands:{softness:[.1,.7]}},
  {id:'held-en-compound',request:modify('Keep the silhouette and shade, reduce softness and speed up recovery.'),status:'ok',affected:['softness','recoverySeconds'],bands:{softness:[.1,.7],recoverySeconds:[.3,3]}},
  {id:'held-it-blue-only',request:modify('Cambia solo il colore in blu; non toccare morbidezza e risalita.'),status:'ok',affected:['color'],color:'blue'},
  {id:'held-en-negation',request:modify("Don't soften it; just take longer to regain shape."),status:'ok',affected:['recoverySeconds'],bands:{recoverySeconds:[5.5,12]}},
  {id:'held-en-shark',request:{version:1,mode:'create',prompt:'I want a blue shark shaped foam toy.'},status:'unsupported',affected:[]},
];
// Reserved after the protection validator was complete, before these phrases
// were submitted to any model. Never used to tune prompt or guard expressions.
export const FRESH_HOLDOUT:SemanticCase[]=[
  {id:'fresh-it-preserve-feel',request:modify('Il colore e la morbidezza vanno bene così; accorcia soltanto la risalita.'),status:'ok',affected:['recoverySeconds'],bands:{recoverySeconds:[.3,3]}},
  {id:'fresh-en-firmer',request:modify('A touch firmer, please; the way it slowly recovers is already right.'),status:'ok',affected:['softness'],bands:{softness:[.1,.7]}},
  {id:'fresh-it-compound',request:modify('Stessa forma: più cedevole e con ritorno più rapido.'),status:'ok',affected:['softness','recoverySeconds'],bands:{softness:[.89,1],recoverySeconds:[.3,3]}},
  {id:'fresh-en-appearance',request:modify('Switch to a satin surface and a peach tint. Leave the foam response alone.'),status:'ok',affected:['finish','color'],finish:'satin',color:'peach'},
  {id:'fresh-en-elephant',request:{version:1,mode:'create',prompt:'Create a little violet elephant.'},status:'unsupported',affected:[]},
];
