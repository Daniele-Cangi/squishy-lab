import type { SquishySpec } from './shared/spec';
export const copy={
  states:{pressing:'Sotto pressione',recovering:'Sta tornando su…',rest:'Pronto da premere'},
  generate:'Applica la descrizione',compare:'Confronta prima e dopo',stopComparison:'Interrompi confronto',
  comparisonReady:'Stessa forma e colore, la stessa pressione.',
  comparisonPhase:['Prima della modifica','Dopo la modifica'],
};
export const materialFields=['softness','compressibility','recoverySeconds','damping'] as const;
export const hasMaterialChange=(before:SquishySpec,after:SquishySpec)=>materialFields.some(field=>before[field]!==after[field]);
export function materialSummary(spec:SquishySpec){
  return `${spec.softness>.75?'Morbidissimo':spec.softness>.45?'Morbido':'Più sodo'} · ${spec.recoverySeconds>3?'ritorno lento':spec.recoverySeconds>1?'ritorno dolce':'ritorno rapido'} · ${spec.finish==='matte'?'opaco':'satinato'}`;
}
export function describeChange(before:SquishySpec,after:SquishySpec){
  const changes:string[]=[];
  if(after.softness!==before.softness)changes.push(after.softness>before.softness?'più morbido':'più sodo');
  if(after.recoverySeconds!==before.recoverySeconds)changes.push(after.recoverySeconds>before.recoverySeconds?'risale più lentamente':'risale più velocemente');
  if(after.compressibility!==before.compressibility)changes.push(after.compressibility>before.compressibility?'più comprimibile':'meno comprimibile');
  if(after.damping!==before.damping)changes.push(after.damping>before.damping?'meno rimbalzo':'più elastico');
  if(after.color!==before.color)changes.push('colore aggiornato');
  if(after.finish!==before.finish)changes.push(after.finish==='matte'?'superficie opaca':'superficie satinata');
  if(JSON.stringify(after.proportions)!==JSON.stringify(before.proportions))changes.push('proporzioni aggiornate');
  return changes.join(' · ')||'stesso materiale';
}
