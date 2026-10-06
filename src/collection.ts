export const SHAPE_IDS=['mochi','butter','strawberry','cube','chocolate','banana','cat','cheese','peanut','drop','gumdrop','paw','capybara','donut'] as const;
export type ShapeId=typeof SHAPE_IDS[number];
export type SurfaceEffect='foam'|'glitter'|'clear';
export const FACE_EXPRESSIONS=['smile','happy','sleepy','wink','surprised'] as const;
export type FaceExpression=typeof FACE_EXPRESSIONS[number];
export interface Appearance {shape:ShapeId;label:'none'|'butter'|'strawberry';face:boolean;effect:SurfaceEffect;expression?:FaceExpression;text?:string;textColor?:string;font?:'Chewy'|'Baloo 2'|'Pacifico'|'Short Stack'}
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
  {id:'drop',name:'Jelly Drop',note:'A sparkling teardrop with a soft rounded tip',color:'#92cde3',appearance:{shape:'drop',label:'none',face:false,effect:'clear'}},
  {id:'gumdrop',name:'Sugar Drop',note:'A candy dome with a fine sugar texture',color:'#dc9ddd',appearance:{shape:'gumdrop',label:'none',face:false,effect:'glitter'}},
  {id:'paw',name:'Kitty Paw',note:'Four soft toes and raised pink pads',color:'#f1d9ca',appearance:{shape:'paw',label:'none',face:false,effect:'foam'}},
  {id:'capybara',name:'Sleepy Capybara',note:'A sleepy little friend with a broad muzzle',color:'#b68c69',appearance:{shape:'capybara',label:'none',face:true,expression:'sleepy',effect:'foam'}},
  {id:'donut',name:'Glazed Donut',note:'A real ring with pink icing and sprinkles',color:'#dfaa67',appearance:{shape:'donut',label:'none',face:false,effect:'foam'}},
];
export function validateAppearance(value:unknown):Appearance{
  if(!value||typeof value!=='object')throw new Error('Invalid appearance');
  const v=value as Record<string,unknown>;
  if(!SHAPE_IDS.includes(v.shape as ShapeId)||!['none','butter','strawberry'].includes(String(v.label))||!['foam','glitter','clear'].includes(String(v.effect))||typeof v.face!=='boolean'||(v.shape!=='butter'&&v.label!=='none'))throw new Error('Invalid appearance');
  if(v.expression!==undefined&&!FACE_EXPRESSIONS.includes(v.expression as FaceExpression))throw new Error('Invalid expression');
  if(v.text!==undefined&&(typeof v.text!=='string'||v.text.length>40))throw new Error('Invalid text');
  if(v.font!==undefined&&!['Chewy','Baloo 2','Pacifico','Short Stack'].includes(String(v.font)))throw new Error('Invalid font');
  if(v.textColor!==undefined&&(typeof v.textColor!=='string'||!/^#[0-9a-f]{6}$/i.test(v.textColor)))throw new Error('Invalid text color');
  return {...(v.textColor!==undefined?{textColor:v.textColor as string}:{}),...(v.text!==undefined?{text:v.text as string}:{}),...(v.font!==undefined?{font:v.font as Appearance['font']}:{}),shape:v.shape as ShapeId,label:v.label as Appearance['label'],face:v.face,effect:v.effect as SurfaceEffect,...(v.expression!==undefined?{expression:v.expression as FaceExpression}:{})};
}
export function collectionName(appearance:Appearance){return COLLECTION.find(c=>c.appearance.shape===appearance.shape&&c.appearance.label===appearance.label)?.name??'Squishy';}

