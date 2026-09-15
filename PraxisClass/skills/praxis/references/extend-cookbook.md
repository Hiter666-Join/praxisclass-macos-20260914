# Extend The PraxisClass Product (Cookbook)

## Scope

You are working inside a PraxisClass product checkout and customizing the Next.js app in place. If instead you are building a separate application with SDK packages supplied by the deployment operator, use [extend-sdk.md](extend-sdk.md).

Entry points below are file and symbol names rather than line numbers. Read the file before editing it. The `@/*` path alias is anchored at the repository root.

## Task 1 — Swap Or Add An AI Provider

**Goal:** route generation to a different provider or register a new one.

Two distinct cases:

- **Use an already-supported provider:** configure keys and models in `.env.local` or `server-providers.yml`; follow [provider-keys.md](provider-keys.md). Keep the `DEFAULT_MODEL=provider:model` prefix.
- **Register a new provider:**
  1. Add the ID to the provider type in `lib/types/provider.ts`.
  2. Register configuration and models in the provider registry in `lib/ai/providers.ts`.
  3. If environment configuration should work, add the provider prefix to `LLM_ENV_MAP` in `lib/server/provider-config.ts`.
  4. Configure the key in `.env.local`, or use a provider entry in `server-providers.yml`.

**Gotcha:** PraxisClass has no hardcoded model fallback. Set `DEFAULT_MODEL` explicitly.

## Task 2 — Enable Server-Side Persistence (PostgreSQL / S3)

**Goal:** persist documents, runtime state, and assets beyond the browser.

Accurate topology:

- **Default:** browser-local stores keep documents, runtime state, and assets on the device.
- **Opt in:** `NEXT_PUBLIC_PERSISTENCE=1` switches the browser to HTTP-backed stores through `lib/persistence/bootstrap.ts`.
- **Server side:** `app/api/persistence/[...path]/route.ts` persists documents and runtime state to PostgreSQL and asset bytes to PostgreSQL or S3.
- **Asset byte selection:** inspect `configuredS3Bucket` and `lazyAssetByteStore` in `lib/persistence/asset-byte-store.ts`; invalid S3 configuration fails asset requests instead of silently changing backends.
- **Workspace storage implementation:** inspect the storage package exports and the consuming imports before selecting a backend subpath.

**Gotcha:** bootstrap is client-side and build-time gated. PostgreSQL needs a reachable database and schema initialization; S3 needs its optional SDK dependency and valid bucket configuration.

## Task 3 — Branding / UI / Theme

**Goal:** change title, fonts, color tokens, or preset themes.

Entry points:

- Product identity and static brand values: `lib/brand/brand-config.ts`.
- Page metadata and global fonts: `app/layout.tsx`.
- Design tokens and content scans: `app/globals.css`.
- Preset themes: `PRESET_THEMES` in `configs/theme.ts`.

**Gotcha:** the app uses Tailwind v4, so theme and source-scan directives live in CSS rather than a JavaScript config file.

## Task 4 — Add A Page Or API Route

**Goal:** ship a new screen or server endpoint.

Entry points:

- Page: `app/<segment>/page.tsx`.
- API route: `app/api/<segment>/route.ts`.
- Shared server helpers: `lib/server/api-response.ts`, `lib/server/llm-error-response.ts`, `lib/server/ssrf-guard.ts`, and `lib/server/proxy-fetch.ts`.
- App imports: use the `@/*` alias.

**Gotcha:** user-supplied outbound URLs must pass through the existing SSRF and proxy helpers. Use the shared LLM error response helper for consistent API errors.

## Task 5 — Embed The Renderer Or Editor

**Goal:** embed a read-only slide canvas or the editable slide surface.

Entry points:

- Read-only canvas usage: `components/slide-renderer/SlideThumbnail.tsx`.
- Editable surface usage: `components/edit/surfaces/slide/RendererEditorCanvas.tsx`.
- Slide data contracts: follow the exact imports already used by those files.

**Gotcha:** renderer fonts and Tailwind class discovery are required. Copy the existing app integration rather than inventing package names, style imports, or font endpoints.

## After Your Edits — Run And Verify

- Startup mode: [startup-modes.md](startup-modes.md).
- Provider configuration: [provider-keys.md](provider-keys.md).
- Service health: `GET <PRAXIS_BASE_URL>/api/health`.
- UI and route behavior: verify through the real browser flow beginning at `/portal`, `/teacher`, or `/student` as appropriate.

When workspace package source changes, inspect the root scripts and package dependency graph, then rebuild only the affected package and its dependants in the repository's declared order.
