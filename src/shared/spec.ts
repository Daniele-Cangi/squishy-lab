export interface SquishySpec {
  version: 1;
  archetype: 'mochi';
  proportions: { width: number; height: number; depth: number };
  color: string;
  finish: 'matte' | 'satin';
  softness: number;
  compressibility: number;
  recoverySeconds: number;
  damping: number;
}
export type SpecPatch = Partial<Omit<SquishySpec, 'version' | 'archetype' | 'proportions'>> & {
  proportions?: Partial<SquishySpec['proportions']>;
};
export interface ModelOutput { version: 1; status: 'ok' | 'unsupported'; patch: SpecPatch; message?: string }
export interface SquishyRequest {
  version: 1; mode: 'create' | 'modify'; prompt: string; current?: SquishySpec; turnstileToken?: string;
}
export interface SquishyResponse {
  version: 1; status: 'ok' | 'unsupported'; spec: SquishySpec; patch: SpecPatch;
  message: string; corrections: string[]; repaired: boolean; provider: 'mock' | 'workers-ai';
}
export const DEFAULT_SPEC: SquishySpec = {
  version: 1, archetype: 'mochi', proportions: { width: 1.18, height: 0.88, depth: 1.08 },
  color: '#a996ee', finish: 'matte', softness: 0.84, compressibility: 0.78,
  recoverySeconds: 4.5, damping: 0.88,
};
export const PRESETS: { name: string; description: string; spec: SquishySpec }[] = [
  { name: 'Purple cloud', description: 'Foam · slow rise', spec: DEFAULT_SPEC },
  { name: 'Peach mochi', description: 'Foam · a little firmer', spec: { ...DEFAULT_SPEC, color: '#f6aa8b', softness: 0.48, recoverySeconds: 2.3 } },
  { name: 'Blue pop', description: 'Bouncy · quick return', spec: { ...DEFAULT_SPEC, color: '#77c8ea', softness: 0.65, compressibility: 0.2, recoverySeconds: 0.45, damping: 0.38, finish: 'satin' } },
];
const ranges = { softness: [0.1, 1], compressibility: [0.05, 0.95], recoverySeconds: [0.3, 12], damping: [0.2, 1] } as const;
export class ValidationError extends Error {}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Expected an object');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new ValidationError('Unknown field');
}
function number(value: unknown, min: number, max: number, name: string, corrections: string[], correct: boolean) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError(`Invalid ${name}`);
  if (value < min || value > max) {
    // Only a 2% boundary overshoot is repairable, and always reported.
    if (!correct || value < min - (max - min) * 0.02 || value > max + (max - min) * 0.02) throw new ValidationError(`Out of range: ${name}`);
    corrections.push(`${name}: ${value} → ${Math.max(min, Math.min(max, value))}`);
  }
  return Math.max(min, Math.min(max, value));
}
export function validatePatch(input: unknown, correct = false): { patch: SpecPatch; corrections: string[] } {
  const value = record(input), corrections: string[] = [];
  keys(value, ['proportions', 'color', 'finish', ...Object.keys(ranges)]);
  const patch: SpecPatch = {};
  if (value.proportions !== undefined) {
    const p = record(value.proportions); keys(p, ['width', 'height', 'depth']);
    if (!Object.keys(p).length) throw new ValidationError('Empty proportions');
    patch.proportions = {};
    for (const axis of ['width', 'height', 'depth'] as const) if (p[axis] !== undefined) patch.proportions[axis] = number(p[axis], 0.65, 1.6, axis, corrections, correct);
  }
  if (value.color !== undefined) {
    if (typeof value.color !== 'string' || !/^#[\da-f]{6}$/i.test(value.color)) throw new ValidationError('Invalid color');
    patch.color = value.color.toLowerCase();
  }
  if (value.finish !== undefined) {
    if (value.finish !== 'matte' && value.finish !== 'satin') throw new ValidationError('Invalid finish');
    patch.finish = value.finish;
  }
  for (const name of Object.keys(ranges) as (keyof typeof ranges)[]) if (value[name] !== undefined) patch[name] = number(value[name], ranges[name][0], ranges[name][1], name, corrections, correct);
  return { patch, corrections };
}
export function validateSpec(input: unknown): SquishySpec {
  const v = record(input);
  keys(v, ['version', 'archetype', 'proportions', 'color', 'finish', ...Object.keys(ranges)]);
  if (v.version !== 1 || v.archetype !== 'mochi') throw new ValidationError('Unsupported spec version/archetype');
  const { patch } = validatePatch(Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'version' && k !== 'archetype')));
  if (Object.keys(patch).length !== 7 || !patch.proportions || Object.keys(patch.proportions).length !== 3) throw new ValidationError('Incomplete spec');
  const spec = { ...v, ...patch } as unknown as SquishySpec;
  if (Math.max(...Object.values(spec.proportions)) / Math.min(...Object.values(spec.proportions)) > 2.4) throw new ValidationError('Aspect ratio exceeds safe domain');
  return spec;
}
export function applyPatch(base: SquishySpec, patch: SpecPatch): SquishySpec {
  return validateSpec({ ...base, ...patch, proportions: { ...base.proportions, ...patch.proportions } });
}
export function validateModelOutput(input: unknown) {
  const v = record(input); keys(v, ['version', 'status', 'patch', 'message']);
  if (v.version !== 1 || (v.status !== 'ok' && v.status !== 'unsupported')) throw new ValidationError('Invalid model status');
  if (v.message !== undefined && (typeof v.message !== 'string' || v.message.length > 200)) throw new ValidationError('Invalid message');
  const result = validatePatch(v.patch, true);
  if (v.status === 'unsupported' && Object.keys(result.patch).length) throw new ValidationError('Unsupported request must not mutate spec');
  if (v.status === 'ok' && !Object.keys(result.patch).length) throw new ValidationError('No changes interpreted');
  return { output: { ...v, patch: result.patch } as unknown as ModelOutput, corrections: result.corrections };
}
export function validateRequest(input: unknown): SquishyRequest {
  const v = record(input); keys(v, ['version', 'mode', 'prompt', 'current', 'turnstileToken']);
  if (v.version !== 1 || (v.mode !== 'create' && v.mode !== 'modify') || typeof v.prompt !== 'string' || !v.prompt.trim() || v.prompt.length > 500) throw new ValidationError('Invalid request');
  if (v.mode === 'modify' && !v.current) throw new ValidationError('Current spec required');
  if (v.mode === 'create' && v.current !== undefined) throw new ValidationError('Create cannot carry a current spec');
  if (v.turnstileToken !== undefined && (typeof v.turnstileToken !== 'string' || v.turnstileToken.length > 2048)) throw new ValidationError('Invalid verification token');
  return { version: 1, mode: v.mode, prompt: v.prompt.trim(), ...(v.current ? { current: validateSpec(v.current) } : {}), ...(v.turnstileToken ? { turnstileToken: v.turnstileToken as string } : {}) };
}
export function compileSpec(raw: SquishySpec) {
  const spec = validateSpec(raw);
  const p = spec.proportions, normalize = Math.cbrt(p.width * p.height * p.depth);
  return {
    radii: [1.22 * p.width / normalize, 0.92 * p.height / normalize, 1.08 * p.depth / normalize] as [number, number, number],
    edgeCompliance: 0.000002 + spec.softness ** 2 * 0.00012,
    volumeCompliance: 0.0000002 + spec.compressibility ** 2 * 0.00004,
    tetherCompliance: 0.000003 + spec.softness ** 2 * 0.00045,
    contactCompliance: 0.000025 + (1 - spec.softness) ** 2 * 0.0012,
    dampingRate: 3 + spec.damping * 32,
    memoryFraction: Math.min(0.98, 0.35 + spec.recoverySeconds * 0.14),
    recoveryTau: spec.recoverySeconds / Math.log(10),
    creepTau: 0.6,
    roughness: spec.finish === 'matte' ? 0.83 : 0.48,
  };
}
