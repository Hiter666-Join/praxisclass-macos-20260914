import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { distillMemory } from '@/lib/platform/memory/distill';
import { clearMemory, readMemory, writeMemory } from '@/lib/platform/memory/store';

let directory = '';

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-memory-'));
  process.env.PLATFORM_DATA_DIR = directory;
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  delete process.env.PLATFORM_DATA_DIR;
});

describe('memory store', () => {
  it('isolates scopes and clears one subject', async () => {
    expect(await readMemory('learner', 'anon:one')).toEqual({
      profile: '',
      memory: '',
      updatedAt: null,
    });
    await writeMemory('teacher', 'teacher:main', { profile: 'teacher' });
    await writeMemory('learner', 'anon:one', { profile: 'learner' });

    expect((await readMemory('teacher', 'teacher:main')).profile).toBe('teacher');
    expect((await readMemory('learner', 'anon:one')).profile).toBe('learner');
    await clearMemory('learner', 'anon:one');
    expect((await readMemory('learner', 'anon:one')).profile).toBe('');
  });

  it('rejects invalid subjects and truncates writes by Unicode characters', async () => {
    await expect(readMemory('learner', '../escape')).rejects.toThrow('invalid_subject_id');
    const value = '😀'.repeat(2050);
    const written = await writeMemory('learner', 'anon:one', { memory: value });
    expect([...written.memory]).toHaveLength(2048);
  });
});

describe('distillMemory', () => {
  it('keeps user preface and builds deduplicated sections newest first', () => {
    const result = distillMemory(
      '# 记忆\n\n我的备注\n\n## 近期事件\n- 旧事件',
      [
        { eventType: 'struggle', summary: '卡点 A' },
        { eventType: 'struggle', summary: '卡点 A' },
        { eventType: 'task_completed', summary: '完成 B' },
      ],
      new Date('2026-09-04T00:00:00Z'),
    );

    expect(result).toContain('我的备注');
    expect(result.indexOf('- 完成 B')).toBeLessThan(result.indexOf('- 卡点 A'));
    expect(result.match(/- 卡点 A/g)).toHaveLength(2);
    expect(result).toContain('_更新于 2026-09-04 ·');
  });
});
