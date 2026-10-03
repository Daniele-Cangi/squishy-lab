# Local squishy collection

The collection is authored locally and works without a provider or a network AI call. The model, prompts, worker and `SquishySpec v1` are unchanged. `Appearance` in `src/collection.ts` selects a local shape, a closed set of print assets, an optional face, and a visual surface effect. It has a separate validated storage key; neither it nor asset URLs are supplied by the model.

| Entry | Body geometry | Details |
|---|---|---|
| Mochi | Original spherified cube | Optional face |
| Butter | Wide, low rounded bar | Raised BUTTER, SALTED, weight lettering |
| Strawberry | Same rounded bar, pink | Raised STRAWBERRY, weight lettering, berry icon |
| Fragolina | Tapered strawberry, narrow underside | Face, seeds, five leaves |
| Jelly cube | Rounded cube | Refractive transmission and attached flecks |

Every entry supports soft-touch, glitter or transparent appearance, and a face. Collection selection applies the entry's base color while retaining material softness, recovery, damping, compressibility and proportions. Effects and faces preserve deformation. Switching body geometry releases contact and atomically replaces cage, welded render mesh and probes. The two bar prints share a body, so switching between their labels preserves its dent. Reset explicitly restores the current reference.

## Blender authoring

`scripts/export-workshop.ts` exports the exact runtime reference surfaces and cages into ignored `work/`. `scripts/blender-collection.py` runs Blender in background mode and builds triangle assets from editable font meshes and simple drawings. Tested with the installed Blender 5.2.2 LTS at `E:\blender.exe`.

- `assets/blender/squishy-collection.blend`: five editable named collections, original body meshes, separately editable print meshes, hidden cage references and hidden material-coordinate print templates.
- `public/assets/collection-details.json`: generated positions in face material coordinates, triangle indices and colors. No external fonts, textures, commercial photographs or logos are required by the browser.

The Python script is the reproducible source for the print library. Editing only the saved workshop does not automatically update the app: change the script and rebuild, or extend its export path for manual mesh edits. Windows Arial Bold is used if available, otherwise Blender's built-in font; rebuilding with a different font changes lettering geometry. The prebuilt library is committed, and neither Blender nor a font installation is a build dependency.

Bodies remain analytic so a new body cannot silently diverge from its physical cage. Each new shape maps both the 216 cage particles and the welded 5,402-vertex render surface with the same function. Existing positive sparse deformation weights remain in use. The unchanged solver operates on each shape's own edge lengths and rest tetrahedron volumes.

## Details and effects

Each print vertex locates one actual render triangle in material coordinates. Each frame it samples that triangle's current Float32 vertex positions and interpolated normal; relief height is applied along that normal. This attaches text, eyes, mouth, leaves and seeds to the same visible dent without a second simulation. Meshes are batched by color and disposed when replaced. The asynchronously loaded library always attaches to the current generation.

At rest, physics, surface embedding and GPU rendering sleep. Resize, rotation, material or appearance changes, asset loading and pressure wake the scene. Recovery continues at the existing bounded fixed timestep until the displacement is below 0.00001 scene units; there is no change to the material's recovery law.

Glitter is a deterministic set of 360 small colored flecks bound to the visible surface. Transparent appearance uses Three.js physical transmission, thickness, IOR, tint attenuation and a generated room environment. A local checker plane makes transmission visible. It does not implement liquid flow or loose particles inside a gel. Appearance controls do not change solver parameters, and a material A/B comparison keeps the local collection appearance equal throughout both phases.

## Verification

Unit coverage checks closed manifold surfaces, positive reference tetrahedra, compression safety and recovery for all three new body geometries. A relief test checks its measured distance from the actual deformed triangle and exact restoration after reset. Browser coverage checks keyboard pressure, all collection assets, effect/face state retention, persistence/deletion, preservation through material edits and A/B, cancellation of stale replies, and mobile layout.

Normal-time screenshots, press/recovery snapshots and video are in `evidence/collection/`. `collection.json` records actual physics times, source hash, browser/GPU and per-form performance samples. These are measurements on the recorded desktop renderer; emulated mobile checks establish layout and input behavior.

Local results: **88 unit tests** plus typecheck, lint and production build passed; **17 browser tests** passed in installed Chrome using the desktop GPU. The initial Windows SwiftShader run hit a timeout in the existing long material test, and the collection test initially assumed that switching between bar labels reset the dent. The latter test now explicitly resets before testing each rest/press pair, while the app correctly preserves the same body's deformation. The final installed-Chrome run used the same assertions; CI retains its default software renderer.

The final production build copied the detail library byte-for-byte (SHA-256 verified), and the base Worker dry run read the built assets and completed with `PROVIDER: disabled`. No Cloudflare upload or model call was performed for this follow-up.

Normal-time recording on Chrome 154 / AMD Vega 8, 1366×1100, DPR 1 completed without browser errors. Across the final 120 active samples for each entry, bars and strawberry had a **16.6 ms median / 25 ms P95** frame interval; the transparent cube had **24.9 ms median / 41.7 ms P95**. These short samples include video recording and press/recovery and do not establish sustained phone performance. Transparent transmission costs more than the opaque finish. At held snapshots, minimum tet ratios were 0.683 (bars), 0.757 (strawberry), and 0.771 (cube); rendered depths were about 0.204, 0.479 and 0.384 scene units respectively. Snapshots, not screenshot wait labels, identify actual achieved simulation time.
