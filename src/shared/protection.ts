import { ValidationError,type SpecPatch,type SquishySpec } from './spec.ts';
// Conservative protection checks, not a description interpreter: this never
// chooses a value or invents an edit. Unknown wording is left to the model.
export function protectedFields(prompt:string):(keyof SpecPatch)[]{
  const fields=new Set<keyof SpecPatch>();
  const nouns:Partial<Record<keyof SpecPatch,RegExp>>={color:/\b(colore|tinta|color|colour|hue|shade)\b/i,softness:/\b(morbidezza|consistenza|softness|firmness)\b/i,recoverySeconds:/\b(recupero|risalita|ritorno|recovery)\b/i,damping:/\b(rimbalzo|bounce|damping)\b/i,proportions:/\b(forma|sagoma|silhouette|shape|proportions)\b/i,finish:/\b(finitura|finish)\b/i};
  for(const match of prompt.matchAll(/\b(?:non\s+(?:cambiare|toccare|alterare)|mantieni|conserva|stess[oa]|keep|retain|same|leave)\b([^,.;:!?]*)/gi)){
    const span=match[1].split(/\b(?:but|ma|and\s+(?:make|reduce|speed|change)|e\s+(?:fallo|rendilo|aumenta|riduci))\b/i)[0];
    for(const [field,noun]of Object.entries(nouns))if(noun.test(span))fields.add(field as keyof SpecPatch);
  }
  if(/\b(?:non\s+più\s+morbido|not\s+(?:more\s+soft|softer)|(?:don't|do not)\s+soften)\b/i.test(prompt)&&!/\b(?:ma|but)\s+(?:più\s+sodo|firmer|harder|less\s+soft)\b/i.test(prompt))fields.add('softness');
  return [...fields];
}
export function validateRecoveryDirection(prompt:string,base:SquishySpec,patch:SpecPatch){
  if(patch.recoverySeconds===undefined)return;
  const faster=/\b(faster|sooner|quicker|shorter|speed\s+up|accorci\w*|accelera\w*|rapid[oa]|rapidamente|velocemente|più\s+veloc[ea])\b/i.test(prompt);
  const slower=/\b(slower|take\s+longer|più\s+lent[oa]|lentamente)\b/i.test(prompt);
  // Reject contradictions only when the wording has one clear direction.
  // The model still chooses the value; this never creates or clips a patch.
  if(faster&&!slower&&(patch.recoverySeconds>base.recoverySeconds||(patch.recoverySeconds===base.recoverySeconds&&base.recoverySeconds>.3)))throw new ValidationError(`recoverySeconds must DECREASE from ${base.recoverySeconds} for faster/shorter recovery`);
  if(slower&&!faster&&(patch.recoverySeconds<base.recoverySeconds||(patch.recoverySeconds===base.recoverySeconds&&base.recoverySeconds<12)))throw new ValidationError(`recoverySeconds must INCREASE from ${base.recoverySeconds} for slower recovery`);
}
