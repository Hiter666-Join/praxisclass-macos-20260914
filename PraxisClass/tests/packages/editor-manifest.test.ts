import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const editorPackage = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../packages/@praxis/editor/package.json', import.meta.url)),
    'utf8',
  ),
) as {
  repository?: { type?: string; url?: string; directory?: string };
};

describe('@praxis/editor publish manifest', () => {
  it('omits obsolete upstream repository metadata', () => {
    expect(editorPackage.repository).toBeUndefined();
  });
});
