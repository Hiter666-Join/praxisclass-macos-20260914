# Generate Flow

## Preconditions

- `<PRAXIS_BASE_URL>` has been replaced with the URL supplied by the deployment operator or local startup.
- The PraxisClass service is healthy at that URL.
- Provider keys are configured when the selected deployment requires them.
- The user is acting from the teacher flow when creating a classroom; students use `/student` to consume an existing classroom.

For a deployed instance, include only the authentication headers required by its operator. See [live-demo.md](live-demo.md).

## Requirement-Only Generation

If the user has already clearly asked to generate the classroom and the preconditions are satisfied, submit the generation job immediately. Do not ask for a second confirmation just before calling the endpoint.

Submit the job with:

```text
POST <PRAXIS_BASE_URL>/api/generate-classroom
```

Request body:

```json
{
  "requirement": "Create an introductory classroom on quantum mechanics for high school students"
}
```

Only send supported content fields:

- `requirement` (required)
- optional `pdfContent`
- optional `enableWebSearch` (boolean)
- optional `enableImageGeneration` (boolean)
- optional `enableVideoGeneration` (boolean)
- optional `enableTTS` (boolean)
- optional `agentMode` (`"default"` or `"generate"`)

All optional boolean fields default to `false` when omitted.

### Feature Detection

Before sending optional feature flags, query `GET <PRAXIS_BASE_URL>/api/health` and check the `capabilities` object:

```json
{
  "status": "ok",
  "version": "...",
  "capabilities": {
    "webSearch": true,
    "imageGeneration": false,
    "videoGeneration": false,
    "tts": true
  }
}
```

Only set a feature flag to `true` if the corresponding capability is `true`. If `capabilities` is absent, omit the optional fields.

Do not rely on request-time model or provider overrides.

Treat the `POST` response as job submission only. Expect fields such as:

```json
{
  "success": true,
  "jobId": "abc123",
  "status": "queued",
  "step": "queued",
  "pollUrl": "<PRAXIS_BASE_URL>/api/generate-classroom/abc123",
  "pollIntervalMs": 5000
}
```

## PDF-Based Generation

1. Resolve the absolute path to the PDF.
2. Confirm before reading the file.
3. Parse the PDF first:

```text
POST <PRAXIS_BASE_URL>/api/parse-pdf
```

4. Send `requirement` plus `pdfContent` to `POST <PRAXIS_BASE_URL>/api/generate-classroom`.

## Polling Loop

After the job is submitted:

1. Save `jobId`, `pollUrl`, and `pollIntervalMs`.
2. Do not submit another generation job while this one is `queued` or `running`.
3. Poll `GET {pollUrl}`.
4. Prefer a conservative cadence of about 60 seconds even if `pollIntervalMs` is shorter.
5. Treat `queued` and `running` as in-progress.
6. Stop only when `status` becomes `succeeded` or `failed`.

### Reliability Rules

- Never restart the job because one poll request fails.
- For a transient network error or `5xx`, wait and retry the same `pollUrl`.
- If the job stays in progress, continue polling instead of resubmitting.
- Within one turn, cap active polling at about 10 minutes; preserve `jobId` and `pollUrl` for the next turn.
- Report progress only when `status`, `step`, or visible progress changes.
- Do not recover from authentication, provider, model, or base-URL errors by changing request parameters.
- On `failed`, surface the server error and include `jobId`.
- On `succeeded`, use `result.classroomId` and `result.url` from the final response.

## If The Loop Ends First

If the job is still running when active polling ends, state that it is still in progress and preserve the same job details:

```text
The classroom generation is still running in the background.
Job ID: abc123
Poll URL: <PRAXIS_BASE_URL>/api/generate-classroom/abc123

Check back later to continue tracking this same job without starting over.
```

## What To Return

Return the generated classroom ID plus the exact `result.url` supplied by the server.

Output the URL as a raw absolute URL on its own line. Do not wrap it in bold, markdown-link, code, angle-bracket, or table formatting.

Use a compact format like:

```text
Classroom ID: Uyh82Y32ZK
Classroom URL:
<PRAXIS_BASE_URL>/classroom/Uyh82Y32ZK
```

If the job fails, return the job ID and the server error. For provider or model configuration problems, direct the user to `.env.local` or `server-providers.yml`.

## Confirmation Requirements

- Ask before reading a local PDF.
- Do not ask for a second confirmation before generation if the user already clearly asked for it.
