# Consume The PraxisClass SDK (Build A New App)

## Scope

You are building a separate application with SDK package coordinates supplied by the PraxisClass deployment or source distribution. If you are customizing the product checkout itself, use [extend-cookbook.md](extend-cookbook.md).

Do not invent registry scopes, package names, versions, or repository URLs. Read them from the supplied package manifests or deployment documentation.

## Package Quick Reference

| Capability | Purpose | Typical Exports | Integration Notes |
|---|---|---|---|
| DSL | Slide types and JSON schema | `Slide`, `PPTElement`, schema exports | Usually has no UI runtime dependency |
| Renderer | Read-only slide rendering and snapshots | `SlideCanvas`, `slideToPng` | Requires React and the declared style/runtime peers |
| Editor | Editable slide surface | `EditableSlideCanvasWithUI` | Also requires the renderer's peers |
| Generation | LLM-driven lesson and scene generation | `generateSceneContent` | Use server-side provider configuration |
| Storage | Browser, HTTP, PostgreSQL, S3, and KV stores | backend-specific store classes | Some server backends have optional dependencies |
| Importer | PPTX or PDF conversion into the DSL | `importPptx` | Follow the package's supported input contract |

## Minimal Starter — Render A Slide

1. Read the package names and exact versions from the supplied manifests.
2. Install the DSL, renderer, React, and every declared peer using those exact coordinates.
3. Import the consuming app's CSS framework and renderer font stylesheet exactly as documented by the package.
4. Ensure the CSS framework scans the renderer's built classes.
5. Import `SlideCanvas` and the `Slide` type from the supplied package entry points.
6. Use `components/slide-renderer/SlideThumbnail.tsx` in the product checkout as the behavioral reference when it is available.

Example placeholders:

```bash
npm install <DSL_PACKAGE>@<VERSION> <RENDERER_PACKAGE>@<VERSION>
```

```tsx
import { SlideCanvas } from '<RENDERER_PACKAGE>';
import type { Slide } from '<DSL_PACKAGE>';
```

## Precise Import Paths

| Want | How to locate the import |
|---|---|
| Slide and element types | DSL package main export |
| JSON schema | DSL package schema export listed in `exports` |
| Render a slide | Renderer package export containing `SlideCanvas` |
| Snapshot a slide | Renderer snapshot export containing `slideToPng` |
| Editable slide surface | Editor UI export containing `EditableSlideCanvasWithUI` |
| Generate lesson content | Generation export containing `generateSceneContent` |
| Import a PPTX | Importer export containing `importPptx` |
| Storage backends | Backend-specific exports described below |

## Storage Backends — Exact Subpaths

Read the supplied storage package's `exports` map. Do not assume a bare domain subpath exists.

| Domain | Browser | HTTP | PostgreSQL | S3 |
|---|---|---|---|---|
| Document | main or browser export | document HTTP export | document PostgreSQL export | — |
| Runtime | main or browser export | runtime HTTP export | runtime PostgreSQL export | — |
| Asset | main or browser export | asset HTTP export | asset PostgreSQL exports | asset S3 export |
| KV | main or browser export | KV HTTP export | — | — |
| Server helpers | server exports | | | |

Runtime stores may be available only from backend-specific exports rather than the main barrel. Verify each symbol against the installed package. Run the supplied schema initializer for PostgreSQL backends, and install optional S3 dependencies when required.

## Version Pinning

Pin the exact versions supplied by the operator or package manifest. Do not introduce range operators for pre-1.0 packages unless the distribution explicitly allows them.

## If You Need To Change The SDK Itself

1. Obtain the authorized source location from the deployment operator.
2. Edit only the relevant package source and rebuild its distributable output with the repository's declared script.
3. Produce an installable artifact for that package or publish it under a private coordinate controlled by the user.
4. Keep the source diff small and track the operator-provided upstream revision.
