import { compileSpec, type SquishySpec } from '../shared/spec';
import type { ShapeId } from '../collection';
export type Vec3 = [number, number, number];
export interface Cage {
  rest: Float64Array; logical: Float64Array; inverseMass: Float64Array;
  tets: Uint16Array; volumes: Float64Array; edges: Uint16Array; lengths: Float64Array;
  cells: number; radii: Vec3; shape:ShapeId;
}
export function roundedPoint(x: number, y: number, z: number, r: Vec3): Vec3 {
  // Spherified cube, continuous throughout the volume. Bottom is gently seated.
  const px = x * Math.sqrt(1 - y*y/2 - z*z/2 + y*y*z*z/3);
  const py = y * Math.sqrt(1 - z*z/2 - x*x/2 + z*z*x*x/3);
  const pz = z * Math.sqrt(1 - x*x/2 - y*y/2 + x*x*y*y/3);
  return [px*r[0], r[1]*(py + 1) + 0.04, pz*r[2]];
}
export function shapePoint(x:number,y:number,z:number,r:Vec3,shape:ShapeId='mochi'):Vec3{
  if(shape==='mochi')return roundedPoint(x,y,z,r);
  const unit=roundedPoint(x,y,z,[1,1,1]),sx=unit[0],sy=unit[1]-1.04,sz=unit[2];
  if(shape==='strawberry'){
    const taper=.6+.4*(sy+1)/2;
    return [sx*r[0]*taper,(sy+1)*r[1]+.04,sz*r[2]*taper];
  }
  const round=shape==='butter'?.22:.35;
  return [(x*(1-round)+sx*round)*r[0],(y*(1-round)+sy*round+1)*r[1]+.04,(z*(1-round)+sz*round)*r[2]];
}
export function signedVolume(p: ArrayLike<number>, a: number, b: number, c: number, d: number): number {
  a*=3; b*=3; c*=3; d*=3;
  const bx=p[b]-p[a], by=p[b+1]-p[a+1], bz=p[b+2]-p[a+2];
  const cx=p[c]-p[a], cy=p[c+1]-p[a+1], cz=p[c+2]-p[a+2];
  const dx=p[d]-p[a], dy=p[d+1]-p[a+1], dz=p[d+2]-p[a+2];
  return (bx*(cy*dz-cz*dy) + by*(cz*dx-cx*dz) + bz*(cx*dy-cy*dx))/6;
}
export const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
export function generateCage(spec: SquishySpec, cells=5,shape:ShapeId='mochi'): Cage {
  const radii=compileSpec(spec).radii.map((v,a)=>v*(shape==='butter'?[1.35,.65,.74][a]:shape==='strawberry'?[.9,1.2,.9][a]:shape==='cube'?[.82,1.05,.93][a]:1)) as Vec3, n=cells+1, count=n**3;
  const rest=new Float64Array(count*3), logical=new Float64Array(count*3), inverseMass=new Float64Array(count).fill(1);
  const id=(x:number,y:number,z:number)=> x + n*(y+n*z);
  for(let z=0;z<n;z++) for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const i=id(x,y,z), q:Vec3=[2*x/cells-1,2*y/cells-1,2*z/cells-1];
    logical.set(q,i*3); rest.set(shapePoint(...q,radii,shape),i*3);
    // The low underside is held on a small invisible soft support.
    if (rest[i*3+1] < 0.04+radii[1]*0.16) inverseMass[i]=0;
  }
  const ts:number[]=[], vs:number[]=[], edgeSet=new Set<string>();
  for(let z=0;z<cells;z++) for(let y=0;y<cells;y++) for(let x=0;x<cells;x++) {
    for(const order of permutations) {
      const q=[x,y,z], verts=[id(...q as Vec3)];
      for(const axis of order) { q[axis]++; verts.push(id(...q as Vec3)); }
      let v=signedVolume(rest,verts[0],verts[1],verts[2],verts[3]);
      if(v<0) { [verts[1],verts[2]]=[verts[2],verts[1]]; v=-v; }
      if(!Number.isFinite(v)||v<1e-7) throw new Error('Degenerate procedural tetrahedron');
      ts.push(...verts); vs.push(v);
      for(let a=0;a<4;a++) for(let b=a+1;b<4;b++) edgeSet.add([verts[a],verts[b]].sort((a,b)=>a-b).join(','));
    }
  }
  const edges=Uint16Array.from([...edgeSet].flatMap(k=>k.split(',').map(Number)));
  const lengths=new Float64Array(edges.length/2);
  for(let e=0;e<lengths.length;e++) { const a=edges[e*2]*3,b=edges[e*2+1]*3; lengths[e]=Math.hypot(rest[a]-rest[b],rest[a+1]-rest[b+1],rest[a+2]-rest[b+2]); }
  return {rest,logical,inverseMass,tets:Uint16Array.from(ts),volumes:Float64Array.from(vs),edges,lengths,cells,radii,shape};
}
export interface SurfaceEmbedding {
  faceGrids:{axis:number;sign:number;grid:number[]}[];subdivisions:number;
  rest: Float32Array; logical:Float32Array; indices: Uint16Array; nodes: Uint16Array; weights: Float64Array;
  neighborOffsets:Uint32Array; neighbors:Uint16Array;
  deformationOffsets:Uint32Array; deformationNodes:Uint16Array; deformationWeights:Float64Array;
}
export function createSurface(cage:Cage, subdivisions=30):SurfaceEmbedding {
  const faceGrids:SurfaceEmbedding['faceGrids']=[];
  const rest:number[]=[], logical:number[]=[], indices:number[]=[], nodes:number[]=[], weights:number[]=[], map=new Map<string,number>();
  const n=cage.cells+1, id=(p:number[])=>p[0]+n*(p[1]+n*p[2]);
  function vertex(q:Vec3) {
    const key=q.map(v=>Math.round(v*subdivisions)).join(',');
    const found=map.get(key); if(found!==undefined) return found;
    const index=rest.length/3; map.set(key,index); rest.push(...shapePoint(...q,cage.radii,cage.shape));logical.push(...q);
    const g=q.map(v=>(v+1)*cage.cells/2), cell=g.map(v=>Math.min(cage.cells-1,Math.floor(v))), f=g.map((v,i)=>v-cell[i]);
    const order=[0,1,2].sort((a,b)=>f[b]-f[a]), path=[...cell];
    nodes.push(id(path));
    for(const axis of order) { path[axis]++; nodes.push(id(path)); }
    weights.push(1-f[order[0]], f[order[0]]-f[order[1]], f[order[1]]-f[order[2]], f[order[2]]);
    return index;
  }
  for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
    const other=[0,1,2].filter(a=>a!==axis), grid:number[]=[];
    for(let v=0;v<=subdivisions;v++) for(let u=0;u<=subdivisions;u++) {
      const q:Vec3=[0,0,0]; q[axis]=sign; q[other[0]]=u*2/subdivisions-1; q[other[1]]=v*2/subdivisions-1;
      grid.push(vertex(q));
    }
    faceGrids.push({axis,sign,grid});
    for(let v=0;v<subdivisions;v++) for(let u=0;u<subdivisions;u++) {
      const a=grid[u+(subdivisions+1)*v],b=grid[u+1+(subdivisions+1)*v],c=grid[u+(subdivisions+1)*(v+1)],d=grid[u+1+(subdivisions+1)*(v+1)];
      if((axis===1?-1:1)*sign>0) indices.push(a,b,c,b,d,c); else indices.push(a,c,b,b,c,d);
    }
  }
  const adjacent=Array.from({length:rest.length/3},()=>new Set<number>());
  for(let i=0;i<indices.length;i+=3)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b)adjacent[indices[i+a]].add(indices[i+b]);
  const offsets=[0],neighbors:number[]=[];
  for(const set of adjacent){neighbors.push(...set);offsets.push(neighbors.length);}
  // Trilinear displacement avoids making a tetrahedron's chosen diagonal a
  // visible crease. The reference remains the exact procedural surface.
  // Compile eight graph-diffusion passes into one sparse cage-to-surface map.
  // Positive weights preserve coherence and avoid overshoot; no visual solver state.
  let maps=adjacent.map((_,v)=>{
    const g=[0,1,2].map(a=>(logical[v*3+a]+1)*cage.cells/2),cell=g.map(v=>Math.min(cage.cells-1,Math.floor(v))),f=g.map((v,i)=>v-cell[i]),map=new Map<number,number>();
    for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++){
      const weight=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);
      if(weight>0)map.set(id([cell[0]+x,cell[1]+y,cell[2]+z]),weight);
    }
    return map;
  });
  for(let pass=0;pass<8;pass++) maps=maps.map((own,v)=>{
    const result=new Map<number,number>();const add=(map:Map<number,number>,factor:number)=>{for(const [node,weight]of map)result.set(node,(result.get(node)??0)+weight*factor);};
    add(own,.5);for(const neighbor of adjacent[v])add(maps[neighbor],.5/adjacent[v].size);return result;
  });
  const deformationOffsets=[0],deformationNodes:number[]=[],deformationWeights:number[]=[];
  for(const map of maps){const total=[...map.values()].reduce((a,b)=>a+b);for(const [node,weight]of map){deformationNodes.push(node);deformationWeights.push(weight/total);}deformationOffsets.push(deformationNodes.length);}
  return {faceGrids,subdivisions,rest:Float32Array.from(rest),logical:Float32Array.from(logical),indices:Uint16Array.from(indices),nodes:Uint16Array.from(nodes),weights:Float64Array.from(weights),neighborOffsets:Uint32Array.from(offsets),neighbors:Uint16Array.from(neighbors),deformationOffsets:Uint32Array.from(deformationOffsets),deformationNodes:Uint16Array.from(deformationNodes),deformationWeights:Float64Array.from(deformationWeights)};
}
export function embedSurface(cage:Cage, positions:Float64Array, surface:SurfaceEmbedding, out:Float32Array) {
  for(let v=0;v<surface.rest.length/3;v++) for(let axis=0;axis<3;axis++) {
    out[v*3+axis]=embeddedCoordinate(cage,positions,surface,v,axis);
  }
}
function embeddedCoordinate(cage:Cage,positions:Float64Array,surface:SurfaceEmbedding,v:number,axis:number) {
  let delta=0;for(let k=surface.deformationOffsets[v];k<surface.deformationOffsets[v+1];k++){const p=surface.deformationNodes[k]*3+axis;delta+=surface.deformationWeights[k]*(positions[p]-cage.rest[p]);}
  return surface.rest[v*3+axis]+delta;
}
export function sampledSurfaceDepth(cage:Cage,positions:Float64Array,surface:SurfaceEmbedding,point:MaterialPoint,normal:Vec3) {
  let depth=0;const length=Math.hypot(...normal);
  for(let k=0;k<point.nodes.length;k++)for(let axis=0;axis<3;axis++){
    const v=point.nodes[k],shown=Math.fround(embeddedCoordinate(cage,positions,surface,v,axis));
    depth+=(surface.rest[v*3+axis]-shown)*point.weights[k]*normal[axis]/length;
  }
  return depth;
}
export interface MaterialPoint {nodes:number[];weights:number[]}
export function facePoint(surface:SurfaceEmbedding,axis:number,sign:number,u:number,v:number):MaterialPoint{
  const face=surface.faceGrids.find(f=>f.axis===axis&&f.sign===sign)!;const n=surface.subdivisions;
  const gu=(Math.max(-1,Math.min(1,u))+1)*n/2,gv=(Math.max(-1,Math.min(1,v))+1)*n/2,x=Math.min(n-1,Math.floor(gu)),y=Math.min(n-1,Math.floor(gv)),fu=gu-x,fv=gv-y;
  const a=face.grid[x+(n+1)*y],b=face.grid[x+1+(n+1)*y],c=face.grid[x+(n+1)*(y+1)],d=face.grid[x+1+(n+1)*(y+1)];
  return fu+fv<=1?{nodes:[a,b,c],weights:[1-fu-fv,fu,fv]}:{nodes:[b,d,c],weights:[1-fv,fu+fv-1,1-fu]};
}
export function cagePoint(cage:Cage,q:Vec3):MaterialPoint {
  const g=q.map(v=>(v+1)*cage.cells/2),cell=g.map(v=>Math.min(cage.cells-1,Math.floor(v))),f=g.map((v,i)=>v-cell[i]);
  const order=[0,1,2].sort((a,b)=>f[b]-f[a]),path=[...cell],nodes:number[]=[],n=cage.cells+1;
  const id=()=>path[0]+n*(path[1]+n*path[2]);nodes.push(id());for(const axis of order){path[axis]++;nodes.push(id());}
  return {nodes,weights:[1-f[order[0]],f[order[0]]-f[order[1]],f[order[1]]-f[order[2]],f[order[2]]]};
}
// Locate a triangle once in material coordinates, then keep its barycentrics.
// Sampling the already embedded Float32 positions uses the exact render map.
export function surfacePoint(surface:SurfaceEmbedding,q:Vec3):MaterialPoint {
  const p=surface.logical;
  for(let t=0;t<surface.indices.length;t+=3){
    const nodes=Array.from(surface.indices.slice(t,t+3)),[a,b,c]=nodes.map(v=>v*3);
    const u=q.map((_,i)=>p[b+i]-p[a+i]),v=q.map((_,i)=>p[c+i]-p[a+i]),w=q.map((x,i)=>x-p[a+i]);
    const dot=(a:number[],b:number[])=>a.reduce((sum,x,i)=>sum+x*b[i],0);
    const uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),den=uu*vv-uv*uv;
    if(den<1e-12)continue;
    const y=(vv*wu-uv*wv)/den,z=(uu*wv-uv*wu)/den,x=1-y-z;
    if(Math.min(x,y,z)<-1e-6||Math.hypot(...w.map((n,i)=>n-y*u[i]-z*v[i]))>1e-5)continue;
    return {nodes,weights:[x,y,z]};
  }
  throw new Error('Material point is outside the surface');
}
export function samplePoint(positions:ArrayLike<number>,point:MaterialPoint):Vec3 {
  const result:Vec3=[0,0,0];for(let k=0;k<point.nodes.length;k++)for(let a=0;a<3;a++)result[a]+=positions[point.nodes[k]*3+a]*point.weights[k];return result;
}
export function pointDepth(rest:ArrayLike<number>,positions:ArrayLike<number>,point:MaterialPoint,normal:Vec3) {
  const before=samplePoint(rest,point),after=samplePoint(positions,point),length=Math.hypot(...normal);
  return before.reduce((sum,n,a)=>sum+(n-after[a])*normal[a]/length,0);
}
