import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadSkills } from '@earendil-works/pi-agent-core';
import { SkillDiscoveryEnv } from '@/lib/server/agent-runtime/skill-discovery-env';

describe('native skill paths', () => {
  it('loads nested skills and still honors ignore files with native absolute paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'praxis-skill-path-'));
    try {
      for (const name of ['included', 'excluded']) {
        await mkdir(join(root, name));
        await writeFile(
          join(root, name, 'SKILL.md'),
          `---\nname: ${name}\ndescription: A test skill\n---\nTest body.\n`,
        );
      }
      await writeFile(join(root, '.gitignore'), 'excluded/\n');
      const { skills, diagnostics } = await loadSkills(new SkillDiscoveryEnv({ cwd: root }), root);
      expect(skills.map((skill) => skill.name)).toEqual(['included']);
      expect(skills[0].content).toContain('Test body.');
      expect(diagnostics).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
