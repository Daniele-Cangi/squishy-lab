# Local squishy collection

The collection is authored locally and works without a provider or a network AI call. `SquishySpec v1` remains the material contract. `Appearance` in `src/collection.ts` selects a local shape, a closed set of print assets, an optional face and expression, and a visual surface effect. It has a separate validated storage key; neither it nor asset URLs are supplied by the model. The English release adds five expressions, enables Mochi's default smile and replaces the clear-finish checkerboard with a cream confetti tray. Its [captures](../evidence/english-moods/moods.json) preserve the rendered bindings and mobile checks.

| Entry | Body geometry | Details |
|---|---|---|
| Mochi | Original spherified cube | Default smile; five optional expressions |
| Butter | Wide, low rounded bar | Raised BUTTER, SALTED, weight lettering |
| Strawberry | Same rounded bar, pink | Raised STRAWBERRY, weight lettering, berry icon |
| Strawberry face | Tapered strawberry, narrow underside | Five expressions, seeds, five leaves |
| Jelly cube | Rounded cube | Refractive transmission and attached flecks |
| Chocolate | Low rounded slab with six integral raised squares | COCOA relief and groove lines |
| Banana | Rounded cross sections rotated along an upward arc, extended stem | Olive stem, brown ends, peel seams and small freckles |
| Cat | Rounded head with two integral soft ears | Pink inner ears, stripes, five expressions, nose and whiskers |
| Cheese | Rounded triangular wedge with seven recessed pockets | Subdivided pocket linings follow the bowls |
| Peanut | Two slightly unequal rounded lobes and a narrow waist | Sculpted shell grain, material-bound color variation and a seam |
| Jelly Drop | Smooth tapered teardrop with a rounded tip | Clear finish and attached sparkle by default |
| Sugar Drop | Broad seated candy dome, narrower crown | Deterministic locally generated bump texture and attached sparkle |
| Kitty Paw | Broad palm with four integral toe lobes | Four raised pink toe pads and a heart-shaped palm pad |
| Sleepy Capybara | Rounded body with integral ear relief and a broad projecting muzzle | Inner-ear pads, light muzzle pigment, nostrils, paw markings and five expressions |
| Glazed Donut | Periodic toroidal volume with an actual center hole | Curved icing with a clipped wavy edge, attached sprinkles and a front-arc message area |

Every entry supports soft-touch, glitter or transparent appearance, and a face. Collection selection applies the entry's base color while retaining material softness, recovery, damping, compressibility and proportions. Effects and faces preserve deformation. Switching body geometry releases contact and atomically replaces cage, welded render mesh and probes. The two bar prints share a body, so switching between their labels preserves its dent. Reset explicitly restores the current reference.

## Blender authoring

`scripts/export-workshop.ts` exports the exact runtime reference surfaces and cages into ignored `work/`. `scripts/blender-collection.py` runs Blender in background mode and builds triangle assets from editable font meshes and simple drawings. Tested with the installed Blender 5.2.2 LTS at `E:\blender.exe`.

- `assets/blender/squishy-collection.blend`: ten editable named collections in two rows, original body meshes, separately editable print meshes, hidden cage references and hidden material-coordinate print templates.
- Workshop objects rotate the runtime Y-up reference into Blender's native Z-up view. The exported browser detail coordinates remain unchanged.
- `public/assets/collection-details.json`: generated positions in face material coordinates, triangle indices and colors. No external fonts, textures, commercial photographs or logos are required by the browser.

The Python script is the reproducible source for the print library. Editing only the saved workshop does not automatically update the app: change the script and rebuild, or extend its export path for manual mesh edits. Windows Arial Bold is used if available, otherwise Blender's built-in font; rebuilding with a different font changes lettering geometry. The prebuilt library is committed, and neither Blender nor a font installation is a build dependency.

Bodies remain analytic so a new body cannot silently diverge from its physical cage. The solid forms use the cube-derived map; the donut uses the separate periodic ring map described below. Each new shape maps both the 216 cage particles and the welded 5,402-vertex render surface with the same function. Existing positive sparse deformation weights remain in use. The solver operates on each shape's own edge lengths and rest tetrahedron volumes.

The banana rotates rounded cross sections along its arc, with a separate continuous stem profile and fuller ends. A blend of logical and rounded axial coordinates keeps the coarse reference cells oriented through the bend. The peanut's waist, unequal lobes and shallow shell grain are part of the same body map; its color variation stays in material coordinates. Both shapes anchor their support at their actual lowest cage height. Cat ears stretch the same head surface; chocolate squares and cheese recesses are in the body map, not rigid attachments. Cage construction checks orientation against logical cells and rejects folded maps before normalizing tetrahedron winding. The banana camera shows the curved profile and backs away on narrow viewports. Other entries retain their framing.

The workshop export includes surface face grids, vertex normals, axial coordinates and color multipliers. Blender projects details with the same triangle barycentrics and interpolated normals as the browser, instead of maintaining a second copy of shape equations. This keeps the editable rest workshop coherent for every shape. The cheese lining uses five radial rings to follow its concave pockets. Banana tip pigment is clipped at the axial boundary before projection, avoiding jagged triangle edges. The workshop peanut has a matching vertex-color attribute.

## Details and effects

Each print vertex locates one actual render triangle in material coordinates. Each frame it samples that triangle's current Float32 vertex positions and interpolated normal; relief height is applied along that normal. This attaches text, eyes, mouth, leaves and seeds to the same visible dent without a second simulation. Meshes are batched by color and disposed when replaced. The asynchronously loaded library always attaches to the current generation.

At rest, physics, surface embedding and GPU rendering sleep. Resize, rotation, material or appearance changes, asset loading and pressure wake the scene. Recovery continues at the existing bounded fixed timestep until the displacement is below 0.00001 scene units; there is no change to the material's recovery law.

A stationary hold now adds a bounded smooth load from physical second one to six. It increases the nominal depth by up to 95% and contact radius by up to 22%, while the actual dent remains constrained by the material, shape and existing volume barriers. This applies to mouse, touch and keyboard. Release retains the existing delayed memory and recovery. Gesture metadata is versioned as `material-press-v3`; older recordings retain their original v2 metadata.

Glitter is a deterministic set of 360 small colored flecks bound to the visible surface. Transparent appearance uses Three.js physical transmission, thickness, IOR, tint attenuation and a generated room environment. A local checker plane makes transmission visible. It does not implement liquid flow or loose particles inside a gel. Appearance controls do not change solver parameters, and a material A/B comparison keeps the local collection appearance equal throughout both phases.

## Verification

Unit coverage checks closed manifold surfaces, reference cell orientation, compression safety and recovery for all eight additional body geometries. The expanded five also have maximum-pressure checks off center at thin proportions, distinctive silhouette/pocket checks, and bounded Blender detail bindings. A relief test checks its measured distance from the actual deformed triangle and exact restoration after reset. Browser coverage checks keyboard pressure, all collection assets, effect/face state retention, persistence/deletion, preservation through material edits and A/B, cancellation of stale replies, and the ten-entry mobile layout.

Normal-time screenshots, press/recovery snapshots and video are in `evidence/collection/`. `collection.json` records actual physics times, source hash, browser/GPU and per-form performance samples. These are measurements on the recorded desktop renderer; emulated mobile checks establish layout and input behavior.

Prior five-entry revision: **88 unit tests** plus typecheck, lint and production build passed; **17 browser tests** passed in installed Chrome using the desktop GPU. The initial Windows SwiftShader run hit a timeout in the existing long material test, and the collection test initially assumed that switching between bar labels reset the dent. The latter test now explicitly resets before testing each rest/press pair, while the app correctly preserves the same body's deformation. The final installed-Chrome run used the same assertions; CI retains its default software renderer.

The final production build copied the detail library byte-for-byte (SHA-256 verified), and the base Worker dry run read the built assets and completed with `PROVIDER: disabled`. No Cloudflare upload or model call was performed for this follow-up.

Two initial remote runs passed 16/17 but timed out creating the browser context after the accelerated transparent-render test. The virtual clock queued transmission frames faster than the software renderer consumed them. Collection tests now release their WebGL context during cleanup before Playwright tears down the browser context; all six collection cases then passed locally in SwiftShader with the same assertions and gesture timings.

Normal-time recording on Chrome 154 / AMD Vega 8, 1366×1100, DPR 1 completed without browser errors. Across the final 120 active samples for each entry, bars and strawberry had a **16.6 ms median / 25 ms P95** frame interval; the transparent cube had **24.9 ms median / 41.7 ms P95**. These short samples include video recording and press/recovery and do not establish sustained phone performance. Transparent transmission costs more than the opaque finish. At held snapshots, minimum tet ratios were 0.683 (bars), 0.757 (strawberry), and 0.771 (cube); rendered depths were about 0.204, 0.479 and 0.384 scene units respectively. Snapshots, not screenshot wait labels, identify actual achieved simulation time.

## Shape refinement and long-hold verification

`evidence/shape-refinement/` contains a separate normal-time real-mouse recording, 17 PNGs and metadata for the final banana, peanut and progressive contact load. Short and long snapshots record their actual physics ages and rendered triangle contact depth. On the recorded Chrome 154 / AMD Vega 8 desktop, the long/short depth ratios were 2.07× for mochi, 2.64× for banana and 2.04× for peanut, with zero backoffs and no browser errors. Both banana ends remain visible in the 390×844 mobile capture. See [verification conditions and measurements](VERIFICATION.md).

All 114 unit tests, typecheck, lint and the production build passed, together with all 25 installed-Chrome browser tests. New numerical regressions check sustained pressure and recovery for all nine bodies; the existing thin-proportion cases now include maximum sustained load. Three new browser cases use an actual stationary mouse contact to compare short and long dents and release. The saved Blender workshop was reopened and checked for matching skins, upright orientation, peanut color attributes and absent external fonts. Historical collection recordings below remain tied to their original source hashes and gesture version.

## Prior expanded collection verification

The five added entries were verified with **104 unit tests**, typecheck, lint and the production build; **22 browser tests** passed using installed Chrome and the desktop GPU. All five new pressure/recovery browser cases also passed separately in default SwiftShader, using the same assertions. The prebuilt detail library matches the production copy by SHA-256, and Worker dry-run packaging completed with the provider disabled.

`evidence/collection-expanded/` preserves a separate normal-time video, 19 PNGs and source/GPU/timing metadata. All five forms are captured at rest, held and recovering; additional captures show a glitter peanut with a face and real pointer drag, transparent cheese and the complete mobile gallery with a banana. The recording has no browser errors. Recorded median frame intervals were **16.6–16.7 ms**, with **24.9–33.2 ms P95**, across 120 active samples per form on Chrome 154 / AMD Vega 8 at 1366×1100, DPR 1. These are short desktop video samples, not sustained mobile performance measurements.


## Five-model expansion — October 6, 2026

The collection now has 15 entries and 14 body geometries. Research and selection are recorded in [the expansion proposal](NEXT-COLLECTION.md). These original local models do not change the AI material contract or consume inference quota.

The donut is a genuine toroidal body: 16 periodic angular cells, a 3-by-3 square-to-disk cross-section, 256 particles and 864 tetrahedra. Opposite angular endpoints share particle and skin indices. Its 3,600-vertex surface has Euler characteristic zero and no caps or triangles across the hole. The solid-body code path retains its existing topology and counts. Positive-volume checks also reject a folded ring reference before tetrahedra are reordered.

Physical constraints, fixed timestep, recovery and pointer capture remain the existing solver and interaction path. The standard donut squeeze uses a visible part of the ring. Its faces and custom messages occupy a short outer front arc; icing and sparkles use native ring coordinates. Ray picking samples the actual rendered mesh, so pressing the hole does not grab invisible geometry.

Icing edges are clipped against a smooth periodic profile instead of dropping whole grid cells. Icing inherits the parent skin's interpolated normals so independent paint triangles do not introduce visible facet seams; colored sprinkles remain bound relief. The paw pads have radial subdivisions and a varying offset. Capybara expression groups share a curved muzzle patch and nostrils, with five distinct moods. Text temporarily replaces its expression group. Authored accent colors remain stable when changing the body's base color.

Sugar grain is a deterministic 256-by-256 canvas bump texture generated only when Sugar Drop is selected. It is reused, follows material UV coordinates and is disposed with the scene. It adds no remote texture request and no physical particles. Clear is a visual transmission finish; neither sparkles nor sugar represent independent internal particles or liquid flow.

The Blender script rebuilds all 15 editable collections from the runtime references, including the ring cage and its pigment assets. The saved workshop and detail library are generated outputs; changes should be made to the scripts and mappings before rebuilding them.


Verification for this expansion: typecheck, lint, the production build and all **145 unit tests** passed. **25 browser cases** passed in installed Chrome, covering existing collection behavior, the five new bodies, recovery/reset, clear finish, expressions, text/emoji PNG export, the donut hole's mouse hit testing, and saved personalization. A separate 390-by-844 touch emulation run verified hold, release and recovery for all five models. The saved Blender workshop was reopened and all five new reference skins and editable collections were checked.

[Rest/held captures and diagnostics](../evidence/collection-next/captures.json), [touch diagnostics](../evidence/collection-next/touch.json) and PNGs in the same directory preserve the runtime source hash, conditions and snapshots. These are desktop/browser-emulation checks, not sustained performance measurements on a physical Android phone. `npx tsx scripts/record-next-collection.ts` reproduces the normal-time captures against a local server on port 5173; an alternate origin may be passed as the first argument. No remote AI inference was requested for this expansion.


### Upper pressure on low shapes

Chocolate and Glazed Donut use a broader contact footprint and a height-bounded penetration increase for upward-facing contact normals. The normal blend is continuous and leaves horizontal side pressure unchanged. Donut uses the local tube width instead of the full ring diameter. The existing volume barriers, floor support, contact ramp and recovery remain active.

The default 6.5-second hold increases the rendered contact depth from 0.255 to 0.380 for Chocolate and from 0.184 to 0.280 for Donut, compared with revision `9d5b402`. These are scene units under identical material and fixed-step input, not physical measurements. Both default probes have zero safety backoffs and recover to less than 0.002 displacement after 12 seconds. See `evidence/low-shapes/comparison.json` and the dedicated unit/browser tests for the input conditions.
Validation: `npm run check` passed all 152 unit tests, TypeScript, lint and production build. The 25 Chrome browser tests across collection, next collection and low shapes passed, including 390px touch emulation (not a physical Android device). Upper mouse holds, 12-second recovery and reset passed for both low shapes. The held screenshots in `evidence/low-shapes/` use the real mouse raycast contact; the numerical comparison uses the fixed standard probe.
