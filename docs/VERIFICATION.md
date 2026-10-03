# Delivery verification — 3 October 2026

This report distinguishes observed behavior from prepared integration. All ordinary checks used synthetic prompts and an explicitly identified mock. No Cloudflare inference quota was consumed, and no deployment or publication was performed.

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

## Still unverified / external work

- **Actual 3B/8B model semantics, repair frequency, latency and neuron use:** run the opt-in corpus against an authenticated Free account before choosing a model. The mock report is not an inference result.
- **Real Turnstile and edge rate-binding behavior:** protected paths were unit-tested with controlled bindings and fail closed; actual account/hostname configuration still needs setup and verification.
- **Public deployment and challenge submission:** prepared only. Keep Workers Free, configure Turnstile and obtain publication authorization. Recheck the official deadline/rules before submitting.
- **Physical mobile devices, cross-browser/long-duration performance, arbitrary self-collision and offline restart:** no such claims are made.

The local preview stays at `http://127.0.0.1:5173/`. Source control contains only this newly created project; no earlier work was replaced. Local Git commits retain actual creation times before the 5 October deadline, and no remote repository is configured.
