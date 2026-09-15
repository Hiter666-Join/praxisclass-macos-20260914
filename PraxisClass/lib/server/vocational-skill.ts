import fs from 'node:fs';
import path from 'node:path';

/** Both generation entries read the same built-in vocational guidance. */
export function loadVocationalSkillBody(): string {
  return fs
    .readFileSync(path.join(process.cwd(), 'skills/agent-runtime/vocational/SKILL.md'), 'utf8')
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .trim();
}
