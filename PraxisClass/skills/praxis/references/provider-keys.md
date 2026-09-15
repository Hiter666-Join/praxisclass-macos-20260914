# Provider Keys

## Critical Boundary

PraxisClass generation does not automatically reuse the OpenClaw agent's current model or API key.

PraxisClass server APIs resolve their own models and provider keys from server-side config.

This skill does not rely on runtime overrides for model, provider, API key, base URL, or provider type.

If the user wants to change any of those values, they must edit the PraxisClass server-side config files.

## Interaction Flow

1. Recommend one provider path first. Do not start by asking for an API key.
2. Ask whether the user wants to configure `.env.local` (recommended for most users) or `server-providers.yml`.
3. Tell the user exactly which variables or YAML fields to edit. Do not offer to write the key, request the literal key in chat, or suggest request-time overrides.
4. Wait for the user to confirm they finished editing.
5. If generation later fails because of authentication, provider, or model selection, return to the same server-side config and wait for confirmation before retrying.

## Recommendation Paths

### 1. Lowest-Friction Setup

Recommended when the user wants the smallest amount of configuration.

Set one supported provider key and its matching explicit model, for example:

```env
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_MODEL=anthropic:<model>
```

Why:

- PraxisClass has no hardcoded model fallback.
- The provider prefix is required to resolve the intended provider.

### 2. Better Speed / Cost Balance

Recommended when the user is willing to set one extra variable.

```env
GOOGLE_API_KEY=...
DEFAULT_MODEL=google:<model>
```

Why:

- A fast model can reduce classroom-generation latency and cost.
- The `google:` prefix prevents the model from being resolved by the wrong provider.

### 3. Existing Provider Reuse

Use when the user already has a supported provider configured and wants to keep it.

Examples:

```env
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=openai:<model>
```

```env
DEEPSEEK_API_KEY=...
DEFAULT_MODEL=deepseek:<model>
```

## Model String Rule

When recommending or showing `DEFAULT_MODEL`, always include the provider prefix:

- `google:<model>`
- `anthropic:<model>`
- `openai:<model>`
- `deepseek:<model>`

Do not recommend a bare model ID. Model names change; direct the user to the provider's official documentation for the current model name while keeping the `provider:` prefix.

Do not work around a wrong `DEFAULT_MODEL` by changing request parameters. Fix server-side config instead.

## Preferred Config Method

For first setup, prefer `.env.local`:

```bash
cp .env.example .env.local
```

Then fill the chosen key and explicit model.

Alternative: `server-providers.yml`

```yaml
providers:
  anthropic:
    apiKey: sk-ant-...

  google:
    apiKey: ...

  openai:
    apiKey: sk-...
```

If using a non-default provider for classroom generation, also set its model selection explicitly.

## Recommended Prompts To The User

Example phrasing the agent can adapt:

- "I recommend configuring PraxisClass through `.env.local` first. Please edit that file locally and tell me when you're done."
- "Choose a supported provider, then set `DEFAULT_MODEL` with the matching provider prefix. Which provider do you want to use?"

The rules against requesting or writing a secret in chat are covered in [Interaction Flow](#interaction-flow).

## Optional Features

These features require additional provider keys beyond the core LLM provider. Ask which ones the user wants after the core provider works.

| Feature | Env Variable(s) | Description |
|---------|-----------------|-------------|
| Web Search | `TAVILY_API_KEY` | Enriches outlines with current web research |
| Image Generation | `IMAGE_SEEDREAM_API_KEY`, `IMAGE_QWEN_IMAGE_API_KEY`, `IMAGE_NANO_BANANA_API_KEY` | Generates slide images; any one supported provider can suffice |
| Video Generation | `VIDEO_SEEDANCE_API_KEY`, `VIDEO_KLING_API_KEY`, `VIDEO_VEO_API_KEY`, `VIDEO_SORA_API_KEY` | Generates short videos; any one supported provider can suffice |
| TTS | `TTS_OPENAI_API_KEY`, `TTS_AZURE_API_KEY`, `TTS_GLM_API_KEY`, `TTS_QWEN_API_KEY` | Generates narration; any one supported provider can suffice |

These features are optional. Classroom generation works without them.

They may also be configured in the corresponding `server-providers.yml` capability sections.
