# Refinement verification — 3 October 2026

## Local collection follow-up

The AI backend, model, prompts and v1 material contract are unchanged in this follow-up. The lab adds two printed bars, a smiling strawberry and a refractive cube, with locally selected faces, glitter and transparency. Blender 5.2.2 LTS was found at `E:\blender.exe` and used to generate the editable workshop and relief library. Body and cage geometry remain coherent; labels and facial details follow the actual render triangles. See [implementation and collection evidence](COLLECTION.md). Prior AI and hardware results below refer to their recorded revisions.

Local validation passed **88 unit tests**, typecheck, lint and production build, and **17 installed-Chrome browser tests**. The [normal-time collection video](../evidence/collection/collection.webm), [snapshots and performance metadata](../evidence/collection/collection.json), and [mobile view](../evidence/collection/mobile.png) record the final UI. Idle physics and rendering now sleep and are explicitly checked to wake on interaction. Opaque collection entries recorded a 16.6 ms median frame interval during the video; the transparent cube recorded 24.9 ms. These short recorded samples are distinct from the historical mochi benchmark below.

## AI material result, retained

User follow-up: “un monchi giallo molto duro” was rejected by the real model; correcting the spelling to “mochi” still failed. The first prompt clarification passed only 3/6 targeted cases and also added unrequested damping in a relative edit; that miss remains in `ai-history/ai-live-firmness-followup-v1.json`. Clear Italian firmness instructions now pass **6/6 targeted live regressions**, plus **3/3 prior smoke regressions**, without repair. In both create and modify, yellow very-firm foam has softness **0.15**; “più duro” preserves unrequested fields, negated hardness remains soft, and a panda remains unsupported. The exact typo phrase was applied and rendered in Chrome: [screenshot](../evidence/refined/firm-yellow-followup.png), [responses and usage](../evidence/refined/ai-live-firmness-followup.json). These are scoped follow-up checks; the full 26-case live corpus below belongs to the preceding prompt version and was not rerun for this fix. The harness's yellow classifier was corrected to distinguish yellow from peach before this live run; no semantic bands were relaxed.

The preview also returned HTTP 401 using an expired startup OAuth token. It now obtains current credentials through Wrangler before each model call, without logging them or retrying inference. Controlled tests cover renewal, explicit environment credentials, the unchanged call cap and cancellation before inference. **82 unit tests**, typecheck, lint and build passed after the fix; browser UI and physics are unchanged. See [Cloudflare setup](CLOUDFLARE.md) for credential timing and limits.

The real Cloudflare phrase → validated patch → material loop was exercised in Chrome. “Uguale, ma meno molle” changed softness from 0.84 to 0.59 while preserving color and recovery. Normal-time A/B samples around physical second 1.5 measured rendered depth **0.36005 → 0.28512 scene units**, about **21% less**. A second real request accelerated recovery without changing color; a shark request was unsupported and retained the object. The [video](../evidence/refined/ai-live-browser.webm), [screenshots](../evidence/refined/ai-live-before.png) and [response/model/gesture metadata](../evidence/refined/ai-live-browser.json) record the loop. This uses an opt-in loopback REST adapter, not deployed Turnstile or edge-rate verification.

## Reproduced defects and corrections

- A new light contact pulled a recovering dent outward in one step (0.1667 units in the regression). Unilateral inward contact fixes that snap and preserves delayed memory.
- Runtime pressure and numerical scripts used different ramps and sampling schedules. Both now use the same gesture, sampled at 120 Hz; A/B resets physical state and fixes appearance and camera.
- A cancelled generation could reuse a spent Turnstile token, and old cleanup could disturb a newer token. The widget is renewed at send; generation checks reject stale callbacks. Controlled browser tests cover cancellation, new tokens, old callbacks and client timeout.
- Invalid output arriving after the total model deadline could launch another call. Budget/abort checks now prevent repair after expiration or cancellation. Binding inference can still finish remotely; a local promise race is not provider cancellation.
- A valid-looking AI patch changed explicitly protected softness, and another increased recovery for “accorcia la risalita.” Conservative protection/direction validators reject these contradictions and permit at most one model repair, retaining the object on failure.

## Real AI evidence

All expectations were fixed before each campaign. The original 26-case corpus is separate from eight paraphrases. Five further phrases were reserved after the first protection validator; their initial 4/5 result found the opposite recovery direction. That miss was fixed and the same five became regression cases. They are **not** claimed as unseen evaluation after the fix. No corpus expectations were relaxed. Historical runs and the harness error are preserved in `evidence/refined/ai-history/`.

| Run | Schema-valid | Meaning + preservation | Repair |
|---|---:|---:|---:|
| Initial Llama 3B corpus | 24/26 | 18/26 | 3 |
| Latest pre-protection 3B, revised semantic prompt | 22/26 | 14/26 | 4 |
| 8B, same revised semantic prompt with JSON Schema | 26/26 | 22/26 | 0 |
| Qwen3 before guards, corpus | 26/26 | 26/26 | 0 |
| Qwen3 before guards, eight paraphrases | 8/8 | 7/8 | 0 |
| Final Qwen3 + validators, corpus | 26/26 | 26/26 | 0 |
| Final Qwen3 + validators, eight paraphrase regressions | 8/8 | 8/8 | 0 |
| Five reserved phrases, initial / corrected regression | 5/5 | 4/5 → 5/5 | 0 → 1 |

The choice of Qwen3 is an engineering response to measured Llama misses, within the same Workers AI service. It is not a blinded model leaderboard or a guarantee for arbitrary phrasing. The final corpus used 26 calls and **124.50 neurons** reported by Cloudflare; eight paraphrases used 8 calls / **38.88 neurons**, and five regressions used 6 calls / **29.92 neurons**. These are campaign subtotals, not the account's total usage. Provider call median/P95 for the corpus were **390/621 ms**; script row duration additionally includes a numerical material check. All texts were synthetic. Credentials stayed in process memory. Workers Free was confirmed by the user because subscription read returned 403; no paid plan, Gateway billing, deployment or resource creation was activated.

## Surface and physical behavior

Current `evidence/refined/physics.*` and `surface.json` distinguish the persistent **rendered Float32 surface** probe from the internal tetrahedral cage probe. The top press is defined in `src/physics/gesture.ts`; the baseline front-side press used a different location/ramp, so these are not identical-force baseline comparisons. Baseline images/video/profile data in `baseline-b169dc8` and the older root files are retained.

| Material | Rendered peak | Internal cage peak | Rendered T90 after release | Residual after 12 s | Minimum sampled tet ratio |
|---|---:|---:|---:|---:|---:|
| Foam, softness 0.84 | 0.36556 | 0.42471 | 4.383 s | 0.000759 | 0.7149 |
| Same foam, softness 0.22 | 0.14950 | 0.18081 | 4.442 s | 0.000286 | 0.8458 |
| Recovery target 0.45 s | 0.33550 | 0.39097 | 0.342 s | <0.000001 | 0.7426 |
| Elastic comparison | 0.32916 | 0.38355 | 0.308 s | <0.000001 | 0.7547 |

The rendered soft/firm depth ratio is **2.45×**. Twelve cycles left 0.000759 residual with zero backoffs; 30/60/144 Hz schedules produced zero coordinate difference. Regression tests also compare peak and recovery states at identical physical steps, light/held/re-press continuity, reference immutability, locality, compressibility/damping and supported extremes. Units are arbitrary scene units, not a calibrated foam material. Profiles and normal-time recordings were inspected; images alone are not the recovery evidence.

## Performance and checks

Final hardware sample at revision `b63c8fd`: installed Chrome 154, Windows, **AMD Vega 8 / ANGLE D3D11**, viewport 1366×1000, DPR 1, 216 particles / 750 tets / 5,402 vertices / 10,800 triangles. Median/P95 per rendered frame: solver **1.90/2.50 ms**, surface/normals/bounds **3.80/5.20 ms**, renderer CPU submission **0.40/0.70 ms**, actual frame interval **8.30/8.40 ms**, zero backoffs. This final five-second sample ran without concurrent tests, recordings or model evaluation. It clears 60 fps on this device, excludes asynchronous GPU timing and does not claim phone or sustained thermal performance. The baseline surface median was 2.20 ms: the final sample costs 1.60 ms more, while the observed frame interval remains comparable. Separate short runs vary with machine load; this is evidence of adequate current frame timing, not a claim that the refinement has zero CPU cost.

Strict TypeScript, ESLint, **73 unit tests**, production build, **11 browser tests**, and Worker dry run passed. The ordinary mock corpus passed 26/26 with zero remote calls. Browser coverage includes A/B with a controlled multi-field color/shape reply, focus/visibility interruption, mobile viewport reduction, emulated touch, cancelled/new/timed-out generations, unsupported requests, storage denial, exact color-only state retention and stale replies. Browser smoke uses SwiftShader; hardware measurements use a separate Chrome session. No physical phone or real virtual keyboard was tested. Blender was not detected as an installed executable; the procedural geometry remained coherent with its cage.

The remaining external checks are deployed Free Turnstile and edge rate bindings, public hostname behavior and physical mobile devices. The Worker remains `PROVIDER: disabled`. Global Cloudflare skills/MCP registration and its OAuth issuer incompatibility are described in [Cloudflare setup](CLOUDFLARE.md).

<details>
<summary>Original delivery verification, retained as a historical baseline</summary>

This report distinguishes observed behavior from prepared integration. All ordinary checks used synthetic prompts and an explicitly identified mock. No Cloudflare inference quota was consumed, and no Cloudflare deployment or DEV submission was performed. After the initial local delivery, the user authorized source publication to [Daniele-Cangi/squishy-lab](https://github.com/Daniele-Cangi/squishy-lab) on 3 October 2026.

## Observed application behavior

The desktop and 390×844 layouts were inspected in screenshots. The canvas actually rendered with WebGL 2. Compression formed a local indentation with neighboring redistribution; release visibly retained and then recovered the dent. Presets visibly changed color and material response. A contextual **mock** edit changed firmness while preserving color/recovery. Rest, pressure, recovery and mock before/after images are in `evidence/`.

Playwright verified canvas rendering, pointer press/release, keyboard press, reset, contextual edit, color-only state retention, unsupported shape, provider quota/network failures, stale reply after a later preset, proportional rebuild, mouse cancellation/outside release, saved-spec restore/deletion, invalid/oversized API input, and an emulated touch drag/cancel with storage access denied. Touch was browser emulation, not a physical phone test. No child feedback is asserted.

## Physics measurements

`npm run measure:physics` presses the same logical surface point with the same normal and 0.88 maximum intensity, ramps for 0.85 seconds, holds until physical second 2, then releases until second 14. The **imprint depth** is the contact-axis displacement interpolated from the cage at that material coordinate; maximum particle displacement is also saved separately. This avoids labeling a global displacement as the imprint.

| Material comparison | Maximum imprint (scene units) | 90% recovery after release | Residual max displacement after 12 s | Smallest sampled tet/reference volume |
|---|---:|---:|---:|---:|
| Foam, softness 0.84 | 0.33821 | 4.408 s | 0.000629 | 0.6367 |
| Same foam, softness 0.22 | 0.11741 | 4.458 s | 0.000190 | 0.8559 |
| Same soft foam, recovery target 0.45 s | 0.31146 | 0.350 s | <0.000001 | 0.6961 |
| Elastic comparison, recovery 0.45 s, lower compressibility/damping | 0.30771 | 0.325 s | <0.000001 | 0.7372 |

The softer foam's imprint was about **2.88×** deeper than the firm comparison. The 4.5-second slow target closely matched the observed standard recovery; short fast targets have more immediate elastic recoil and should be treated as approximate. After **12 repeated cycles**, residual max displacement was **0.000626**, with **zero safety backoffs**. The rest shape remained immutable. Simulated 30/60/144 Hz render schedules produced zero final coordinate difference in this Node run because all executed the same fixed steps; this does not promise bitwise equality across browsers.

Unit checks additionally cover finite values and volume orientation at material/proportional extremes, volume loss vs compressibility, dissipation vs damping under an identical velocity pulse, locality of deformation, mesh connectivity/manifold/embedding, fixed-time enforcement and pause handling. Full traces and specs are in `physics.json` and `physics.csv`. Node timing samples were collected alongside browser work and are not used as the desktop frame-rate benchmark.

## Available-device performance

Hardware sample: Windows desktop, AMD Ryzen 5 3550H (4 cores / 8 logical processors); installed Chrome **154**, headless with hardware WebGL via **AMD Radeon Vega 8 / ANGLE D3D11**. The machine also exposes an RTX 2060, but that was **not** the selected renderer. Viewport **1366×1000**, canvas backing size **794×618**, DPR **1**, 216 particles, 750 tets, 5,402 visual vertices and 10,800 triangles. The saved sample is the final 240 frames during a five-second held standard press.

| Measurement | Median | 95th percentile |
|---|---:|---:|
| CPU solver per rendered frame | 1.30 ms | 2.00 ms |
| Surface embedding + normals/bounds | 2.20 ms | 3.40 ms |
| Renderer CPU submission | 0.30 ms | 0.40 ms |
| Observed frame interval | 8.30 ms | 8.50 ms |

This short hardware sample cleared the 60 fps target. It is not a long thermal benchmark, GPU timer measurement or claim about phones. Renderer CPU submission time excludes asynchronous GPU execution. The earlier graph-filter implementation took about 7.1 ms median to update the surface; precompiling sparse weights materially reduced that cost without adding a worker/WASM dependency.

`browser-performance.json` contains the hardware samples and exact user agent. `browser-performance-software.json` records a separate bundled Chromium/SwiftShader run with concurrent test activity (median frame interval about 83 ms); it is retained to show why software CI must not be called hardware performance. Browser smoke intentionally uses SwiftShader for reproducibility.

## Commands and scope

| Command | Result / evidence |
|---|---|
| `npm install` / lockfile update | Compatible exact dependencies installed with Node 22.19.0 and npm 11.6.2 on Windows |
| `npm run check` | Strict TypeScript, ESLint, 62 unit tests and Vite build; generated `.wrangler` files excluded from lint |
| `npm run test:browser` | 7 Chromium tests passed; final screenshots visually inspected |
| `npm run evaluate:ai` | 26/26 mock schema/meaning/preservation cases, 0 repairs, **0 remote calls** |
| `npm run measure:physics` | Numerical results above, 12 cycles, render-rate comparison and CSV/JSON traces |
| `npm run measure:browser` | Hardware-rendered Chrome sample above; browser closed afterward |
| `npm run worker:check` | Wrangler 4.147.0 locally bundled the Worker, AI/rate/asset bindings; dry run only |
| `npm run worker:dev` | Local workerd served `/` (200), `/api/config` (mock) and a real HTTP `/api/squishy` mock response (softness 0.92, recovery 6 s); stopped after check |
| `npm audit --json` | 0 known vulnerabilities in the checked lockfile |
| Wrangler authentication check | `loggedIn: false`; no usable account authentication supplied |

During development, checks found a softness comparison that was too weak, angular embedding artifacts, a mock spelling miss for `opaca`, and generated Worker files accidentally included in lint. These were corrected and the affected checks rerun. The first optional benchmark script also needed its browser-evaluated statistics moved out of the serialized function; the final reproducible script succeeded.

The first GitHub Linux run passed the build and all 62 unit tests, but exposed a timing-dependent browser assertion: recovery could finish while the color-edit request and UI actions completed. The color-preservation test now pauses browser animation time during the real mock HTTP round trip and checks exact displacement, volume ratio and simulation time before/after the edit. Other interaction tests still exercise ordinary animation. Remote runs and their uploaded browser evidence are available in [GitHub Actions](https://github.com/Daniele-Cangi/squishy-lab/actions/workflows/ci.yml).

## Still unverified / external work

- **Actual 3B/8B model semantics, repair frequency, latency and neuron use:** run the opt-in corpus against an authenticated Free account before choosing a model. The mock report is not an inference result.
- **Real Turnstile and edge rate-binding behavior:** protected paths were unit-tested with controlled bindings and fail closed; actual account/hostname configuration still needs setup and verification.
- **Public deployment and challenge submission:** prepared only. Keep Workers Free, configure Turnstile and obtain publication authorization. Recheck the official deadline/rules before submitting.
- **Physical mobile devices, cross-browser/long-duration performance, arbitrary self-collision and offline restart:** no such claims are made.

The local preview stays at `http://127.0.0.1:5173/`. Source control contains only this newly created project; no earlier work was replaced. Git commits retain actual creation times before the 5 October deadline. The initially empty GitHub repository is now the `origin` remote, with publication on `main` authorized by the user. The original source archive includes `history.bundle`; recover that local-delivery snapshot with `git clone history.bundle squishy-lab-restored` if needed.

</details>
