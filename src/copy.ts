import type { SquishySpec } from './shared/spec';
export const copy={
  states:{pressing:'Being squished',recovering:'Bouncing back…',rest:'Ready to squish'},
  generate:'Apply description',compare:'Compare before and after',stopComparison:'Stop comparison',
  comparisonReady:'Same shape and color, same squeeze.',
  comparisonPhase:['Before your edit','After your edit'],
};
export const materialFields=['softness','compressibility','recoverySeconds','damping'] as const;
export const hasMaterialChange=(before:SquishySpec,after:SquishySpec)=>materialFields.some(field=>before[field]!==after[field]);
export function materialSummary(spec:SquishySpec){
  return `${spec.softness>.75?'Super soft':spec.softness>.45?'Soft':'Firmer'} · ${spec.recoverySeconds>3?'slow return':spec.recoverySeconds>1?'gentle return':'quick return'} · ${spec.finish==='matte'?'matte':'satin'}`;
}
export function describeChange(before:SquishySpec,after:SquishySpec){
  const changes:string[]=[];
  if(after.softness!==before.softness)changes.push(after.softness>before.softness?'softer':'firmer');
  if(after.recoverySeconds!==before.recoverySeconds)changes.push(after.recoverySeconds>before.recoverySeconds?'slower return':'faster return');
  if(after.compressibility!==before.compressibility)changes.push(after.compressibility>before.compressibility?'more compressible':'less compressible');
  if(after.damping!==before.damping)changes.push(after.damping>before.damping?'less bounce':'more bounce');
  if(after.color!==before.color)changes.push('color updated');
  if(after.finish!==before.finish)changes.push(after.finish==='matte'?'matte finish':'satin finish');
  if(JSON.stringify(after.proportions)!==JSON.stringify(before.proportions))changes.push('proportions updated');
  return changes.join(' · ')||'same material';
}
