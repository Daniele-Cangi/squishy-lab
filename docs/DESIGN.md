# Squishy Lab interface

The playground's **Enter fullscreen** corner button expands the current squishy. Supported browsers use native fullscreen; mobile browsers without it get a fixed viewport-sized playground. A visible X exits, with rotation and reset controls still available. Safe-area spacing protects phone controls, scrolling is locked while expanded, keyboard focus stays inside, and Escape restores focus to the entry button. The same canvas, material and deformation remain active. Camera framing adapts to narrow portrait viewports. Browser checks cover native exit, denied native API/mobile fallback, portrait/landscape layout, deformation, inert background, focus and scroll restoration. Physical iPhone Safari has not been tested.

The page uses warm paper, pastel panels, original smiling vector mascots and small sticker details. Strong ink outlines and offset shadows give the playground a clear silhouette. The English headline “Happiness is squeezable” makes the mood visible immediately; the 3D object remains the main interactive element. All interface text, prompts, status messages and the managed verification widget use English.

Transparent finishes show a cream `#fff3df` tray, restrained pastel confetti and a lavender `#d9c7ec` rim. The deterministic canvas texture gives refraction a pleasant readable background. The earlier repeated checkerboard has been replaced.

Mochi's default smile and the five mood choices — Smile, Happy, Sleepy, Wink, Surprised — use Blender-authored detail meshes bound to the actual deforming render triangles. Strawberry shares these faces; Cat retains its nose and whiskers in every variant. Mood changes preserve deformation, and optional expression data keeps legacy saved appearances readable. The five small SVG button previews communicate the expression without relying on text alone, with labels and selected-state attributes for accessibility.

[Current desktop](../evidence/english-moods/desktop.png), [clear tray](../evidence/english-moods/clear-tray.png), [happy Mochi](../evidence/english-moods/mochi-happy.png), [winking Cat](../evidence/english-moods/cat-wink.png) and [320 px mobile](../evidence/english-moods/mobile-narrow.png) show this release. [Metadata](../evidence/english-moods/moods.json) records the source hash, installed Chrome/GPU, zero page errors and viewport overflow checks. Reproduce with `npm run dev` and `npx tsx scripts/record-moods.ts`. Earlier captures below preserve the previous design.

The GitHub influence appears in the source link, compact monospace badges and numbered collection tiles. The runtime provider badge continues to show the actual configured mode. Shape and material controls use the same labels and state bindings as before.

| Color | Value | Role |
|---|---|---|
| Cream | `#fff9ee` | Textured page and browser theme |
| Ink | `#29263d` | Text, panel outlines and shadows |
| Lavender | `#c7b7fa` | Brand, main action and playground family |
| Mint | `#c2e9d2` | Composer header and ready-made materials |
| Yellow | `#ffe277` | Highlight, press action and smiling sticker |
| Pink | `#ffbdcc` | Hero sticker and strawberry tiles |

Manrope carries the large headings; DM Sans carries interface text, with existing system-font fallbacks. Small code badges use the local monospace stack. The decorative faces are authored as vector paths in `src/view.ts` and `public/favicon.svg`. CSS supplies the paper dots, soft gradients, frames and sticker shadows. No raster illustration or additional dependency is required.

Selected shapes have an outline and check mark as well as a color change. Keyboard focus remains visible, mobile effect buttons retain 44 px targets, and decorative stage elements cannot intercept pointer input. Decorative graphics are hidden from assistive technology. Reduced-motion preference removes button transitions; the stickers are static.

Below 720 px the two columns become one, with a compact hero smile. At very narrow widths the gallery uses four columns. During composition, the compact sticky playground keeps the object visible above the composer. Its layout stays compact while focus moves between the text field, request mode and submit controls, keeping the pointer target stationary through a tap. Submission, preset selection or leaving the composer restores the full playground. The 320 px, 390 px, 960 px and 1366 px captures have no horizontal overflow. The reduced viewport models composer focus in a browser; it is not a physical phone keyboard test.

[Desktop](../evidence/playful-interface/desktop.png), [mobile](../evidence/playful-interface/mobile.png), [small-screen fold](../evidence/playful-interface/mobile-fold.png), [composer focus](../evidence/playful-interface/mobile-composing.png), [banana](../evidence/playful-interface/banana.png), [glitter peanut](../evidence/playful-interface/peanut-glitter.png) and [transparent cube](../evidence/playful-interface/jelly.png) show the rendered page. [Metadata](../evidence/playful-interface/interface.json) records the source hash, document/favicon hashes, actual browser/GPU, viewport dimensions and local demo mode. Captures made no inference calls and recorded no browser errors.

To reproduce the captures with the local demo server and installed Chrome:

```sh
npm run dev
npx tsx scripts/record-interface.ts
```

The refresh changes presentation, HTML metadata and favicon. The AI, validated material contract, geometry, solver and long-hold interaction keep their preceding implementation. Historical recordings retain their original styles and source hashes.
