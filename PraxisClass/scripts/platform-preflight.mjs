const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const classroomId = process.env.CLASSROOM_ID;
let passed = 0;
let failed = 0;

function url(path) {
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, operation) {
  try {
    const detail = await operation();
    const suffix = typeof detail === 'string' && detail ? ` — ${detail}` : '';
    console.log(`PASS ${name}${suffix}`);
    passed += 1;
    return detail;
  } catch (error) {
    console.log(`FAIL ${name} — ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
    return undefined;
  }
}

async function expectStatus(path, status, options) {
  const response = await fetch(url(path), options);
  assert(response.status === status, `expected ${status}, got ${response.status}`);
  return response;
}

await check('GET /api/health', () => expectStatus('/api/health', 200));
await check('GET /portal', () => expectStatus('/portal', 200));
await check('GET /student', () => expectStatus('/student', 200));

await check('GET /api/platform/teacher-pin', async () => {
  const response = await expectStatus('/api/platform/teacher-pin', 200);
  const body = await response.json();
  assert(body.enabled === false, 'Demo entry must be passwordless');
  return 'passwordless demo';
});

await check('GET /teacher without password', () => expectStatus('/teacher', 200));
await check('teacher dashboard without password', () => expectStatus('/api/platform/dashboard?scope=all', 200));

await check('POST /api/platform/knowledge (optional Dify)', async () => {
  const response = await fetch(url('/api/platform/knowledge'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'query', query: 'preflight' }),
  });
  const body = await response.json();
  if (response.status === 503 && body.error === 'dify_unconfigured')
    return 'Dify not configured (optional)';
  assert(response.status === 200, `Dify query returned ${response.status}`);
  assert(body.source === 'dify', `invalid source=${body.source}`);
  return `source=${body.source}`;
});
await check('GET /api/platform/schedule', () => expectStatus('/api/platform/schedule', 200));

if (classroomId) {
  await check(`GET /classroom/${classroomId}`, () =>
    expectStatus(`/classroom/${encodeURIComponent(classroomId)}`, 200),
  );
}

console.log(`SUMMARY ${passed} PASS, ${failed} FAIL`);
console.log(`Demo entry: ${url('/portal')}`);
process.exitCode = failed ? 1 : 0;
