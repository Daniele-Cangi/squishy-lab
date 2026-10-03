# Deformation and parameter contract

## SquishySpec v1

All numbers are finite. Unknown fields, missing spec fields, unsupported versions, stringified numbers and unsupported archetypes are rejected. Complete specs are validated on both server and client. Only model patches permit a boundary overshoot of at most 2% of the field's range; it is clipped and reported in `corrections`. Larger errors get at most one model repair, then rejection. Invalid data is never silently converted into a preset.

| Field | Range/unit | Implemented meaning |
|---|---|---|
| `version` | literal `1` | Contract version |
| `archetype` | `mochi` | The only implemented rounded blob family |
| `proportions.width/height/depth` | 0.65–1.6, dimensionless | Relative axes; divided by the cube root of their product to preserve reference volume. Largest/smallest axis ratio must be ≤2.4 |
| `color` | `#rrggbb` | Surface base color; canonical lowercase |
| `finish` | `matte` / `satin` | Roughness 0.83 / 0.48, opaque in both cases |
| `softness` | 0.1–1, dimensionless | Increasing edge/tether compliance and decreasing contact resistance; larger values dent further under the same virtual load |
| `compressibility` | 0.05–0.95, dimensionless | Volume compliance and how much delayed volume reduction is retained. Lower values cause more lateral redistribution |
| `recoverySeconds` | 0.3–12 seconds | Approximate time for contact-axis indentation to fall to 10% of its post-release value after the standard two-second press |
| `damping` | 0.2–1, dimensionless | Velocity dissipation rate, independent of recovery decay |

Geometry units are arbitrary scene units, not millimeters. No physical modulus, density or calibrated force is claimed. The full compiler lives in `src/shared/spec.ts`, rather than passing model numbers directly to constraints.

## Cage and visual surface

A logical cube with five cells per axis is mapped continuously through a spherified-cube function into an ellipsoidal mochi. Each cell uses six conforming Freudenthal tetrahedra: 216 particles and 750 tets. Negative initial orientations are reordered, near-zero volumes are rejected, rest lengths/volumes remain immutable, edges are deduplicated. Tests check positive orientation, node connectivity and the welded visual surface's two-triangles-per-edge manifold.

The visual surface has 30 subdivisions per logical face: 5,402 shared vertices and 10,800 triangles. Trilinear displacement weights on the containing cage cell avoid exposing a tetrahedron's selected diagonal as a visible crease. Eight positive graph-average passes smooth the **displacement**, compiled once into sparse weights. The analytic rest geometry is unchanged. Every visual vertex remains a deterministic weighted function of cage displacement, with no independent simulation, overshooting filter or deformation shader. Shared logical edge/corner vertices prevent seams. Normals and bounds follow the deformed surface; picking uses that geometry.

`surfacePoint` locates a triangle once in logical material coordinates, retaining its three barycentric weights. The visible depth samples the actual Float32 surface after the same embedding used by rendering, along a fixed normalized contact axis. `sampledSurfaceDepth` computes the same three embedded vertices without updating the entire mesh; a regression compares it to the actual surface buffer throughout pressure and recovery. The four-node tetrahedral cage probe is retained separately as `internalCageDepthUnits`, never labeled visible indentation. `measure:surface` records transverse profiles and both observables.

The initial graph-filter implementation took about 7.1 ms median. Compiling the averaging operator avoids graph passes each frame; the final hardware-rendered Chrome sample measured 3.8 ms median for surface, normals and bounds, with an 8.3 ms frame interval. See the recorded sample and conditions in the verification report. No worker, WASM or compute shader was added.

## Solver and delayed state

Physics runs at 120 Hz with six local iterations. Distance and normalized tetra-volume constraints accumulate XPBD multipliers within each substep; compliance is divided by `h²`. Velocity is attenuated by `exp(-(3+32*damping)*h)`. A reference-relative positional tether provides resistance and prevents free translation. A small underside cap is fixed to the support, and free particles cannot move below the floor.

Every particle stores delayed displacement `m`, distinct from velocity and immutable rest position `r`:

```text
while pressing: m ← m + (memoryFraction * (x-r) - m) * (1-exp(-h/0.6))
after release:  m ← m * exp(-h / (recoverySeconds / ln(10)))
delayed target q = r + m
```

`memoryFraction = min(0.98, 0.35 + 0.14*recoverySeconds)`. Edges target lengths of `q`; positional tethers target `q`; the volume target blends the delayed volume with reference volume according to compressibility, bounded below at 40%. The actual state remains coupled by cage constraints. This captures spatial delayed strain under repeated contacts rather than replaying a global release animation. Reference coordinates never accumulate plastic edits. Material changes retain current deformation and update the coefficients; proportional changes rebuild the entire representation.

Compiler compliances (toy scene units) are:

```text
edge    = 0.000002 + 0.00012 * softness²
volume  = 0.0000002 + 0.00004 * compressibility²
tether  = 0.000003 + 0.00045 * softness²
contact = 0.000025 + 0.0012 * (1-softness)²
```

Contact is unilateral: the finger pushes inward and cannot pull the foam outward. This fixes the reproduced snap when lightly re-pressing a recovering dent. Its Gaussian radius grows from light to held pressure: `minimumRadius * (0.65 + 0.48*sqrt(intensity))`, with weight `exp(-2.5*distance²/radius²)`. Nominal depth remains `0.65 * minimumRadius * intensity`; it was not amplified to compensate for filtering.

`src/physics/gesture.ts` defines the runtime, A/B and measurement gesture: logical material point `[0.2,1,0.2]`, normal `[0,1,0]`, ramp 0.85 s, hold 2 s, then recovery. Intensity is `0.88*(1-(1-clamp(age/0.85))²)`, plus downward drag / 220 pixels, clamped to 0–1. Age is sampled inside each 120 Hz physics step, not once per rendered frame. The baseline used a front-side point and different runtime/script ramps; its video and measurements remain identified separately.

Raycasts on the deformed surface recover the immutable reference coordinate. Reference normals determine force, smoothed over 0.12 s on drag, preventing the dent from rotating and reinforcing its own force. The thin open marker follows the deformed triangle; keyboard and comparison pressure also show that marker. Camera rotation releases contact. Hardware pressure sensors are unused.

## Stability and scope

Each iteration applies a unilateral 22%-of-rest tet-volume barrier. A tet below 17%, nonfinite coordinate or displacement above 2.5 units rejects the step, restores previous safe coordinates AND previous delayed memory, and clears velocity. Memory is preserved rather than erased by a backoff. Standard and repeated-cycle measurements needed no backoffs. General self-collision remains outside scope.

Frames accumulate fixed steps, at most eight per render frame. A gap over 250 ms is treated as a pause, not a catch-up request. Visibility/focus loss and pointer cancellation release the contact. Limited numerical variation across browsers is expected. Tolerances: residual maximum displacement <0.004 scene units after 12 seconds of release (well below one displayed pixel at the test view), tet ratio >0.17, >1.6× soft/firm displacement under the same standard input, and slow residual >0.12 vs fast <0.02 after one second in unit tests. Render-rate traces compare the same fixed physical time; they do not compare per-frame coefficients.

## Patches and extensions

AI output is `{version:1,status,patch,message?}`; only implemented fields may occur in the patch. Create merges with defaults, modify merges with the supplied current spec; proportions merge per axis. Unsupported requests must have an empty patch and cannot change the object. The client recomputes the merge and refuses an inconsistent full spec. Generation tickets are invalidated by a newer request, preset, reset or saved-spec deletion; stale responses cannot apply.

Explicit named protection clauses have conservative server guards; unrecognized wording remains the model's task. Clear faster/slower recovery wording rejects a contradictory time direction. Guards do not generate, clip or silently remove fields. A rejected model patch receives one explanatory repair at most; a second rejection retains the current object. These checks complement schema validation and do not guarantee arbitrary natural-language understanding.

A sent Turnstile token is consumed immediately. A newly mounted widget receives a new generation; callbacks from an old generation are ignored. Cancellation and old `finally` handlers cannot reuse the spent token or clear a newer one. Abort and timeout terminate awaiting work and prohibit a repair; they cannot guarantee cancellation of an already-started Workers AI binding call. The separate local REST harness aborts its HTTP transport, also without promising provider GPU cancellation.

The A/B command uses one scene, resets positions, velocity and memory between phases, fixes appearance to the before spec, and restores the actual edited spec on interruption/completion. Text comes from applied parameters. Italian markup is in `src/view.ts`, material/status vocabulary in `src/copy.ts`, without a localization dependency. Lighting, camera and an open marker changed; no external mesh or Blender build dependency was introduced.

During mobile description focus, the same canvas becomes a compact sticky preview above the composer. Its height follows `visualViewport.height`, and returns to full play size on blur. ResizeObserver resizes the renderer without rebuilding or clearing material state. A reduced-viewport browser test checks that the object remains visible while typing; actual phone keyboards remain unverified.

A future archetype can add a generator behind the cage/surface interface and extend the enum/schema/prompt/tests together. The current interface and generated responses advertise only mochi. Supporting animal silhouettes or holes requires a genuinely implemented generator and discretization, not renaming this mesh.
