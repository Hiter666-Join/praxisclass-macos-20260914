# Extend Or Build On PraxisClass (二次开发)

## Charter

Secondary development is a confirmation-heavy, read-before-modify guidance flow, not a generation flow. Help the user understand the existing code first, then make targeted changes. Default to leaving workspace SDK internals unchanged unless the requested behavior requires them.

This flow takes priority whenever the user's intent is to extend, build on, or customize PraxisClass, even if a deployed-instance URL is already configured.

## Secondary-Development Rules

1. **Read before edit.** Read a target file and the symbols it imports before changing it. Point the user to precise entry points instead of pasting large files into chat.
2. **Respect the repository toolchain.** Read the root package metadata and version files; do not guess package-manager or Node versions.
3. **Forking and CI changes are conditional.** Decide from the user's collaboration and deployment needs instead of treating them as defaults.

## Development Environment (Same As Local Deployment)

The development environment is the same environment used for a local PraxisClass deployment: one checkout, one dependency installation, the same provider config, and the same startup modes. Establish one working instance before adding changes.

**Where to get code:**

- **Existing local checkout:** reuse it after confirming branch and worktree state.
- **Operator-provided source:** use the repository URL or source bundle supplied for this deployment.
- **Remote collaboration:** create a remote under an account the user controls only when they need backup, multi-machine work, review, or deployment.

Reuse [clone.md](clone.md), [startup-modes.md](startup-modes.md), and [provider-keys.md](provider-keys.md). Verify the running service with `GET <PRAXIS_BASE_URL>/api/health`, then check UI and route changes in a browser.

## Route To The Right Sub-Reference

Ask which target the user wants before loading more detail:

- **Customize the PraxisClass product itself** — change a provider, persistence, branding, page, API route, renderer, or editor. Load [extend-cookbook.md](extend-cookbook.md).
- **Build a separate app with the supplied classroom SDK packages** — consume the package coordinates distributed with the deployment. Load [extend-sdk.md](extend-sdk.md).

Typical examples:

- "I want PraxisClass to call my company's LLM or use my storage" → cookbook.
- "I want to render classroom slides in my separate app" → SDK guidance.
- "I want to add a feature to PraxisClass" → cookbook.

## General Gotchas

- **[product] Built output may be generated.** Check package scripts and workspace manifests before editing generated files.
- **[product] Vendor assets may be asserted before build.** Preserve the repository's existing synchronization steps.
- **[product] Workspace dependencies may be symlinked.** A source edit can require rebuilding the affected package before consumers see it.
- **[both] Renderer styling depends on the declared CSS framework and content scans.** Read the consuming app's styles before changing renderer integration.
- **[product] The `@/*` path alias is anchored at the repository root.** Do not resolve it relative to a workspace package.
