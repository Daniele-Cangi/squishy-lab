export const SHAPE_IDS=['mochi','butter','strawberry','cube','chocolate','banana','cat','cheese','peanut'] as const;
export type ShapeId=typeof SHAPE_IDS[number];
export type SurfaceEffect='foam'|'glitter'|'clear';
export const FACE_EXPRESSIONS=['smile','happy','sleepy','wink','surprised'] as const;
export type FaceExpression=typeof FACE_EXPRESSIONS[number];
export interface Appearance {shape:ShapeId;label:'none'|'butter'|'strawberry';face:boolean;effect:SurfaceEffect;expression?:FaceExpression;text?:string;font?:'Chewy'|'Baloo 2'|'Pacifico'|'Short Stack'}
export const DEFAULT_APPEARANCE:Appearance={shape:'mochi',label:'none',face:true,effect:'foam',expression:'smile'};
export const COLLECTION:{id:string;name:string;note:string;color:string;appearance:Appearance}[]=[
  {id:'mochi',name:'Mochi',note:'The original little cloud',color:'#a996ee',appearance:DEFAULT_APPEARANCE},
  {id:'butter',name:'Butter',note:'Butter block with embossed lettering',color:'#edcf72',appearance:{shape:'butter',label:'butter',face:false,effect:'foam'}},
  {id:'berry-butter',name:'Strawberry',note:'Pink strawberry butter block',color:'#f29bb5',appearance:{shape:'butter',label:'strawberry',face:false,effect:'foam'}},
  {id:'berry',name:'Strawberry face',note:'Seeds, leaves and a smile',color:'#ee6078',appearance:{shape:'strawberry',label:'none',face:true,effect:'foam'}},
  {id:'jelly',name:'Jelly cube',note:'Clear with glitter',color:'#87cdda',appearance:{shape:'cube',label:'none',face:false,effect:'clear'}},
  {id:'chocolate',name:'Chocolate',note:'Six-piece chocolate bar',color:'#75422e',appearance:{shape:'chocolate',label:'none',face:false,effect:'foam'}},
  {id:'banana',name:'Banana',note:'Curved banana with a stem and peel',color:'#f4ce54',appearance:{shape:'banana',label:'none',face:false,effect:'foam'}},
  {id:'cat',name:'Cat',note:'Soft ears, a nose and whiskers',color:'#e9ab77',appearance:{shape:'cat',label:'none',face:true,effect:'foam'}},
  {id:'cheese',name:'Cheese',note:'A cheese wedge with little holes',color:'#f3be4d',appearance:{shape:'cheese',label:'none',face:false,effect:'foam'}},
  {id:'peanut',name:'Peanut',note:'Two-lobed peanut with a textured shell',color:'#d4a46e',appearance:{shape:'peanut',label:'none',face:false,effect:'foam'}},
];
export function validateAppearance(value:unknown):Appearance{
  if(!value||typeof value!=='object')throw new Error('Invalid appearance');
  const v=value as Record<string,unknown>;
  if(!SHAPE_IDS.includes(v.shape as ShapeId)||!['none','butter','strawberry'].includes(String(v.label))||!['foam','glitter','clear'].includes(String(v.effect))||typeof v.face!=='boolean'||(v.shape!=='butter'&&v.label!=='none'))throw new Error('Invalid appearance');
  if(v.expression!==undefined&&!FACE_EXPRESSIONS.includes(v.expression as FaceExpression))throw new Error('Invalid expression');
  if(v.text!==undefined&&(typeof v.text!=='string'||v.text.length>40))throw new Error('Invalid text');
  if(v.font!==undefined&&!['Chewy','Baloo 2','Pacifico','Short Stack'].includes(String(v.font)))throw new Error('Invalid font');
  return {...(v.text!==undefined?{text:v.text as string}:{}),...(v.font!==undefined?{font:v.font as Appearance['font']}:{}),shape:v.shape as ShapeId,label:v.label as Appearance['label'],face:v.face,effect:v.effect as SurfaceEffect,...(v.expression!==undefined?{expression:v.expression as FaceExpression}:{})};
}
export function collectionName(appearance:Appearance){return COLLECTION.find(c=>c.appearance.shape===appearance.shape&&c.appearance.label===appearance.label)?.name??'Squishy';}

