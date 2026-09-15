---
name: praxis
description: PraxisClass assistant for setting up, generating, and extending PraxisClass. Use when the user wants to use PraxisClass, generate a multi-agent interactive classroom, or build on, extend, or customize the product and its classroom capabilities. Covers a deployer-provided instance or local setup, startup modes, provider keys, classroom generation, and secondary development.
user-invocable: true
metadata: { "openclaw": { "emoji": "🏫" } }
---

# PraxisClass Skill

Use this as a guided, confirmation-heavy SOP. Do not compress the whole setup into one reply and do not perform state-changing actions without explicit user confirmation.

## Core Rules

- Move one phase at a time.
- Before any state-changing action, ask for confirmation.
- If local state already exists, show what you found and ask whether to keep it.
- Do not assume the OpenClaw agent's own model or API key will be reused by PraxisClass.
- PraxisClass classroom generation uses server-side provider config from the selected deployment.
- This skill must not rely on request-time model or provider overrides.
- Only PraxisClass server-side config files may control provider selection and defaults.
- Do not default to asking the user to paste API keys into chat.
- Prefer guiding the user to edit local config files themselves.
- Do not offer to write API keys into config files on the user's behalf.
- Once setup is complete and the user clearly asks to generate a classroom, do not ask for a second confirmation before submitting the generation job.
- Keep confirmations for local file reads such as reading a PDF from disk.

## Optional Skill Config

If present, read defaults from `~/.openclaw/openclaw.json` under:

```jsonc
{
  "skills": {
    "entries": {
      "praxis": {
        "enabled": true,
        "config": {
          "accessCode": "deployment-provided-code",
          "repoDir": "/path/to/praxisclass",
          "url": "<PRAXIS_BASE_URL>"
        }
      }
    }
  }
}
```

- Replace `<PRAXIS_BASE_URL>` with the URL supplied by the deployment operator before making requests.
- Treat `accessCode` as optional deployment-specific authentication; never assume it exists or ask the user to paste it into chat.
- Use `repoDir` and `url` only as defaults.
- Still confirm before acting.

## How To Use

- Start at `<PRAXIS_BASE_URL>/portal` to choose the appropriate platform entry.
- Teachers use `<PRAXIS_BASE_URL>/teacher` to create, generate, and manage classrooms.
- Students use `<PRAXIS_BASE_URL>/student` to open assigned or available classrooms.
- OpenClaw automation uses the server APIs under `<PRAXIS_BASE_URL>` after the deployment and role are confirmed.

## SOP Phases

### 0. Choose Mode

Ask how the user wants to use PraxisClass:

1. **Use a deployed instance** (recommended for quick start) — Use the URL and any access instructions supplied by the deployment operator. Load [references/live-demo.md](references/live-demo.md).
2. **Run locally** — Reuse or obtain the product source, configure provider keys, and run it on the user's machine.
3. **Extend or build on PraxisClass (二次开发)** — Customize the product or consume the classroom capabilities in another application.

If the user chooses a deployed instance, load [references/live-demo.md](references/live-demo.md) and skip phases 1–4.
If the user chooses local mode, proceed to phase 1.
If the user chooses to extend the product, load [references/extend.md](references/extend.md) and skip the setup/generation phases until the development target is clear.

### 1. Clone Or Reuse Existing Repo

Load [references/clone.md](references/clone.md).

Use this when the user has not installed PraxisClass yet or when you need to confirm which local checkout to use.

### 2. Choose Startup Mode

Load [references/startup-modes.md](references/startup-modes.md).

Use this after the repo location is confirmed. Present the available startup modes, recommend one, and wait for the user's choice.

### 3. Configure Provider Keys

Load [references/provider-keys.md](references/provider-keys.md).

Use this before starting classroom generation. Recommend a provider path and tell the user exactly which config file to edit themselves. If generation later fails due to provider, model, or authentication issues, return to this phase and direct the user to update the same server-side config files.

After the core LLM key is configured, ask whether the user wants optional web search, image generation, video generation, or TTS. Each requires its own provider config.

### 4. Start And Verify PraxisClass

After the user has chosen a startup mode and configured keys, start PraxisClass using the chosen method, set `<PRAXIS_BASE_URL>` to the resulting service URL, then verify it with `GET <PRAXIS_BASE_URL>/api/health`.

### 5. Generate A Classroom

Load [references/generate-flow.md](references/generate-flow.md).

Use this only after the service is healthy. Confirm before reading local PDFs. If the user has already clearly asked to generate, do not ask for a second confirmation before submitting the generation job. Follow the polling loop until it succeeds or fails, and send only supported content fields. For long-running jobs, prefer sparse polling and preserve the job ID and polling URL.

## Response Style

- Keep each step short and explicit.
- Prefer 2–3 concrete options when the user must choose.
- Always include the recommended option first and explain why in one sentence.
- After a step completes, say what changed and what the next confirmation is for.
- When returning a classroom link, place the raw absolute URL on its own line with no bold, markdown link syntax, code formatting, or tables.
