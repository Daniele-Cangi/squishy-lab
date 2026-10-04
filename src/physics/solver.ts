import { compileSpec, type SquishySpec } from '../shared/spec';
import { generateCage, signedVolume, type Vec3 } from './cage';
import type { ShapeId } from '../collection';
export interface Contact { point:Vec3; normal:Vec3; intensity:number;sustain?:number }
export const FIXED_DT=1/120;
export class SoftBody {
  readonly cage;
  readonly positions:Float64Array;
  readonly velocity:Float64Array;
  readonly memory:Float64Array;
  private previous:Float64Array;
  private previousMemory:Float64Array;
  private targets:Float64Array;
  private edgeTargets:Float64Array;
  private volumeTargets:Float64Array;
  private edgeLambda:Float64Array;
  private volumeLambda:Float64Array;
  private gradient=new Float64Array(12);
  private influence:Float64Array;
  private config;
  contact:Contact|null=null;
  time=0;
  safetyBackoffs=0;
  constructor(public spec:SquishySpec,shape:ShapeId='mochi') {
    this.config=compileSpec(spec); this.cage=generateCage(spec,5,shape);
    this.positions=this.cage.rest.slice(); this.previous=this.positions.slice();
    this.velocity=new Float64Array(this.positions.length); this.memory=this.velocity.slice(); this.targets=this.positions.slice();
    this.previousMemory=this.memory.slice();
    this.edgeTargets=this.cage.lengths.slice(); this.volumeTargets=this.cage.volumes.slice();
    this.edgeLambda=this.edgeTargets.slice(); this.volumeLambda=this.volumeTargets.slice();
    this.influence=new Float64Array(this.cage.inverseMass.length);
  }
  setMaterial(spec:SquishySpec) { this.spec=spec; this.config=compileSpec(spec); }
  reset() { this.positions.set(this.cage.rest); this.velocity.fill(0); this.memory.fill(0); this.contact=null; this.time=0; }
  setContact(contact:Contact|null) {
    if(contact && (![...contact.point,...contact.normal,contact.intensity,contact.sustain??0].every(Number.isFinite)||Math.hypot(...contact.normal)<0.5)) { this.contact=null; return; }
    this.contact=contact ? {point:[...contact.point],normal:contact.normal.map(v=>v/Math.hypot(...contact.normal)) as Vec3,intensity:Math.max(0,Math.min(1,contact.intensity)),sustain:Math.max(0,Math.min(1,contact.sustain??0))} : null;
  }
  step(h=FIXED_DT) {
    if(h!==FIXED_DT) throw new Error('Use fixed physics timestep');
    const {rest,inverseMass:mass,edges,tets,volumes}=this.cage, p=this.positions,cfg=this.config;
    this.previous.set(p);this.previousMemory.set(this.memory);this.time+=h;
    const damping=Math.exp(-cfg.dampingRate*h), creep=1-Math.exp(-h/cfg.creepTau), decay=Math.exp(-h/cfg.recoveryTau);
    for(let i=0;i<p.length;i++) {
      if(this.contact) this.memory[i]+=(cfg.memoryFraction*(p[i]-rest[i])-this.memory[i])*creep;
      else this.memory[i]*=decay;
      this.targets[i]=rest[i]+this.memory[i];
      p[i]+=this.velocity[i]*damping*h;
    }
    for(let e=0;e<this.edgeTargets.length;e++) {
      const a=edges[e*2]*3,b=edges[e*2+1]*3,q=this.targets;
      this.edgeTargets[e]=Math.hypot(q[a]-q[b],q[a+1]-q[b+1],q[a+2]-q[b+2]);
    }
    for(let t=0;t<volumes.length;t++) {
      const j=t*4,v=signedVolume(this.targets,tets[j],tets[j+1],tets[j+2],tets[j+3]);
      this.volumeTargets[t]=Math.max(volumes[t]*0.4,volumes[t]+(v-volumes[t])*this.spec.compressibility);
    }
    const contact=this.contact;
    // Spread a top press over the thin bar's surface, not through its thickness.
    // The continuous normal blend leaves horizontal side pressure unchanged.
    const topSpread=contact&&this.cage.shape==='chocolate'
      ?1+(Math.min(2.5,Math.max(1,Math.sqrt(this.cage.radii[0]*this.cage.radii[2])/this.cage.radii[1]))-1)*Math.max(0,contact.normal[1])**4:1;
    if(contact) for(let i=0;i<mass.length;i++) {
      const dx=rest[i*3]-contact.point[0],dy=rest[i*3+1]-contact.point[1],dz=rest[i*3+2]-contact.point[2];
      const d=Math.hypot(dx,dy,dz);
      const along=dx*contact.normal[0]+dy*contact.normal[1]+dz*contact.normal[2];
      const distanceSquared=topSpread===1?d*d:along*along+Math.max(0,d*d-along*along)/(topSpread*topSpread);
      const radius=Math.min(...this.cage.radii)*(.65+.48*Math.sqrt(contact.intensity))*(1+.22*(contact.sustain??0));
      this.influence[i]=Math.exp(-2.5*distanceSquared/(radius*radius));
    }
    this.edgeLambda.fill(0); this.volumeLambda.fill(0);
    for(let iter=0;iter<6;iter++) {
      this.solveEdges(h);
      this.solveVolumes(h,false);
      const alpha=cfg.tetherCompliance/(h*h), tether=1/(1+alpha)/6;
      for(let i=0;i<mass.length;i++) {
        const j=i*3;
        if(!mass[i]) { p[j]=rest[j];p[j+1]=rest[j+1];p[j+2]=rest[j+2]; continue; }
        for(let a=0;a<3;a++) p[j+a]+=(this.targets[j+a]-p[j+a])*tether;
        if(contact && this.influence[i]>0.012) {
          const w=this.influence[i],depth=Math.min(...this.cage.radii)*0.65*contact.intensity*w*(1+.95*(contact.sustain??0));
          const along=(p[j]-rest[j])*contact.normal[0]+(p[j+1]-rest[j+1])*contact.normal[1]+(p[j+2]-rest[j+2])*contact.normal[2];
          // A finger pushes inward; it cannot pull recovering foam outward.
          // Unilateral contact keeps a new light press continuous with its dent.
          const correction=Math.min(0,-depth-along)/(1+cfg.contactCompliance/(h*h*w));
          for(let a=0;a<3;a++) p[j+a]+=contact.normal[a]*correction;
        }
        p[j+1]=Math.max(0.035,p[j+1]);
      }
      this.solveVolumes(h,true);
    }
    let safe=true;
    for(let t=0;t<volumes.length;t++) {const j=t*4; if(signedVolume(p,tets[j],tets[j+1],tets[j+2],tets[j+3])<volumes[t]*0.17) {safe=false;break;}}
    for(let i=0;i<p.length;i++) if(!Number.isFinite(p[i])||Math.abs(p[i]-rest[i])>2.5) {safe=false;break;}
    if(!safe) {p.set(this.previous);this.velocity.fill(0);this.memory.set(this.previousMemory);this.safetyBackoffs++;}
    else for(let i=0;i<p.length;i++) this.velocity[i]=(p[i]-this.previous[i])/h;
  }
  private solveEdges(h:number) {
    const {edges,inverseMass:mass}=this.cage,p=this.positions,alpha=this.config.edgeCompliance/(h*h);
    for(let e=0;e<this.edgeTargets.length;e++) {
      const a=edges[e*2],b=edges[e*2+1],i=a*3,j=b*3,w=mass[a]+mass[b]; if(!w) continue;
      const dx=p[i]-p[j],dy=p[i+1]-p[j+1],dz=p[i+2]-p[j+2],length=Math.hypot(dx,dy,dz); if(length<1e-8) continue;
      const dl=(-(length-this.edgeTargets[e])-alpha*this.edgeLambda[e])/(w+alpha);this.edgeLambda[e]+=dl;
      const s=dl/length;
      p[i]+=dx*s*mass[a];p[i+1]+=dy*s*mass[a];p[i+2]+=dz*s*mass[a];
      p[j]-=dx*s*mass[b];p[j+1]-=dy*s*mass[b];p[j+2]-=dz*s*mass[b];
    }
  }
  private solveVolumes(h:number,barrier:boolean) {
    const {tets,volumes,inverseMass:mass}=this.cage,p=this.positions,g=this.gradient;
    const alpha=barrier?0:this.config.volumeCompliance/(h*h);
    for(let t=0;t<volumes.length;t++) {
      const j=t*4,a=tets[j]*3,b=tets[j+1]*3,c=tets[j+2]*3,d=tets[j+3]*3;
      const v=signedVolume(p,tets[j],tets[j+1],tets[j+2],tets[j+3]);
      const target=barrier?volumes[t]*0.22:this.volumeTargets[t]; if(barrier&&v>=target) continue;
      const bx=p[b]-p[a],by=p[b+1]-p[a+1],bz=p[b+2]-p[a+2],cx=p[c]-p[a],cy=p[c+1]-p[a+1],cz=p[c+2]-p[a+2],dx=p[d]-p[a],dy=p[d+1]-p[a+1],dz=p[d+2]-p[a+2];
      const s=1/(6*volumes[t]);
      g[3]=(cy*dz-cz*dy)*s;g[4]=(cz*dx-cx*dz)*s;g[5]=(cx*dy-cy*dx)*s;
      g[6]=(dy*bz-dz*by)*s;g[7]=(dz*bx-dx*bz)*s;g[8]=(dx*by-dy*bx)*s;
      g[9]=(by*cz-bz*cy)*s;g[10]=(bz*cx-bx*cz)*s;g[11]=(bx*cy-by*cx)*s;
      for(let k=0;k<3;k++)g[k]=-g[3+k]-g[6+k]-g[9+k];
      let denominator=alpha;
      for(let k=0;k<4;k++)for(let axis=0;axis<3;axis++)denominator+=mass[tets[j+k]]*g[k*3+axis]**2;
      if(denominator<1e-12)continue;
      const lambda=barrier?0:this.volumeLambda[t],dl=(-(v-target)/volumes[t]-alpha*lambda)/denominator;
      if(!barrier)this.volumeLambda[t]+=dl;
      for(let k=0;k<4;k++)for(let axis=0;axis<3;axis++)p[tets[j+k]*3+axis]+=mass[tets[j+k]]*dl*g[k*3+axis];
    }
  }
  maxDisplacement() { let max=0; for(let i=0;i<this.positions.length;i+=3) max=Math.max(max,Math.hypot(this.positions[i]-this.cage.rest[i],this.positions[i+1]-this.cage.rest[i+1],this.positions[i+2]-this.cage.rest[i+2])); return max; }
  minVolumeRatio() { let min=Infinity;const {tets,volumes}=this.cage;for(let t=0;t<volumes.length;t++){const j=t*4;min=Math.min(min,signedVolume(this.positions,tets[j],tets[j+1],tets[j+2],tets[j+3])/volumes[t]);}return min; }
}
export class FixedClock {
  accumulator=0; droppedSeconds=0;
  advance(elapsed:number,step:()=>void) {
    if(!Number.isFinite(elapsed)||elapsed<0) return 0;
    // A hidden tab is a pause; no violent catch-up on resume.
    if(elapsed>0.25) {this.accumulator=0;this.droppedSeconds+=elapsed;return 0;}
    this.accumulator+=elapsed;let steps=0;
    while(this.accumulator+1e-10>=FIXED_DT&&steps<8) {step();this.accumulator-=FIXED_DT;steps++;}
    if(this.accumulator>=FIXED_DT){this.droppedSeconds+=this.accumulator;this.accumulator=0;}
    return steps;
  }
  pause(){this.accumulator=0;}
}
