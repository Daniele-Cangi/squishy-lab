import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export function evidenceContext(){
  const files=['src/physics/solver.ts','src/physics/cage.ts','src/physics/gesture.ts','src/shared/spec.ts','src/scene.ts','src/main.ts','src/copy.ts','src/view.ts','src/style.css'];
  const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(readFileSync(file));}
  return {measuredAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtimeSourceSha256:hash.digest('hex'),node:process.version,platform:process.platform};
}
