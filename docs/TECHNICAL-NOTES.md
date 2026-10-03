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

The visual surface has 30 subdivisions per logical face: 5,402 shared vertices and 10,800 triangles. Base displacement embedding uses the containing logical tetrahedron's four barycentric weights. The analytic rest-surface offset retains a round surface rather than showing the coarse cage. Five positive graph-average passes smooth the **displacement** to remove tetra-boundary creases. These passes are compiled once into sparse node weights; every visual vertex is consequently a deterministic weighted function of cage displacement, with no independent simulation. Shared logical edge/corner vertices prevent seams. Normals and bounding spheres are recomputed after deformation; picking uses this deformed geometry.

The initial measured surface update was about 7.1 ms median. Compiling the averaging operator reduced it to about 2.5 ms in the same headless hardware-rendered browser sample. No worker, WASM or compute shader was added.

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

Contact is a compliant local target projected along an outward normal. Its rest-space Gaussian neighborhood transmits deformation through nearby nodes and constraints. Input intensity is separate: 0.18 + 0.70 times a 0.85-second hold ramp, plus downward drag / 160 pixels, clamped to 0.15–1. Nominal target depth is `0.65 * minimumRadius * intensity`. The hardware `pressure` property is unused. Raycasts update the material coordinate when dragging; the indicator is attached to the currently deformed triangle. Camera changes are explicit buttons and release contact first.

## Stability and scope

Each iteration applies a unilateral 22%-of-rest tet-volume barrier. After a substep, a tet below 17%, a nonfinite coordinate or a displacement above 2.5 units rejects the step, restores its previous safe coordinates and clears velocity/delayed state. The backup is a guard, not the ordinary behavior; the recorded standard and repeated-cycle tests needed no backoffs. Pressure and proportions are bounded. General self-collision and arbitrary mesh self-intersection prevention are not implemented.

Frames accumulate fixed steps, at most eight per render frame. A gap over 250 ms is treated as a pause, not a catch-up request. Visibility/focus loss and pointer cancellation release the contact. Limited numerical variation across browsers is expected. Tolerances: residual maximum displacement <0.004 scene units after 12 seconds of release (well below one displayed pixel at the test view), tet ratio >0.17, >1.6× soft/firm displacement under the same standard input, and slow residual >0.12 vs fast <0.02 after one second in unit tests. Render-rate traces compare the same fixed physical time; they do not compare per-frame coefficients.

## Patches and extensions

AI output is `{version:1,status,patch,message?}`; only implemented fields may occur in the patch. Create merges with defaults, modify merges with the supplied current spec; proportions merge per axis. Unsupported requests must have an empty patch and cannot change the object. The client recomputes the merge and refuses an inconsistent full spec. Generation tickets are invalidated by a newer request, preset, reset or saved-spec deletion; stale responses cannot apply.

A future archetype can add a generator behind the cage/surface interface and extend the enum/schema/prompt/tests together. The current interface and generated responses advertise only mochi. Supporting animal silhouettes or holes requires a genuinely implemented generator and discretization, not renaming this mesh.
