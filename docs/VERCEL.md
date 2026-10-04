# Vercel production

Public site: **https://squishy-lab-phi.vercel.app**. Project: [daniele-cangis-projects / squishy-lab](https://vercel.com/daniele-cangis-projects/squishy-lab), connected to `Daniele-Cangi/squishy-lab`. Main-branch pushes trigger Vercel builds.

Vercel serves the Vite assets and two Node functions, `api/config.ts` and `api/squishy.ts`. The same-origin gateway in `server/gateway.ts` calls a private Cloudflare Worker with the existing Qwen3 model and native AI binding. OAuth credentials used for local development are never deployed. `rewriteRelativeImportExtensions` in `tsconfig.json` converts the shared TypeScript imports for Vercel's emitted Node ESM functions.

```text
English description + current material + genuine Turnstile token
  → Vercel same-origin API (bounded JSON, platform client IP)
  → authenticated Cloudflare Worker (origin, rates, Siteverify)
  → Workers AI Qwen3 → validated semantic patch
  → local material compiler → interactive squishy
```

Production Vercel variables:

| Variable | Value / role |
|---|---|
| `SQUISHY_AI_URL` | `https://squishy-lab-ai.daniele-cangi-squishy.workers.dev` |
| `SQUISHY_GATEWAY_SECRET` | Sensitive random shared gateway secret; never a frontend variable |

The Worker uses `wrangler.api.jsonc`: `PROVIDER=workers-ai`, the existing `@cf/qwen/qwen3-30b-a3b-fp8`, `PUBLIC_ORIGIN=https://squishy-lab-phi.vercel.app`, public Turnstile site key, native AI binding, per-client 5/minute and shared 30/minute rate bindings. Worker secrets are `GATEWAY_SECRET` (matching Vercel) and `TURNSTILE_SECRET`. Direct Worker calls fail with 403. Siteverify checks the canonical site's hostname and action `squishy`; the gateway takes the client IP from Vercel's overwritten forwarding header, discarding client gateway headers.

The managed Turnstile widget is restricted to `squishy-lab-phi.vercel.app`. Its UI language is English, compact size fits narrow columns, and interaction-only appearance allows automatic verification without occupying the composer. AI uses the Workers Free account confirmed by the owner; no paid-plan upgrade was made. Provider quota failures leave local presets and interaction usable.

## Three requests per IP in 24 hours

The private Worker also binds `DAILY_QUOTA`, a SQLite-backed `DailyQuota` Durable Object, with the `daily-quota-v1` migration. No login or user database is required. One object per HMAC of the platform-verified IP stores at most three reservation timestamps; raw IPs and prompts are not stored in the quota counter. The existing gateway secret keys the HMAC. Rotating that secret starts a new set of counters.

A synchronous transaction reserves a slot after genuine Turnstile validation and before inference. The fourth verified request in a rolling 24-hour window returns HTTP 429 with `daily_limit`, an English message and `Retry-After` until the oldest reservation expires. Each slot becomes available 24 hours after its use, rather than at midnight. Requests that begin inference count even if the provider fails, the result is unsupported or the browser cancels; a bounded repair is part of the same request. Invalid requests and failed verification do not consume a daily slot. Missing quota bindings or storage failures fail closed. The existing minute/burst protections remain in place.

The counter persists across reloads, Worker restarts and deployments, and serializes concurrent reservations. Alarms prune expired timestamps. Devices sharing the same public IP share the allowance; a different IP has its own counter. Local mock development and the separate opt-in evaluation adapter remain outside this public limit. SQLite-backed Durable Objects are supported on [Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/); this configuration does not upgrade the plan.

Quota verification uses the actual local workerd SQLite backend for 20 simultaneous requests (3 accepted, 17 denied) and restart persistence. Unit tests cover exact rolling-window expiry, cleanup, HMAC separation, rejected verification, and refusal before the fourth model call. The gateway preserves the daily `Retry-After` header.

The public canonical URL is the supported AI origin. Deployment aliases and preview domains are not registered with this Turnstile widget. Preview environments do not have production AI secrets. When moving the production domain, update `PUBLIC_ORIGIN` and the widget domain together before promoting the new site.

Deploy after `npm run check`:

```sh
npx wrangler deploy --config wrangler.api.jsonc
vercel deploy --prod --yes --scope daniele-cangis-projects
```

Secrets must already exist on the destination services. For a fresh account, create a managed Turnstile widget, set the two Worker secrets with `wrangler secret put --config wrangler.api.jsonc`, and add the two Vercel production variables through the CLI's protected input. Never commit secrets or paste them into chat. `.vercelignore` excludes local credentials, work files, recordings and the Blender workshop from the deployment upload; these assets remain available in the repository. The ordinary `wrangler.jsonc` retains its separate disabled/static-site configuration.

Verification: `npm run verify:production` checks config, direct-Worker rejection, missing-token rejection, expression/clear-finish controls and mobile width. Add `-- --ai` for an intentional real English material edit. It uses genuine Turnstile readiness without bypasses and records only synthetic descriptions, public metadata and validated material values in `evidence/vercel-release/`. In this release, automated Chrome was not granted a challenge token, so two real edits were verified in the normal Codex in-app browser and captured separately in `production-ui.txt` and `production-ai.jpg`. Never substitute test keys in production.

Platform references: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Turnstile widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).
