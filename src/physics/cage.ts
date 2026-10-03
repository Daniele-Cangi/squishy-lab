import { compileSpec, type SquishySpec } from '../shared/spec';
export type Vec3 = [number, number, number];
export interface Cage {
  rest: Float64Array; logical: Float64Array; inverseMass: Float64Array;
  tets: Uint16Array; volumes: Float64Array; edges: Uint16Array; lengths: Float64Array;
  cells: number; radii: Vec3;
}
export function roundedPoint(x: number, y: number, z: number, r: Vec3): Vec3 {
  // Spherified cube, continuous throughout the volume. Bottom is gently seated.
  const px = x * Math.sqrt(1 - y*y/2 - z*z/2 + y*y*z*z/3);
  const py = y * Math.sqrt(1 - z*z/2 - x*x/2 + z*z*x*x/3);
  const pz = z * Math.sqrt(1 - x*x/2 - y*y/2 + x*x*y*y/3);
  return [px*r[0], r[1]*(py + 1) + 0.04, pz*r[2]];
}
export function signedVolume(p: ArrayLike<number>, a: number, b: number, c: number, d: number): number {
  a*=3; b*=3; c*=3; d*=3;
  const bx=p[b]-p[a], by=p[b+1]-p[a+1], bz=p[b+2]-p[a+2];
  const cx=p[c]-p[a], cy=p[c+1]-p[a+1], cz=p[c+2]-p[a+2];
  const dx=p[d]-p[a], dy=p[d+1]-p[a+1], dz=p[d+2]-p[a+2];
  return (bx*(cy*dz-cz*dy) + by*(cz*dx-cx*dz) + bz*(cx*dy-cy*dx))/6;
}
export const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
export function generateCage(spec: SquishySpec, cells=5): Cage {
  const radii=compileSpec(spec).radii, n=cells+1, count=n**3;
  const rest=new Float64Array(count*3), logical=new Float64Array(count*3), inverseMass=new Float64Array(count).fill(1);
  const id=(x:number,y:number,z:number)=> x + n*(y+n*z);
  for(let z=0;z<n;z++) for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const i=id(x,y,z), q:Vec3=[2*x/cells-1,2*y/cells-1,2*z/cells-1];
    logical.set(q,i*3); rest.set(roundedPoint(...q,radii),i*3);
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
  return {rest,logical,inverseMass,tets:Uint16Array.from(ts),volumes:Float64Array.from(vs),edges,lengths,cells,radii};
}
export interface SurfaceEmbedding {
  rest: Float32Array; indices: Uint16Array; nodes: Uint16Array; weights: Float64Array;
  neighborOffsets:Uint32Array; neighbors:Uint16Array;
  deformationOffsets:Uint32Array; deformationNodes:Uint16Array; deformationWeights:Float64Array;
}
export function createSurface(cage:Cage, subdivisions=30):SurfaceEmbedding {
  const rest:number[]=[], indices:number[]=[], nodes:number[]=[], weights:number[]=[], map=new Map<string,number>();
  const n=cage.cells+1, id=(p:number[])=>p[0]+n*(p[1]+n*p[2]);
  function vertex(q:Vec3) {
    const key=q.map(v=>Math.round(v*subdivisions)).join(',');
    const found=map.get(key); if(found!==undefined) return found;
    const index=rest.length/3; map.set(key,index); rest.push(...roundedPoint(...q,cage.radii));
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
    for(let v=0;v<subdivisions;v++) for(let u=0;u<subdivisions;u++) {
      const a=grid[u+(subdivisions+1)*v],b=grid[u+1+(subdivisions+1)*v],c=grid[u+(subdivisions+1)*(v+1)],d=grid[u+1+(subdivisions+1)*(v+1)];
      if((axis===1?-1:1)*sign>0) indices.push(a,b,c,b,d,c); else indices.push(a,c,b,b,c,d);
    }
  }
  const adjacent=Array.from({length:rest.length/3},()=>new Set<number>());
  for(let i=0;i<indices.length;i+=3)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b)adjacent[indices[i+a]].add(indices[i+b]);
  const offsets=[0],neighbors:number[]=[];
  for(const set of adjacent){neighbors.push(...set);offsets.push(neighbors.length);}
  // Compile five graph-diffusion passes into one sparse cage-to-surface map.
  // Positive weights preserve coherence and avoid overshoot; no visual solver state.
  let maps=adjacent.map((_,v)=>{const map=new Map<number,number>();for(let k=0;k<4;k++){const weight=weights[v*4+k];if(weight>0)map.set(nodes[v*4+k],(map.get(nodes[v*4+k])??0)+weight);}return map;});
  for(let pass=0;pass<5;pass++) maps=maps.map((own,v)=>{
    const result=new Map<number,number>();const add=(map:Map<number,number>,factor:number)=>{for(const [node,weight]of map)result.set(node,(result.get(node)??0)+weight*factor);};
    add(own,.5);for(const neighbor of adjacent[v])add(maps[neighbor],.5/adjacent[v].size);return result;
  });
  const deformationOffsets=[0],deformationNodes:number[]=[],deformationWeights:number[]=[];
  for(const map of maps){const total=[...map.values()].reduce((a,b)=>a+b);for(const [node,weight]of map){deformationNodes.push(node);deformationWeights.push(weight/total);}deformationOffsets.push(deformationNodes.length);}
  return {rest:Float32Array.from(rest),indices:Uint16Array.from(indices),nodes:Uint16Array.from(nodes),weights:Float64Array.from(weights),neighborOffsets:Uint32Array.from(offsets),neighbors:Uint16Array.from(neighbors),deformationOffsets:Uint32Array.from(deformationOffsets),deformationNodes:Uint16Array.from(deformationNodes),deformationWeights:Float64Array.from(deformationWeights)};
}
export function embedSurface(cage:Cage, positions:Float64Array, surface:SurfaceEmbedding, out:Float32Array) {
  for(let v=0;v<surface.rest.length/3;v++) for(let axis=0;axis<3;axis++) {
    let delta=0;
    for(let k=surface.deformationOffsets[v];k<surface.deformationOffsets[v+1];k++) { const p=surface.deformationNodes[k]*3+axis; delta+=surface.deformationWeights[k]*(positions[p]-cage.rest[p]); }
    out[v*3+axis]=surface.rest[v*3+axis]+delta;
  }
}
