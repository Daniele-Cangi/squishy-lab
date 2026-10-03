export const SHAPE_IDS=['mochi','butter','strawberry','cube','chocolate','banana','cat','cheese','peanut'] as const;
export type ShapeId=typeof SHAPE_IDS[number];
export type SurfaceEffect='foam'|'glitter'|'clear';
export interface Appearance {shape:ShapeId;label:'none'|'butter'|'strawberry';face:boolean;effect:SurfaceEffect}
export const DEFAULT_APPEARANCE:Appearance={shape:'mochi',label:'none',face:false,effect:'foam'};
export const COLLECTION:{id:string;name:string;note:string;color:string;appearance:Appearance}[]=[
  {id:'mochi',name:'Mochi',note:'La nuvola originale',color:'#a996ee',appearance:DEFAULT_APPEARANCE},
  {id:'butter',name:'Butter',note:'Panetto con scritte in rilievo',color:'#edcf72',appearance:{shape:'butter',label:'butter',face:false,effect:'foam'}},
  {id:'berry-butter',name:'Strawberry',note:'Panetto rosa con fragolina',color:'#f29bb5',appearance:{shape:'butter',label:'strawberry',face:false,effect:'foam'}},
  {id:'berry',name:'Fragolina',note:'Semini, foglie e sorriso',color:'#ee6078',appearance:{shape:'strawberry',label:'none',face:true,effect:'foam'}},
  {id:'jelly',name:'Jelly cube',note:'Trasparente con glitter',color:'#87cdda',appearance:{shape:'cube',label:'none',face:false,effect:'clear'}},
  {id:'chocolate',name:'Cioccolato',note:'Tavoletta con sei quadretti',color:'#75422e',appearance:{shape:'chocolate',label:'none',face:false,effect:'foam'}},
  {id:'banana',name:'Banana',note:'Curva, con picciolo e buccia',color:'#f4ce54',appearance:{shape:'banana',label:'none',face:false,effect:'foam'}},
  {id:'cat',name:'Gatto',note:'Orecchie morbide, musetto e baffi',color:'#e9ab77',appearance:{shape:'cat',label:'none',face:true,effect:'foam'}},
  {id:'cheese',name:'Formaggio',note:'Spicchio con piccoli incavi',color:'#f3be4d',appearance:{shape:'cheese',label:'none',face:false,effect:'foam'}},
  {id:'peanut',name:'Peanut',note:'Arachide a due lobi, guscio a reticolo',color:'#d4a46e',appearance:{shape:'peanut',label:'none',face:false,effect:'foam'}},
];
export function validateAppearance(value:unknown):Appearance{
  if(!value||typeof value!=='object')throw new Error('Invalid appearance');
  const v=value as Record<string,unknown>;
  if(!SHAPE_IDS.includes(v.shape as ShapeId)||!['none','butter','strawberry'].includes(String(v.label))||!['foam','glitter','clear'].includes(String(v.effect))||typeof v.face!=='boolean'||(v.shape!=='butter'&&v.label!=='none'))throw new Error('Invalid appearance');
  return {shape:v.shape as ShapeId,label:v.label as Appearance['label'],face:v.face,effect:v.effect as SurfaceEffect};
}
export function collectionName(appearance:Appearance){return COLLECTION.find(c=>c.appearance.shape===appearance.shape&&c.appearance.label===appearance.label)?.name??'Squishy';}
