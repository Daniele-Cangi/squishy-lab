# Next collection — research and design proposal

Research date: October 6, 2026. Status: all five models implemented; see [collection implementation notes](COLLECTION.md#five-model-expansion--october-6-2026) for topology and asset details. Research below records the original selection rationale.

## Demand evidence and its limits

There is no verified public unit-sales ranking for these five individual shapes. This selection combines manufacturer demand signals, retailer bestseller categories, visual variety and feasibility in Squishy Lab. It is a development recommendation, not a global sales leaderboard.

- [Schylling's official NeeDoh site](https://schylling.com/needoh/) reports exceptional demand and online sellouts for the brand. This is a brand-level signal, not a ranking of its individual models.
- Official product references: [Gumdrop](https://schylling.com/product/needoh-gumdrop/), [Dream Drop](https://schylling.com/product/needoh-dream-drop/) and [Dohnuts](https://schylling.com/product/needoh-dohnuts/). These establish product forms and features, not relative sales.
- [Doctor Squish's bestseller collection](https://www.doctorsquish-store.com/collections/frontpage) includes cat paws, capybara and donut/waffle forms among many entries. Inclusion is a retailer signal; list position is not treated as sales rank. Its [capybara page](https://www.doctorsquish-store.com/products/capybara-squishy) confirms the rounded, slow-rising animal concept.

The existing Jelly cube already covers the cube category. The proposed additions use original modeling, proportions, colors and names for Squishy Lab.

## Five proposed models

| Working name | Visual brief | Modeling and deformation approach | Complexity |
| --- | --- | --- | --- |
| Sugar Drop | Rounded candy dome with a flat seat, translucent pastel tint and fine sugar-like surface relief | Continuous body map shared by physical cage and visible skin. Keep relief shallow; compare modeled coarse texture with baked fine normals. Bake export needs a new reproducible texture path. | Medium |
| Jelly Drop | Full lower body narrowing into a soft rounded tip; clear aqua, pink or lavender with attached sparkle | Smooth taper with a substantial tip so coarse physical cells remain valid. Pressure must work on top and sides. Sparkles use the existing attached-fleck system. | Medium |
| Kitty Paw | Four rounded toe lobes, a broad palm, pink central pad and four small pads | Lobes form one continuous body, with shallow separations. Pads are bound relief with smooth transitions, rather than floating rigid pieces. Present the pad side to the default camera. | Medium–high |
| Sleepy Capybara | Reclining rounded body, blunt projecting muzzle, small round ears, short feet and sleepy eyes | Body and main silhouette features share the physical mapping. Use broad attached ears and feet; start with an anatomical gray prototype to verify recognizability before adding color and face. | High |
| Glazed Donut | Genuine central hole, golden dough, uneven glossy icing and a small set of attached sprinkles | Requires a toroidal physical volume and matching surface embedding. The current solid cube-derived cage cannot create a real hole through a regular shape map. First prove ring pressure and recovery with a plain torus; then add icing and bound sprinkles. | Very high |

Faces, text and emoji should work on each model. Each needs a deliberate personalization area: the paw palm, capybara flank and front arc of the donut, avoiding holes and narrow protrusions. Preserve the chosen expression when a message temporarily replaces the face.

## Shared implementation work

The current bodies are authored by `shapePoint` in `src/physics/cage.ts`. Both physical particles and the visible surface use the same reference mapping. Blender currently provides editable references and bound detail assets; importing an arbitrary sculpted Blender mesh does not automatically make it deform correctly.

1. Create a reproducible Blender study for each silhouette: neutral clay, default colors, clear finish and a pressed reference. Judge the silhouette without facial decoration first.
2. Define the matching runtime body and broad relief. Separate visual microdetail from the physical volume so small texture features do not destabilize the cage.
3. Extend appearance coloring where needed. Preserve authored accents when users or AI change the base color; the paw pads and donut icing need explicit rules. Verify clear finish behavior rather than assuming opaque paint and transparency compose correctly.
4. Bind each decoration and personalization patch to the actual deforming surface. For the donut, build ring-specific bindings and hit testing; a separate toroidal body path should preserve the existing solid-body path.
5. Export assets reproducibly from scripts. Load only the selected model's additional textures, if textures are introduced. Measure transparent rendering and detail cost on mobile before setting asset budgets.

Gel and Crunchy remain user-selectable. Initial feel suggestions are candy/drop with Gel, paw/capybara with slow recovery, and donut with a soft foam-like preset. These are toy tuning choices, not measurements of commercial products.

## Delivery order and acceptance

Recommended order: Jelly Drop, Sugar Drop, Kitty Paw, Sleepy Capybara, then Glazed Donut. Build and verify each independently before adding the next. The donut begins with a topology feasibility prototype; its decorated asset follows only after that prototype passes.

For each model:

- Recognizable at the default mobile camera size, at rest and under a sustained press.
- Valid physical reference volumes and a closed visible surface; stress tests at thin proportions and maximum sustained load.
- Press top, sides, underside, narrow features and decoration boundaries; release and reset must restore the shape.
- No floating pads, eyes, lettering, icing or sprinkles during a dent or drag.
- Base color, finishes, expressions, mixed text/emoji, saved settings and PNG export remain coherent.
- Record frame times and asset sizes against the current app baseline, including a real Android device when available. Browser emulation alone is not device-performance evidence.
- Existing collection regression checks remain green. These new shapes do not require changing the AI material contract.

If the torus prototype needs a broader solver redesign, keep the first four independent and reconsider the fifth. A decorated cake slice is a possible solid-body alternative, but would be a new selection rather than a disguised donut with a filled hole.
