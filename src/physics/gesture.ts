import { shapePoint,type Cage,type Vec3 } from './cage';
import type { Contact } from './solver';
export const STANDARD_GESTURE={id:'material-press-v3',logicalPoint:[.2,1,.2] as Vec3,normal:[0,1,0] as Vec3,rampSeconds:.85,holdSeconds:2,recoverySeconds:5,maximumIntensity:.88,sustainStartSeconds:1,sustainRampSeconds:5};
export function standardLogicalPoint(cage:Cage):Vec3{return cage.shape==='donut'?[-.6,1,.2]:STANDARD_GESTURE.logicalPoint;}
// A held finger keeps sinking after the initial contact, with a bounded load.
export function sustainedPressureAt(elapsedSeconds:number){
  const t=Math.max(0,Math.min(1,(elapsedSeconds-STANDARD_GESTURE.sustainStartSeconds)/STANDARD_GESTURE.sustainRampSeconds));return t*t*(3-2*t);
}
export function pressureAt(elapsedSeconds:number,drag=0) {
  const t=Math.max(0,Math.min(1,elapsedSeconds/STANDARD_GESTURE.rampSeconds));
  // Continuous from zero, with a readable early dent and a gentle end to ramp.
  return Math.max(0,Math.min(1,(1-(1-t)**2)*STANDARD_GESTURE.maximumIntensity+drag));
}
export function standardContact(cage:Cage,elapsedSeconds:number,holdSeconds=Infinity):Contact|null {
  if(elapsedSeconds<0||elapsedSeconds+1e-10>=holdSeconds)return null;
  return {point:shapePoint(...standardLogicalPoint(cage),cage.radii,cage.shape),normal:STANDARD_GESTURE.normal,intensity:pressureAt(elapsedSeconds),sustain:sustainedPressureAt(elapsedSeconds)};
}
