# Deployed Instance Mode

Use this mode when a deployment operator has provided a PraxisClass base URL and any required access instructions. There is no built-in public instance or fixed service address.

## Access Code Setup

1. Read `url` and optional `accessCode` from skill config (`~/.openclaw/openclaw.json` → `skills.entries.praxis.config`).
2. If `url` is absent or still equals `<PRAXIS_BASE_URL>`, ask the user for the deployment URL supplied by their operator.
3. If the operator requires an access code, ask the user to save it in the skill config themselves. Do not ask them to paste it into chat.
4. Verify connectivity with `GET <PRAXIS_BASE_URL>/api/health`.
   - Include `Authorization: Bearer <access-code>` only when the deployment operator requires it.
   - On success: confirm connection and proceed to generation.
   - On authentication failure: ask the user to check the operator-provided access instructions and update the config.
   - On network failure: suggest checking the supplied URL or using local mode.

## Generating a Classroom

Follow [generate-flow.md](generate-flow.md) with these deployment-specific values:

- **Base URL**: `<PRAXIS_BASE_URL>`, replaced with the operator-provided URL.
- **Authorization**: include only the authentication header required by that deployment.
- **Teacher entry**: `<PRAXIS_BASE_URL>/teacher`.
- **Student entry**: `<PRAXIS_BASE_URL>/student`.
- **Portal entry**: `<PRAXIS_BASE_URL>/portal`.
- **Classroom URL**: use `result.url` from the completed generation job; do not construct a host yourself.

### Feature Detection in Deployed Mode

Before generating, query `GET <PRAXIS_BASE_URL>/api/health` and check `capabilities`. Include an optional feature flag only when the corresponding capability is `true`. If `capabilities` is absent, omit the optional flags.

## Quota

- Do not assume a fixed quota or reset schedule.
- If the deployment rejects a job because of quota, report the server message and direct the user to the deployment operator's policy.

## Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 401 | Authentication required or invalid | Ask the user to verify the operator-provided credentials |
| 403 | Access or quota denied | Surface the server message and refer to deployment policy |
| 500 | Server error | Preserve the first server error and suggest retrying later or using local mode |
