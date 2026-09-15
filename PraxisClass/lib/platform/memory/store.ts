import fs from 'node:fs/promises';
import path from 'node:path';

import type { MemoryDoc, MemoryScope } from '@/lib/platform/memory/types';

const MAX_FILE_CHARS = 2048;
const SUBJECT_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;

function memoryDirectory(scope: MemoryScope, subjectId: string): string {
  if (!SUBJECT_PATTERN.test(subjectId)) throw new Error('invalid_subject_id');
  if (scope === 'teacher' && subjectId !== 'teacher:main') throw new Error('invalid_subject_id');
  const dataDirectory = process.env.PLATFORM_DATA_DIR ?? path.join(process.cwd(), 'data');
  const directoryName = process.platform === 'win32' ? subjectId.replaceAll(':', '%3A') : subjectId;
  return path.join(dataDirectory, 'memory', scope, directoryName);
}

function truncate(value: string): string {
  return [...value].slice(0, MAX_FILE_CHARS).join('');
}

async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

async function modifiedAt(filePath: string): Promise<number | null> {
  try {
    return Math.floor((await fs.stat(filePath)).mtimeMs);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function atomicWrite(filePath: string, value: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, truncate(value), 'utf8');
  await fs.rename(temporary, filePath);
}

export async function readMemory(scope: MemoryScope, subjectId: string): Promise<MemoryDoc> {
  const directory = memoryDirectory(scope, subjectId);
  const profilePath = path.join(directory, 'PROFILE.md');
  const memoryPath = path.join(directory, 'MEMORY.md');
  const [profile, memory, profileTime, memoryTime] = await Promise.all([
    readFile(profilePath),
    readFile(memoryPath),
    modifiedAt(profilePath),
    modifiedAt(memoryPath),
  ]);
  const timestamps = [profileTime, memoryTime].filter((value): value is number => value !== null);
  return {
    profile,
    memory,
    updatedAt: timestamps.length ? Math.max(...timestamps) : null,
  };
}

export async function writeMemory(
  scope: MemoryScope,
  subjectId: string,
  input: { profile?: string; memory?: string },
): Promise<MemoryDoc> {
  const directory = memoryDirectory(scope, subjectId);
  const writes: Promise<void>[] = [];
  if (input.profile !== undefined) {
    writes.push(atomicWrite(path.join(directory, 'PROFILE.md'), input.profile));
  }
  if (input.memory !== undefined) {
    writes.push(atomicWrite(path.join(directory, 'MEMORY.md'), input.memory));
  }
  await Promise.all(writes);
  return readMemory(scope, subjectId);
}

export async function clearMemory(scope: MemoryScope, subjectId: string): Promise<void> {
  await fs.rm(memoryDirectory(scope, subjectId), { recursive: true, force: true });
}
