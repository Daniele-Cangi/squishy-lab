# SEO and indexing

Official URL: **https://www.squishylab.fun/**. Vercel project domain settings permanently redirect the apex and former production hostname `squishy-lab-phi.vercel.app` to the official domain with HTTP 308. These domain settings are separate from the repository and must be preserved on the Vercel project. `vercel.json` redirects `/index.html` to `/`. Preview and deployment URLs are not included in the sitemap; keep Vercel preview deployment protection enabled.

## Static content and metadata

The `squishy-static-page` Vite plugin renders `src/view.ts` into `index.html` during both development and production builds. `src/main.ts` attaches interactions to that existing HTML. There is no user-agent-specific response. The visible guide and FAQ remain readable with JavaScript disabled; the interactive canvas needs JavaScript and WebGL 2.

`index.html` contains the English title, description, canonical, Open Graph and Twitter cards, and JSON-LD for `WebSite`, `WebPage` and `WebApplication`. Structured data describes actual free features and browser requirements. It contains no fabricated reviews or ratings, and does not guarantee a rich search result. The social preview is an existing 1200 × 630 PNG. Main font stylesheets are discovered directly in the head with preconnect hints instead of a CSS import.

- `/robots.txt` allows the public page and assets, excludes `/api/`, and links the sitemap. API authorization remains separate from robots rules; API responses carry `X-Robots-Tag: noindex, nofollow`.
- `/sitemap.xml` lists the only public page, the homepage. Do not add fragment links, preview URLs or nonexistent shape pages. Add `lastmod` only when the actual content modification date is known.
- `/llms.txt` provides a concise summary and official links. It is optional and is not a ranking or AI-discovery guarantee.
- The wildcard robots policy permits search crawlers including `OAI-SearchBot`. Training crawler policy is unchanged; search discovery and model training are separate controls.

## Search Console and Bing

The homepage has a public `google-site-verification` tag for the owner's existing Google Search Console account. The selected property is the URL prefix `https://www.squishylab.fun/`. Keep the verification tag in place. A DNS-verified domain property can additionally cover all hosts and protocols later.

After deployment, verify ownership, submit `https://www.squishylab.fun/sitemap.xml`, inspect the homepage, and request indexing if appropriate. A successful request does not mean the page is indexed immediately. Watch selected canonical, crawl errors, indexed pages, impressions, clicks and search queries. Vercel Analytics measures visits separately.

Bing Webmaster Tools uses the owner's separate Microsoft account and independent homepage `msvalidate.01` verification tag. Keep this tag in place and submit the same sitemap there. Google and Bing accounts do not have to match; no Search Console data import is required.

## Domain changes and release checks

When changing the official host, update the HTML metadata and structured-data URLs, robots sitemap URL, sitemap, AI summary, README, `docs/VERCEL.md`, production verification scripts and Worker `PUBLIC_ORIGIN`. Register the new hostname with the existing managed Turnstile widget. Do not disable hostname validation or reset the daily quota.

```sh
npm run check
npm run test:browser
npm run verify:seo
npm run verify:production
```

The first two commands are local release checks. `verify:seo` checks deployed static content, metadata, robots, sitemap, summary, redirects, 404s, preview image and AI config without making an inference request. `verify:production` checks the deployed interface and protections; `-- --ai` intentionally performs one real edit with genuine Turnstile verification.

For mobile performance, record a baseline before changing 3D assets or simulation behavior. Keep the first playground stable while loading assets, avoid autoplay audio or video, use meaningful text labels, and test narrow screens and keyboard interaction. Add dedicated shape pages only when they offer distinct content and an actual playable experience.

Official references: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Google AI features](https://developers.google.com/search/docs/appearance/ai-features), [OpenAI crawlers](https://developers.openai.com/api/docs/bots), [Google sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Release verification — October 5, 2026

Typecheck, lint, 128 unit tests and the production build passed. All 36 distinct browser cases passed across the local verification runs, including the two new no-JavaScript/static-page cases. Two cases timed out with software rendering on Windows and passed when repeated using installed Chrome with GPU acceleration. No simulation code was changed for this release.

Deployed HTTP checks passed for the canonical, social image, static guide, JSON-LD, robots, sitemap, AI summary, permanent domain redirects, `/index.html`, real 404s and API indexing headers. Production desktop and mobile UI checks reported no page errors or horizontal overflow. A genuine Turnstile-protected English AI edit on the new domain changed Super soft to Soft while retaining slow recovery.

One fresh installed-Chrome context per viewport, without network or CPU throttling, produced these lab samples:

| Viewport | Largest contentful paint | Cumulative layout shift |
| --- | --- | --- |
| Desktop, 1366 × 1000 | 960 ms | 0.00039 |
| Mobile, 390 × 844 | 636 ms | 0.00029 |

These are lab observations, not field Core Web Vitals or scores for a real phone. INP and a full performance trace were not measured. Google Search Console field data requires real visits and time to accumulate.

Google ownership verification succeeded, its live homepage test reported that the page can be indexed, and the indexing request was accepted into the crawl queue. Bing ownership was verified independently with the Microsoft account and its sitemap submission was accepted for processing. Submission is separate from completed indexing. At first submission Google reported that it could not retrieve the sitemap, despite public HTTP 200/XML responses and a successful live homepage fetch; the sitemap was resubmitted once after these checks. Confirm its processed status in Search Console before treating sitemap ingestion as complete.
