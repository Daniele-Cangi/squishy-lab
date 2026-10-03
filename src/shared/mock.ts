import { DEFAULT_SPEC, type ModelOutput, type SpecPatch, type SquishyRequest } from './spec.ts';
// Deliberately simple local fixture interpreter. This is NOT inference.
export function mockInterpret(request:SquishyRequest):ModelOutput {
  const text=request.prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''), base=request.current??DEFAULT_SPEC, patch:SpecPatch={};
  if(/squal|shark|panda|donut|ciambell|cat\b|gatto|rabbit|coniglio|asset|shader|script|ignore|ignora|\burl\b/.test(text)) return {version:1,status:'unsupported',patch:{},message:'Questa forma non è disponibile. Puoi adattarla a un mochi arrotondato.'};
  const protectColor=/non (?:cambiare|cambiar|toccare).*colore|don.t change.*colou?r|keep.*colou?r|stesso colore/.test(text);
  if(!protectColor) for(const [pattern,color] of [[/viola|purple/,'#a996ee'],[/blu|blue|azzurr/,'#77c8ea'],[/pesca|peach|arancion/,'#f6aa8b'],[/rosa|pink/,'#f49cbe'],[/verd|green/,'#8ed2af'],[/giall|yellow/,'#f1ce67']] as const) if(pattern.test(text)) patch.color=color;
  if(/meno (?:molle|morbido)|less soft|firmer|piu sod|piu dur|less squishy/.test(text)) patch.softness=Math.max(.1,base.softness-.28);
  else if(/piu (?:molle|morbido)|softer/.test(text)) patch.softness=Math.min(1,base.softness+.2);
  else if(/molto morb|very soft|super soft|morbbido/.test(text)) patch.softness=.92;
  else if(/morbido|soft/.test(text)) patch.softness=.76;
  if(/veloc|faster|quick|rapid/.test(text)) patch.recoverySeconds=Math.max(.3,base.recoverySeconds*.32);
  else if(/piu lent|slower/.test(text)) patch.recoverySeconds=Math.min(12,base.recoverySeconds*1.65);
  else if(/lent|slow/.test(text)) patch.recoverySeconds=6;
  if(/schiacciat|piatt|flatter|flat\b/.test(text)) patch.proportions={height:Math.max(.65,base.proportions.height*.75)};
  if(/alto|taller|tall\b/.test(text)) patch.proportions={height:Math.min(1.6,base.proportions.height*1.3)};
  if(/largo|wider/.test(text)) patch.proportions={...patch.proportions,width:Math.min(1.6,base.proportions.width*1.25)};
  if(/opac|matte/.test(text)) patch.finish='matte';
  if(/satin/.test(text)) patch.finish='satin';
  if(/elastico|elastic|bouncy/.test(text)) {patch.recoverySeconds=.45;patch.compressibility=.2;patch.damping=.38;}
  if(/comprimibile|compressible/.test(text)) patch.compressibility=.88;
  if(/non rimbalz|no bouncing|less bounce/.test(text)) patch.damping=.95;
  if(!Object.keys(patch).length) return {version:1,status:'unsupported',patch:{},message:'La demo comprende colore, morbidezza, ritorno e proporzioni. Prova “viola, molto morbido, ritorno lento”.'};
  return {version:1,status:'ok',patch,message:'Modifica applicata dall’interprete demo locale.'};
}
