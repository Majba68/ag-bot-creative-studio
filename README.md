# TRAPO — Discover Your Style. Explore Everything.

TRAPO is the premium multi-category storefront in this repository. It includes an interactive drag-and-select showcase, a 126-product demonstration catalogue across nine categories, product detail pages, search/filters/sorting, wishlist, cart and a clearly labelled checkout demonstration, collections, and a full admin dashboard. The earlier trading-analysis application is preserved under `client/_legacy/`, and its original documentation is retained below for reference.

## TRAPO quick start

```bash
npm install
npm run dev
```

- Storefront: http://localhost:5173
- Store API: http://localhost:3001/api/store
- Admin dashboard: http://localhost:5173/admin

The client talks to `/api/store` first. If the API is unavailable, it falls back to the bundled sample catalogue and `localStorage` so the storefront and admin remain usable as an offline demo. Every generated item is flagged as a sample product in the UI.

### Catalogue

- `scripts/generate-products.mjs` deterministically generates the 126 sample products, 6 collections and unique SVG artwork.
- Bundled seeds live in `client/src/data/` and `server/src/data/`.
- API persistence writes to `server/data/trapo/products.json`, `collections.json` and `uploads/`. On a read-only filesystem the API switches to in-memory storage and reports `storageMode: "memory"` from `/api/store/meta`.

### Admin

Open `/admin`. With no `ADMIN_PASSWORD` configured, local/demo mode signs in automatically. In deployed or protected mode:

1. Set `ADMIN_PASSWORD` (and ideally `ADMIN_SECRET`) in `server/.env`.
2. Restart the API. `/api/store/meta` then reports `authRequired: true`.
3. Sign in from the admin dashboard. The client calls `POST /api/store/admin/login` and sends the returned bearer token for 12 hours.
4. Unauthenticated catalogue mutations return `401 Unauthorized`.

The dashboard supports product and collection create/edit/delete, image URL entry and image upload (max 8 MB), price/stock/description/category management, JSON import/export, and a one-click `DELETE ALL DEMONSTRATION PRODUCTS` action. Deleting demos is permanent in API mode; the `Restore sample data` button is only available in local browser mode. Always keep a backup of `server/data/trapo/` before bulk changes.

### Checkout honesty

Checkout is a **demonstration only**. It creates a local confirmation number, never takes payment, never creates real orders and never ships goods.

## Original AG BOT documentation (legacy)

The sections below describe the pre-existing trading-analysis application. Its source was moved to `client/_legacy/` when TRAPO was built; the server-side trading APIs remain in place.

## Important disclaimer

AG BOT is an **informational tool**, not financial advice. It never guarantees profits, never claims that a candle will certainly move in a given direction, and never places, modifies or closes trades. Broker-synthetic OTC instruments have no independent public live feed, so AG BOT lists them for reference but deliberately shows **no price or analysis** for them.

## What is included

- Animated intro screen with custom SVG logo and START button.
- Dashboard with animated AI robot hub, Twelve Data chart panel, settings, searchable currency catalogue (Forex vs OTC/Synthetic), analysis panel, UP/DOWN result display, assistant chat with screenshot upload, and a user-supplied broker platform opener.
- Separate **AG AI VISION ANALYZER** tab: screenshot upload/preview/zoom/crop, secure backend vision-model analysis, structured UP/DOWN/WAIT results, observed-fact/interpretation separation, local analysis history with previews, reopen and two-result comparison.
- Separate **AG AI SUPPORT & RESISTANCE ANALYZER** tab: uploads a chart screenshot, asks Gemini Vision for potential horizontal zones based only on visible price action, draws green `SUPPORT` / red `RESISTANCE` lines on a separate annotated copy, and keeps the original image unchanged. It explains why an area may matter, possible breakout/breakdown scenarios, and whether the screenshot has enough evidence. No exact price values are calculated or displayed.
- Separate **AG AI SMART CHART SETUP ANALYZER** tab: uploads one full Trading Dashboard screenshot, then asks the same configured Vision model to identify only the visible chart, candles, timeframe and indicators. It recommends study tools with settings, optional status and clutter risk, gives a complete setup guide, separates UP/DOWN evidence and conflicts, explains when WAIT is appropriate, and adds a simple Bengali learning section. It never asks for separate indicator-menu screenshots and never invents prices or hidden settings.
- Separate **AG AI SMART DIRECTION PRO** tab: uploads one Quotex chart screenshot and returns exactly one primary result — `UP_BIAS`, `DOWN_BIAS`, or `INSUFFICIENT_EVIDENCE`. It analyzes visible trend, candlestick patterns, relative support/resistance, visible RSI/MACD, moving averages, momentum, and breakout/reversal signals. It stores analyses in this browser and, only when `DEMO_MODE=true`, compares a saved bias with a locally generated simulated outcome. The resulting correct/incorrect counts and "simulated accuracy" are labelled as demo-only; real market accuracy is never claimed.
- Separate **AG FIRE LIVE CENTER 🔥** tab: premium black-and-red live-chart workspace with an animated arcade blaster/flame tab icon. It first reports the verified Quotex embedding result: Quotex publishes no official iframe/widget API, its live domains return `X-Frame-Options: SAMEORIGIN`, and its terms prohibit framing, so no fake or forced Quotex chart is shown. The same black-screen panel can load the officially supported TradingView Advanced Chart and Technical Analysis widgets as an independent real-market alternative. A screenshot analyzer reuses the existing Gemini Vision endpoint for English observations, `UP_BIAS` / `DOWN_BIAS` / `WAIT` educational assessment, confidence/uncertainty, and simple Bengali explanations. No new API key, broker access or trade execution is added.
- Separate **AG AI CREATIVE STUDIO** tab: a premium AI poster/advertisement design platform with business profiles, logo cutouts, four unique concepts, precise canvas text compositing, a drag-and-drop editor, persistent projects, favourites, history, PNG/JPG export and 20 creative tools.
- Backend proxies all provider and AI calls so API keys never reach the browser. Keys live only in `server/.env`, which is git-ignored.
- Honest data states: **REAL / SIMULATED / UNAVAILABLE**, with chart freshness labelled **FRESH DATA / DELAYED / DATA UNAVAILABLE / PROVIDER ERROR**. If no keys are configured, the UI explains that instead of inventing prices.
- No Quotex integration is claimed. AG BOT does not connect to, authenticate with, or place trades on Quotex or any other broker. The Platform button only opens a URL you provide yourself.
- Technical engine scores: candlestick patterns, support/resistance, trend slope, RSI, MACD, moving averages, price action, ATR volatility, volume when actually supplied, and higher-timeframe confirmation.

## Requirements

- Node.js 18+ (Node 20/22 recommended)

## Setup

```bash
npm install
```

Copy the environment template and add the keys you have:

```bash
copy server\.env.example server\.env
```

Edit `server/.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | API port (default `3001`) |
| `TWELVEDATA_API_KEY` | for live data | Free key from https://twelvedata.com — supplies real forex OHLC candles |
| `LLM_PROVIDER` | for AI text/vision | `openai`, `anthropic`, `gemini` or `none` |
| `LLM_API_KEY` | for AI text/vision | Key for the chosen provider (for Gemini, paste the key from Google AI Studio) |
| `LLM_MODEL` | no | Text model. Defaults to `gpt-4o-mini`, or `gemini-3.5-flash-lite` when `LLM_PROVIDER=gemini`. |
| `VISION_MODEL` | for Vision Analyzer | Required for the new tab. Must be an explicitly configured vision-capable model, e.g. `gemini-3.5-flash-lite` (free tier), `gpt-4o` or `claude-3-5-sonnet-latest`. No default is assumed. |
| `DEMO_MODE` | no | Default `false`. Set to `true` only to test the interface with locally generated simulated candles. Every screen is clearly labelled and no simulated value is ever presented as a real price. |
| `CLIENT_ORIGIN` | no | Dev origin for CORS (default `http://localhost:5173`) |
| `ADMIN_PASSWORD` | for TRAPO admin auth | Protects all `/api/store` catalogue mutations. Blank = open local/demo mode. |
| `ADMIN_SECRET` | no | Admin token signing secret. Defaults to a hash of `ADMIN_PASSWORD`; set a long random value in production. |
| `CREATIVE_IMAGE_PROVIDER` | no | Primary image provider. Supported: `gemini` (default) or `openai`. |
| `CREATIVE_IMAGE_API_KEY` | no | Separate server-only Gemini key for Creative Studio image generation. Falls back to `LLM_API_KEY`. |
| `CREATIVE_IMAGE_MODEL` | no | Officially supported Gemini image model. Default `gemini-nano-banana-2.1` (Nano Banana 2.1). Alternatives: `gemini-3.1-flash-lite-image`, `gemini-3.1-flash-image`, `gemini-3-pro-image`, `gemini-2.5-flash-image`. |
| `CREATIVE_IMAGE_FALLBACK_PROVIDER` | no | Automatic second provider when the primary fails. Default `openai`; set to `none` to disable it. |
| `OPENAI_IMAGE_API_KEY` | no | Server-only key for the genuine OpenAI `gpt-image-1` fallback. If `LLM_PROVIDER=openai`, `LLM_API_KEY` is reused. |
| `OPENAI_IMAGE_MODEL` | no | OpenAI image model for fallback/edits. Default `gpt-image-1`. |
| `REMOVEBG_API_KEY` | no | Optional remove.bg key for true transparent logo cutouts. Without it, AG AI uses a deterministic local PNG precision flood-fill that preserves the original logo RGB values. |

The app works with **no keys**: it shows real pair names, an empty chart with an explanation, and deterministic analysis states of `WAIT` with a clear reason. Add `TWELVEDATA_API_KEY` to get real candles; add LLM keys to enable natural-language explanations, chat and screenshot analysis.

`DEMO_MODE=true` is an **educational sandbox**. It generates deterministic UP or DOWN sample trends locally, then runs the same technical engine over them. The status pill reads `SIMULATED DEMO DATA`, the topbar reads `Simulated data`, the verdict reads `SIMULATED RESULT · EDUCATIONAL`, a full-page warning banner is shown, and every explanation/risk warning says the numbers are not real prices. Demo mode wins over a real API key when enabled, so the two modes can never be confused. Never use it for trading decisions.

When `DEMO_MODE=false` and `TWELVEDATA_API_KEY` is set, the app requests real OHLC candles from Twelve Data's `time_series` endpoint through the server. The key is appended only in the server-side request; `/api/health` reports only that a key exists, never its value.

### Get a free Gemini API key (Vision Analyzer)

Google offers a free Gemini Developer API tier with free input/output tokens on supported models; `gemini-3.5-flash-lite` is vision-capable and available there. Limits are per project and free-tier content may be used to improve Google's products — check the live [pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) pages before relying on it.

1. Sign in with a Google Account at **https://aistudio.google.com/apikey**. Create an account first if you do not have one.
2. Click **Create API key**. If prompted, create or select a Google Cloud project; a new project is fine for the free tier.
3. Copy the generated key. Treat it like a password — never paste it into the browser, a chat, a screenshot or a source file.
4. Open `server/.env` in a text editor. It has already been created with Gemini selected.
5. Paste your key after the equals sign: `LLM_API_KEY=AIza...` (no quotes, no extra spaces).
6. Confirm `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.5-flash-lite` and `VISION_MODEL=gemini-3.5-flash-lite`.
7. Save the file, then **fully restart the server**. Environment variables are read only at startup; `tsx watch` does not reload `.env`.
8. Visit `http://localhost:3001/api/health`. `visionConfigured` should be `true` and `llmProvider` should be `gemini`.
9. Open the **AG AI VISION ANALYZER** tab, upload a clear chart screenshot and run an analysis.

The backend calls Google's Interactions API (`POST https://generativelanguage.googleapis.com/v1beta/interactions` with `Api-Revision: 2026-05-20`). It sends the screenshot inline as base64 with `store: false` so Google is not asked to retain it, passes the strict AG BOT vision rules as `system_instruction`, and attaches your key only in the server-side `x-goog-api-key` header. The browser never receives the key.

## Run

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

Production build (API also serves the built frontend):

```bash
npm run build
npm start
```

Open http://localhost:3001.

## Deploy to Vercel

This is a full-stack app: Vite builds `client/dist` and `api/index.mjs` runs the compiled Express app as a serverless function. `vercel.json` wires both together.

1. Push this folder to a GitHub repository (do **not** commit `server/.env`; it is git-ignored).
2. Import that repository in Vercel. The build command and output directory are already set in `vercel.json`.
3. Add these **server-side** environment variables in Vercel → Project → Settings → Environment Variables:

   | Variable | Value |
   | --- | --- |
   | `LLM_PROVIDER` | `gemini` |
   | `LLM_API_KEY` | your new Gemini key, starting `AIza...` |
   | `LLM_MODEL` | `gemini-3.5-flash-lite` |
   | `VISION_MODEL` | `gemini-3.5-flash-lite` |
   | `CREATIVE_IMAGE_PROVIDER` | `gemini` |
   | `CREATIVE_IMAGE_MODEL` | `gemini-nano-banana-2.1` |
   | `CREATIVE_DATA_DIR` | `/tmp/creative-studio` |
   | `CLIENT_ORIGIN` | the deployed `https://<project>.vercel.app` origin |

   Optional genuine fallback: `OPENAI_IMAGE_API_KEY`, `OPENAI_IMAGE_MODEL=gpt-image-1`, `CREATIVE_IMAGE_FALLBACK_PROVIDER=openai`. Image generation still requires a paid/quota-enabled Gemini tier; the app reports the real provider error instead of fabricating an image.

4. Deploy, then check `https://<project>.vercel.app/api/health` and `/api/creative-studio/config`.

**Storage caveat:** Vercel serverless files are read-only except `/tmp`, and `/tmp` is ephemeral. The committed `server/data/creative-studio/` folder is bundled as a read-only seed, so the deployed site starts with the same profile and assets after a cold start, but any **new** uploads, projects or edits can disappear after a cold start or redeploy. For durable storage, connect an external database/object store and use a persistent volume on a host that provides one. Your local `server/data/creative-studio/studio.json` and its assets are untouched by deployment.

## Verify

```bash
npm run typecheck
npm test
npm run build
curl http://localhost:3001/api/health
```

`/api/health` reports `dataMode` as `real`, `simulated`, or `unavailable`, plus which services are configured — never the keys themselves.

## Notes on data accuracy

- Prices come from Twelve Data's `time_series` endpoint and are labelled using the age of the last returned candle. Whether a feed is truly real-time also depends on your provider plan — check your plan's entitlements.
- Spot FX often has no meaningful volume. When the provider returns no volume, AG BOT labels it **unavailable** and excludes it from scoring.
- OTC/synthetic symbols are broker-generated and cannot be verified against an independent feed. They are never assigned a price here.
- The analysis engine computes its verdict from real numbers. If an LLM is configured it only rewording those facts; a safety check rejects text containing guarantee/certainty language and falls back to the deterministic explanation.

## AG AI VISION ANALYZER

The separate tab analyses a **user-uploaded chart screenshot** only. It does not access Quotex, any broker account, live prices, or trade execution. The workflow is:

1. Add a PNG/JPG/JPEG screenshot (max 5 MB), preview it, optionally zoom or crop, and set the user-provided pair/timeframe/duration/market-type/depth context.
2. The browser sends the image and context to `/api/vision/analyze`. The API key stays in `server/.env`; it is never sent to the browser.
3. The backend calls the configured vision-capable model with a strict prompt. The response must be structured JSON.
4. The backend rejects certainty claims, invalid verdicts, weak evidence, and malformed responses. Weak or unclear evidence becomes `WAIT` or `INSUFFICIENT_DATA` and asks for another screenshot.
5. Results are rendered in separate cards for observed facts, interpretations, patterns, bullish/bearish evidence, support/resistance, conflicts, missing information and alternatives. Up to 12 downscaled previews and results are kept in browser `localStorage` for reopen/compare/delete.

Professional chart-analysis systems normally combine several layers: computer vision/OCR to read visible chart pixels, deterministic indicator calculation from real OHLC numbers, historical context across multiple candles and timeframes, and backtesting to check whether a rule had an edge. This tab implements the **vision/interpretation layer** only. It deliberately cannot claim the numeric precision of a real OHLC feed or a historical backtest. Model confidence is confidence in reading the evidence, **not** the probability of a successful trade.

If `LLM_PROVIDER`, `LLM_API_KEY` or `VISION_MODEL` is missing, the tab shows **Vision AI Not Configured** and produces no interpretation. A blurred, partial or non-chart image should return `INSUFFICIENT_DATA` rather than a guess.

## AG AI SUPPORT & RESISTANCE ANALYZER

This is a third, fully separate tab. It never connects to a broker account and never trades. Its workflow is:

1. Upload a PNG/JPG/JPEG chart screenshot (max 5 MB). The browser previews the original file; the file itself is not altered.
2. `POST /api/vision/support-resistance` sends the image to the configured vision model through the server. The API key stays in `server/.env` and is never exposed to the browser.
3. The model must return strict JSON containing an evidence decision, normalized vertical positions (`yPercent`) for potential zones, simple explanations, observed facts and missing information.
4. The backend strips price-like text, rejects certainty claims, and returns **no lines** when the screenshot is unclear. Model confidence describes confidence in reading the evidence, not a market-success probability.
5. The UI draws green `SUPPORT` and red `RESISTANCE` lines with labels only on a separate canvas copy. The original screenshot remains available beside it. Cards explain why a zone may matter, what a possible breakout or breakdown could mean, and what information the screenshot does not provide.

The zones are AI interpretations of pixels, not confirmed prices or trade levels. The feature returns no exact price values and no guaranteed UP/DOWN prediction. Missing `VISION_MODEL` or provider configuration shows **Vision AI Not Configured** and produces no interpretation.

## AG AI SMART CHART SETUP ANALYZER

This is a fourth, fully separate tab for educational setup planning. It uses the existing Gemini Vision configuration only; no second API key is required. It never connects to a broker, never executes trades, and reads only the uploaded image.

1. Upload **one full Trading Dashboard screenshot** (PNG/JPG/JPEG, max 5 MB). Separate indicator-menu screenshots are neither required nor requested.
2. `POST /api/vision/smart-chart-setup` sends that single image to the configured vision model through the server. The key stays in `server/.env` and is never sent to the browser.
3. The model returns strict JSON describing the visible chart, candles, timeframe, readable indicator labels, chart structure, observed facts and missing information. Blurred or absent labels are reported as not legible; they are not guessed.
4. The UI renders English report sections for tool recommendations (tool name, why useful, suggested settings, optional status and clutter risk), a complete setup guide, candle-direction evidence, conflicts, sufficient-information verdict and WAIT reasoning.
5. A separate Bengali Learning Section explains in simple Bengali which tools to use, why they help, how to configure them, how to read the combined chart, and how to interpret possible UP, DOWN and WAIT scenarios. Tool names and settings remain in English.
6. The backend scrubs price-like values, rejects certainty/guarantee language, enforces the English/Bengali field separation, and returns `INSUFFICIENT_DATA` with no recommendations when the screenshot is not clear enough. Model confidence is confidence in reading pixels only, never a market-success probability.

This is an educational chart-analysis tool, not a guaranteed trading prediction system. A recommendation is a study suggestion, not confirmation that a tool is installed and not a signal to enter a trade. If the provider is unavailable or the response is unusable, the tab reports that no interpretation was produced instead of showing fabricated output.

## AG AI SMART DIRECTION PRO

This is a fifth, fully separate tab. It uses the existing Gemini Vision configuration only, requires no second API key, never connects to a broker, and never trades.

1. Upload one Quotex chart screenshot. `POST /api/vision/direction-pro/analyze` sends it to the configured vision model through the server.
2. The model reports only visible evidence: pair and timeframe when legible, chart/candle readability, trend, candlestick patterns, relative support/resistance areas, RSI/MACD when visible, moving averages when visible, momentum, and breakout/reversal signals. Exact prices and hidden indicator values are stripped or rejected.
3. One primary verdict is returned: `UP_BIAS`, `DOWN_BIAS`, or `INSUFFICIENT_EVIDENCE`. A bias is forced only when readable evidence supports it; unreadable or unusable screenshots are never assigned a direction.
4. The English report explains why the side was chosen, which signals support it, which signals disagree, and what would invalidate the reading. A separate Bengali Explanation section explains the same result in simple Bengali.
5. Completed analyses are saved in browser `localStorage` (`agbot-direction-pro-history`). Entries can be reopened or deleted. No broker data is stored.
6. `POST /api/vision/direction-pro/verify-demo` is available only with `DEMO_MODE=true`. It uses `demoCandles()` from the local demo generator and defines the simulated outcome as the sign of `close[last] - close[last - horizon]`. Saved biases are compared with that outcome, producing correct/incorrect counts and a percentage labelled **Simulated accuracy**. This is not a real-market backtest, not live performance, and not a profit claim.

If Vision AI is not configured, no interpretation is produced. If demo mode is off, verification is unavailable and the accuracy panel shows `—` until simulated outcomes are run. No exact price levels, broker accounts, trade execution, or guaranteed predictions are part of this feature.

## AG FIRE LIVE CENTER 🔥

This is a sixth, fully separate tab. It adds no new server route, no new API key and no broker connection. It preserves all existing tabs and reuses the configured Gemini Vision endpoint only for optional screenshot interpretation.

1. The tab icon uses a lightweight geometric arcade blaster, flame glow and a short energy burst when the tab is selected. Reduced-motion settings disable the animation.
2. **QUOTEX LIVE CHART** opens the verification result inside the black-screen panel. Quotex does not publish an official iframe/embed integration; the checked live domains return `X-Frame-Options: SAMEORIGIN`, and its terms prohibit framing. The tab therefore explains the block instead of bypassing it or displaying a fake chart. An explicit separate button can open `quotex.io` in a new tab; nothing redirects the AG BOT page automatically.
3. **PERMITTED MARKET CHART** loads TradingView's official Advanced Chart and Technical Analysis web components inside the same panel. The selected pair and timeframe are shown above the chart. This is an independent real market chart, not a Quotex feed; Quotex OTC symbols are not simulated or substituted.
4. The learning panel explains trend structure, candles, relative support/resistance, RSI/MACD, moving averages and WAIT conditions in English and simple Bengali.
5. A screenshot of the visible chart can be analyzed with `POST /api/vision/direction-pro/analyze`. The report shows one primary result (`UP_BIAS`, `DOWN_BIAS`, or `INSUFFICIENT_EVIDENCE`, displayed as UP BIAS / DOWN BIAS / WAIT), evidence confidence and uncertainty, visible pair/timeframe only when legible, supporting and disagreeing signals, invalidation conditions, and a Bengali explanation. No confidence number is invented before analysis.
6. Mandatory TradingView attribution remains visible. The widget uses TradingView's public embed scripts and requires no AG BOT API key.

No real-money execution, guaranteed prediction, verified accuracy claim or fake live feed is part of this feature.

## HORROR VISION AI

This is a seventh, fully separate tab named **HORROR VISION AI** in the navigation. It adds no replacement, rename or removal of any existing tab, API, component or setting.

1. Upload an authorized MP4, MOV or WebM clip (max 80 MB). The browser previews it with native playback controls, duration and resolution. The full video is never uploaded; only locally decoded sample frames are sent.
2. Choose 8, 12 or 16 sampled frames and press the red **ANALYZE VIDEO** button. Progress is shown per frame.
3. `POST /api/vision/horror-tracking/frame` reuses the existing Gemini Vision configuration in `server/.env`. The model reports up to three inverted cups and up to two balls as normalized bounding boxes with visual-evidence confidence and `visible` / `uncertain` / `occluded` status. No new API key or provider is introduced.
4. The browser links detections across frames into `CUP-n` and `BALL-n` IDs using box overlap and predicted motion. IDs survive a short overlap or disappearance; if the object does not reappear, the ID closes instead of being guessed.
5. The tracking monitor draws boxes, IDs, confidence labels and motion paths on an annotated frame canvas. Users can pause the video, step frame by frame with Prev/Next or the scrubber, and toggle paths.
6. The results dashboard reports unique cup/ball IDs, maximum simultaneous objects, tracked duration, mean visual-evidence confidence, frames analyzed, uncertain frames, overlap frames and processing time. Confidence is evidence clarity, not accuracy or a prediction.

Dark `#050505` backgrounds, blood-red `#8B0000` accents, fog, blinking eyes, scanlines, subtle glitch text and glowing panel borders are scoped to `hv-*` styles. The layout is responsive on phone, tablet and desktop, and animations respect `prefers-reduced-motion`. This tool does not access a broker, gamble, place trades or claim any game outcome.

## Project layout

```
client/src/       TRAPO React + TypeScript + Vite storefront and admin
client/_legacy/   Original trading-analysis frontend (preserved)
server/           Express + TypeScript API (TRAPO store plus legacy market/analysis APIs)
scripts/          Deterministic TRAPO catalogue/artwork generator
```

## AG AI CREATIVE STUDIO

`AG AI CREATIVE STUDIO` is an eighth, independent tab. It does not alter the existing seven tabs, their APIs, settings, components or navigation state beyond adding one new nav entry.

### What it does

- **Smart AI Auto Design:** a plain request is parsed by the configured Gemini text model into a category, purpose, style, layout and palette. The planner is explicitly forbidden from inventing business facts; missing contact details are reported instead of fabricated.
- **Real image generation:** background artwork is generated with the Gemini Interactions API using a Gemini image model. Every prompt forbids text, logos, watermarks and contact details. All accurate business text is composited locally with the browser canvas compositor.
- **Four genuinely different concepts:** each concept uses its own composition recipe, typography, font, colour arrangement, effects direction and generated artwork. Generate New Design, Generate 4 Concepts, Regenerate, Change Colors, Change Style, Change Layout, Edit Design and Save Project are all wired.
- **Primary image provider:** Google Gemini through `/v1beta/interactions`, default model `gemini-nano-banana-2.1` (official stable Nano Banana 2.1). Verified official pricing: **$30 per 1M image output tokens** on paid Standard, about **$0.0336 / 1K**, **$0.0504 / 2K** and **$0.113 / 4K** per image; image generation is **not available on the Free tier**. Source: https://ai.google.dev/gemini-api/docs/pricing#gemini-nano-banana-2.1
- **Availability + quota preflight:** before any generation, the server calls the official `models/{model}` endpoint and a minimal text-only interaction on the same model. `GET /api/creative-studio/preflight` reports `ready`, `exhausted`, `unavailable` or `unknown`. A zero-quota 429 stops generation immediately with the provider message; no placeholder or fake image is ever returned. The status chip in the studio is clickable for a fresh check.
- **Business profile database:** server-side JSON persistence for business name, logo, team photo, contacts, website, email, address, social pages, services, description, brand colours and slogan. Saved profiles are reused automatically and every field can be toggled on or off per design.
- **Logo rules:** logos are converted to PNG in the browser, then cut out either through remove.bg or a deterministic local PNG precision flood-fill. Original RGB values, text, shape and colours are preserved; no AI recreates the logo. Size and position are editable in the inspector.
- **Worker/team photo rules:** uploaded bytes are stored and drawn unchanged. The app never removes the background, changes faces, changes clothing, applies face filters or sends team photos to an image model.
- **Editor and export:** drag any text, logo or photo directly on the canvas, then adjust text, font, alignment, spacing, position, size, opacity, effects and colours in the inspector. Export PNG or JPG at only the resolutions supported by the configured canvas compositor and API (HD, Full HD, 2K, 4K).
- **Persistent history:** saved projects, recent designs, favourites, reopen, download previous designs and delete are served from `server/data/creative-studio/`.

### API and storage

The router is mounted additively at `/api/creative-studio` with its own rate limit. Keys are read only in `server/src/config.ts` and used only in `server/src/services/creativeImage.ts` and the logo route. No key is sent to the browser, logged, returned from `/api/health` or stored in a project.

Assets and JSON metadata live in `server/data/creative-studio/` and are served through `/api/creative-studio/assets/:id`. All prompts use `store: false`.

### Honest failure states

Every capability is checked before use: text generation, image analysis, browser-decoded video-frame analysis and image generation each report their provider/model and configured state in `/api/creative-studio/config`. Image generation probes every configured provider (`gemini` first by default, then `openai` when a key is present) with a 30-second timeout, caches readiness for 60 seconds, uses bounded exponential retry only for transient failures, and falls through to the next real provider if generation fails. If a provider has no quota, preflight reports `AI QUOTA EMPTY` with the provider detail and **no fake image** is created. If quota changes between the check and generation, the generation request fails honestly, the cached preflight is invalidated, and another configured provider is attempted. When no image provider is available, manual background upload plus `Concepts from upload` keeps the full layout/typography editor and exports usable. Logo background removal uses local precision mode when `REMOVEBG_API_KEY` is absent, and reports when no uniform border background could be detected rather than changing pixels blindly.

Live verification note (2026-11-20): `GET /v1beta/models/gemini-nano-banana-2.1` returned **HTTP 200** (`models/gemini-nano-banana-2.1`, Nano Banana 2.1), so the model exists on the configured project. A minimal interaction probe returned **HTTP 429**: `Rate limit exceeded for model gemini-nano-banana-2.1 (limit: 0 input tokens per minute on Free Tier)`. This matches the official pricing statement that image generation needs a paid tier. Generation code is real and ready for an eligible `CREATIVE_IMAGE_API_KEY` or upgraded quota; manual artwork mode was verified as the graceful fallback.


