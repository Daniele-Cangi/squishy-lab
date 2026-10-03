export type ShapeId='mochi'|'butter'|'strawberry'|'cube';
export type SurfaceEffect='foam'|'glitter'|'clear';
export interface Appearance {shape:ShapeId;label:'none'|'butter'|'strawberry';face:boolean;effect:SurfaceEffect}
export const DEFAULT_APPEARANCE:Appearance={shape:'mochi',label:'none',face:false,effect:'foam'};
export const COLLECTION:{id:string;name:string;note:string;color:string;appearance:Appearance}[]=[
  {id:'mochi',name:'Mochi',note:'La nuvola originale',color:'#a996ee',appearance:DEFAULT_APPEARANCE},
  {id:'butter',name:'Butter',note:'Panetto con scritte in rilievo',color:'#edcf72',appearance:{shape:'butter',label:'butter',face:false,effect:'foam'}},
  {id:'berry-butter',name:'Strawberry',note:'Panetto rosa con fragolina',color:'#f29bb5',appearance:{shape:'butter',label:'strawberry',face:false,effect:'foam'}},
  {id:'berry',name:'Fragolina',note:'Semini, foglie e sorriso',color:'#ee6078',appearance:{shape:'strawberry',label:'none',face:true,effect:'foam'}},
  {id:'jelly',name:'Jelly cube',note:'Trasparente con glitter',color:'#87cdda',appearance:{shape:'cube',label:'none',face:false,effect:'clear'}},
];
export function validateAppearance(value:unknown):Appearance{
  if(!value||typeof value!=='object')throw new Error('Invalid appearance');
  const v=value as Record<string,unknown>;
  if(!['mochi','butter','strawberry','cube'].includes(String(v.shape))||!['none','butter','strawberry'].includes(String(v.label))||!['foam','glitter','clear'].includes(String(v.effect))||typeof v.face!=='boolean'||(v.shape!=='butter'&&v.label!=='none'))throw new Error('Invalid appearance');
  return {shape:v.shape as ShapeId,label:v.label as Appearance['label'],face:v.face,effect:v.effect as SurfaceEffect};
}
export function collectionName(appearance:Appearance){return COLLECTION.find(c=>c.appearance.shape===appearance.shape&&c.appearance.label===appearance.label)?.name??'Squishy';}
