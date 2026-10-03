# Cloudflare setup — prepared, not deployed

Ordinary local development needs no credentials. `npm run dev` uses the explicit fixture interpreter; `npm run worker:dev` serves built assets and the same mock from local workerd. The mock is refused on non-loopback hostnames, preventing an accidental public "AI" demo. A plain `npm run preview` has no API and keeps local presets usable.

`wrangler.jsonc` combines Static Assets (`dist/`) and the `/api/*` Worker on one origin. Only API routes run the Worker first. The base configuration has `PROVIDER: disabled`; the `mock` environment is local-only. Never deploy `--env mock`.

## Live model evaluation before choosing the candidate

The 26-case corpus in `tests/semantic-corpus.ts` has Italian/English descriptions, typo, negations, relative edits, protected fields, unsupported shapes and instruction injection. Expectations were set as semantic bands/directions, not exact float matches. The report separates schema validity, meaning, field preservation, repair and duration. It uses only synthetic descriptions.

Authenticate with the project's pinned Wrangler (`npx wrangler login`). The harness reads its OAuth token in memory; it never prints or saves it. Alternatively supply `CLOUDFLARE_ACCOUNT_ID` and a scoped `CLOUDFLARE_API_TOKEN` as environment variables, never a frontend file or chat message. With multiple accounts select the account ID explicitly. A read-only subscription check refuses paid Workers/AI plans. If that read returns 403, first confirm the account is Workers Free, then opt in with `--free-confirmed` or `SQUISHY_WORKERS_FREE_CONFIRMED=1`. In this session the user confirmed Free; the report records that attestation, not an API-verified billing plan.

Intentional live commands, separate from CI:

```sh
npm run evaluate:ai -- --live       # 3B, prompted JSON, up to 52 calls for 26 cases
npm run evaluate:ai -- --live --8b  # 8B, documented JSON Schema mode, same corpus
npm run evaluate:ai -- --live --qwen # selected model, same corpus
npm run evaluate:ai -- --live --qwen --holdout
npm run evaluate:ai -- --live --qwen --fresh # reserved phrases, now also regressions
```

Missing authentication or an unconfirmed 403 billing check exits before inference. Calls are bounded to two per case; quota/unavailability/timeout stops the campaign. Reports live in `evidence/refined/`; only synthetic, reviewed evidence is committed. Ordinary tests make zero model calls. Historical misses remain in `ai-history/`. Model selection considers meaning, preservation, repair, latency and reported neurons; JSON validity and model size alone proved insufficient. No automatic provider failover is implemented.

`npm run dev:ai` serves **http://127.0.0.1:5174**, labeled “AI remota · test locale.” It uses selected Qwen3 by default, checks loopback peer/host and origin, limits bodies, allows one request at a time and caps the session at **12 model calls**. Set `SQUISHY_AI_MODEL` only to an allowlisted candidate for explicit comparison. On PowerShell, after confirming Free, use `$env:SQUISHY_WORKERS_FREE_CONFIRMED='1'; npm run dev:ai`. Credentials stay server-side. `npx tsx scripts/verify-live-browser.ts` records the real A/B flow against that already running server. This dev-only adapter is not bundled into the Worker and does not claim production Turnstile coverage. The ordinary `npm run dev` on 5173 remains mock.

Documentation check on 3 October 2026:

| Candidate | Free allocation | Output strategy | Live semantic result |
|---|---|---|---|
| `@cf/meta/llama-3.2-3b-instruct` | Free allocation | Prompted JSON + validation + one repair; no unsupported JSON Mode assumption | Initial 18/26; revised-prompt run 14/26 |
| `@cf/meta/llama-3.1-8b-instruct` | Free allocation | Documented JSON Schema + same validation/repair | Revised-prompt run 22/26; semantic misses despite valid schema |
| `@cf/qwen/qwen3-30b-a3b-fp8` | Free allocation, same listed neuron rates as the 3B | Documented raw non-thinking Qwen chat template + strict JSON/protection/direction validation | Corpus 26/26, paraphrase regressions 8/8 + 5/5; one repair in the last set |

Qwen3 has 30.5B total / about 3.3B active parameters; its [model card](https://huggingface.co/Qwen/Qwen3-30B-A3B-FP8) documents non-thinking formatting and Apache-2.0. Reserved delimiters in user content are escaped. Reasoning text is not stripped to manufacture valid JSON: the provider must return a valid data object. [Cloudflare's catalog](https://developers.cloudflare.com/workers-ai/models/) and [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) list this model. The prepared config selects it with AI still disabled. Read the history and [verification](VERIFICATION.md) before treating regression passes as unseen generalization.

For context, current pricing lists 4,625 input / 30,475 output neurons per million tokens for 3B, and 25,608 / 75,147 for this 8B. Calls are capped at 420 output tokens, descriptions at 500 characters. The static prompt and a compact current spec also count as input; do not convert the 10,000-neuron allowance into a promise of a fixed number of user requests.

## External setup steps, only when deployment is authorized

1. Use an existing Cloudflare account on **Workers Free**; confirm no Workers Paid upgrade or prepaid Gateway billing is enabled. No resources were created by this delivery.
2. Create/configure a **Free Turnstile widget** for the intended hostname, with action `squishy`. This is an external setup step, not performed here. Put its public key in `vars.TURNSTILE_SITE_KEY` and its secret in the Worker secret `TURNSTILE_SECRET`. Keep secrets out of source control.
3. Set base `vars.PROVIDER` to `workers-ai`, and `vars.MODEL` to the candidate that passed evaluation. The native `AI` binding supplies authentication; no account token reaches the browser. Live local binding previews also consume quota, so keep them intentional and separate from `worker:dev`.
4. Keep both `AI_RATE` (5/minute per IP) and `BURST_RATE` (30/minute shared key) configured. Namespace IDs should be unique to these policies in your account. Check binding availability on the actual Free account; only local bundling/emulation was verified here.
5. Run `npm run check`, `npm run test:browser`, and `npm run worker:check`; inspect all evidence. Only **after explicit publication authorization** use Wrangler to deploy the base environment and store its Turnstile secret. No deployment script is automatically run by CI.
6. Verify the real deployed `/api/config`, Turnstile verification, prompt-to-material loop, quota/rate errors and mobile behavior. Do not call a local mock test a remote inference test.

## Protection coverage

The live endpoint fails closed if a secret, site key, edge IP or either rate binding is missing. It verifies Turnstile **server-side**, including hostname and action, on every request. Tokens are single-use and expire after five minutes. Same-origin checks and cross-site fetch rejection reduce drive-by use; they are not authentication and a non-browser caller can forge an Origin header. Turnstile and the managed rate bindings are the antiabuse controls, not the disabled button.

Rate bindings share counters within a Cloudflare location and are eventually consistent. They are permissive approximate limits, **not an exact global limit or billing ledger**. Distributed traffic and human token farms can still exhaust the Free allowance. The provider's Free hard daily quota is the final limit; no additional global state service or paid WAF is assumed.

Request bodies are stream-limited to 8 KiB and read for at most 5 seconds; Turnstile verification has a 5-second timeout. Model calls plus the one repair share an 18-second deadline; each call is capped at 420 output tokens and model text at 8 KiB. A client timeout cannot guarantee that a binding inference is cancelled on Cloudflare; a bounded already-started call may finish and consume quota. Quota/rate/unavailability errors are not retried. Provider internals are not exposed in error messages. Existing objects remain usable throughout.

The application does not log prompts or identifiers; observability is disabled in the checked-in config. Cloudflare and Turnstile still process submitted descriptions/verification data under their service terms. User texts should not contain personal information.

## Codex Cloudflare setup performed in this session

The requested [official setup prompt](https://developers.cloudflare.com/agent-setup/prompt.md) was fetched and followed after the baseline. Sixteen Cloudflare skills were installed for Codex using its recommended skills installer. Five MCP servers were registered, preserving existing servers: Cloudflare Code Mode, public Docs, Bindings, Builds and Observability. Optional beta `cf` CLI was not needed; this repository keeps Wrangler 4.147.0.

MCP OAuth is **incomplete**: Codex CLI 0.145.0 rejected the authorization callback with “Authorization server response missing required issuer: expected https://mcp.cloudflare.com”. Issuer verification was not bypassed. Docs requires no login; the other registered servers are not authenticated. Start a new/restarted Codex agent to load the installed skills and registrations; retry `codex mcp login cloudflare` when that issuer compatibility issue is resolved. This is separate from the working Wrangler OAuth used for real AI tests. No secrets were placed in the repository or chat.

Official sources: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [JSON Mode supported list](https://developers.cloudflare.com/workers-ai/features/json-mode/), [rate bindings and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Turnstile Free plan](https://developers.cloudflare.com/turnstile/plans/), [token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
