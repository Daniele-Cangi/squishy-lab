# Cloudflare setup — prepared, not deployed

Ordinary local development needs no credentials. `npm run dev` uses the explicit fixture interpreter; `npm run worker:dev` serves built assets and the same mock from local workerd. The mock is refused on non-loopback hostnames, preventing an accidental public "AI" demo. A plain `npm run preview` has no API and keeps local presets usable.

`wrangler.jsonc` combines Static Assets (`dist/`) and the `/api/*` Worker on one origin. Only API routes run the Worker first. The base configuration has `PROVIDER: disabled`; the `mock` environment is local-only. Never deploy `--env mock`.

## Live model evaluation before choosing the candidate

The 26-case corpus in `tests/semantic-corpus.ts` has Italian/English descriptions, typo, negations, relative edits, protected fields, unsupported shapes and instruction injection. Expectations were set as semantic bands/directions, not exact float matches. The report separates schema validity, meaning, field preservation, repair and duration. It uses only synthetic descriptions.

If you intentionally want to consume Free inference quota, supply an account ID and a Workers AI scoped token **in environment variables**, never a frontend file or chat message. Then run, separately:

```sh
npm run evaluate:ai -- --live       # 3B, prompted JSON, up to 52 calls for 26 cases
npm run evaluate:ai -- --live --8b  # 8B, documented JSON Schema mode, same corpus
```

The command exits without making calls when `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` is absent. Ordinary tests never activate live mode. Reports are `evidence/ai-live-3b.json` / `ai-live-8b.json` and ignored by Git until explicitly reviewed. Choose the model based on meaning, preservation, repair frequency, latency and neuron cost. Require all protected-field and unsupported-shape cases to pass; investigate every semantic miss. Neither a bigger model nor structured JSON proves understanding. Do not automatically substitute a paid provider on failure.

Documentation check on 3 October 2026:

| Candidate | Free allocation | Output strategy | Live semantic result |
|---|---|---|---|
| `@cf/meta/llama-3.2-3b-instruct` | Listed in Workers AI pricing; not among models requiring a paid billing method | Prompted JSON + validation + one repair. Model page exposes `response_format`, but the supported JSON Mode list omits it | **Not run** |
| `@cf/meta/llama-3.1-8b-instruct` | Listed in Workers AI pricing; not among models requiring a paid billing method | Documented JSON Mode + same validation/repair | **Not run** |

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

Official sources: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [JSON Mode supported list](https://developers.cloudflare.com/workers-ai/features/json-mode/), [rate bindings and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Turnstile Free plan](https://developers.cloudflare.com/turnstile/plans/), [token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
