import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupPlatformData } from '@/lib/platform/db/backup';
import { getPlatformDao, resetPlatformDaoForTests } from '@/lib/platform/db/dao';

let directory = '';
describe.each(['sqlite', 'jsonl'] as const)('%s platform backup and restore', (driver) => {
  beforeEach(() => {
    resetPlatformDaoForTests();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-backup-'));
    process.env.PLATFORM_DATA_DIR = directory;
    process.env.PLATFORM_DB_DRIVER = driver;
  });
  afterEach(() => {
    resetPlatformDaoForTests();
    fs.rmSync(directory, { recursive: true, force: true });
    delete process.env.PLATFORM_DATA_DIR;
    delete process.env.PLATFORM_DB_DRIVER;
  });
  it('restores a daily snapshot without recursively including backups or unrelated files', async () => {
    const dao = await getPlatformDao();
    dao.insertFeedback({
      form_type: 'teacher_prep',
      subject_id: 'teacher:main',
      course_id: 'course',
      course_version: 'v1',
      ratings_json: '{}',
      text_json: '{}',
    });
    fs.mkdirSync(path.join(directory, 'memory/teacher/main'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'memory/teacher/main/PROFILE.md'), '教学偏好');
    fs.writeFileSync(path.join(directory, '.env.local'), 'must-not-copy');
    const day = new Date('2026-09-05T00:00:00Z');
    const snapshot = await backupPlatformData(day);
    expect(await backupPlatformData(day)).toBe(snapshot);
    expect(fs.existsSync(path.join(snapshot, 'backup'))).toBe(false);
    expect(fs.existsSync(path.join(snapshot, '.env.local'))).toBe(false);
    expect(fs.readFileSync(path.join(snapshot, 'memory/teacher/main/PROFILE.md'), 'utf8')).toBe(
      '教学偏好',
    );
    const restored = path.join(directory, 'restore-check');
    fs.cpSync(snapshot, restored, { recursive: true });
    resetPlatformDaoForTests();
    process.env.PLATFORM_DATA_DIR = restored;
    expect((await getPlatformDao()).countFeedback()).toBe(1);
  });
});
