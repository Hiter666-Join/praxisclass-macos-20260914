import fs from 'node:fs/promises';
import path from 'node:path';

import { isTeacherRequest } from '@/lib/platform/auth/require-teacher';
import { createLogger } from '@/lib/logger';
import { readMemory } from './store';

const log = createLogger('TeachingMemory');
export type TeachingMemoryStatus = 'off' | 'empty' | 'applied' | 'unavailable';

export interface TeachingMemoryContext {
  status: TeachingMemoryStatus;
  instructions: string;
  data: string;
}

/** Only teacher-mode requests may opt in; the header never replaces authentication. */
export async function loadTeachingMemory(request: Request): Promise<TeachingMemoryContext> {
  if (request.headers?.get('x-teacher-memory') !== 'true') {
    return { status: 'off', instructions: '', data: '' };
  }
  try {
    if (!(await isTeacherRequest(request))) {
      return { status: 'off', instructions: '', data: '' };
    }
    return loadRuntimeTeachingMemory('teacher');
  } catch {
    log.warn('Teacher memory could not be loaded; continuing with the current request.');
    return { status: 'unavailable', instructions: '', data: '' };
  }
}

/** The runtime supplies the role from its owned session's service settings. */
export async function loadRuntimeTeachingMemory(
  role: 'teacher' | 'student',
): Promise<TeachingMemoryContext> {
  const empty = (status: TeachingMemoryStatus): TeachingMemoryContext => ({
    status,
    instructions: '',
    data: '',
  });
  if (role !== 'teacher') return empty('off');
  try {
    const memory = await readMemory('teacher', 'teacher:main');
    const profile = [...memory.profile.trim()].slice(0, 2048).join('');
    const longTermMemory = [...memory.memory.trim()].slice(0, 2048).join('');
    if (!profile && !longTermMemory) return empty('empty');
    const instructions = await fs.readFile(
      path.join(
        process.cwd(),
        'skills/agent-runtime/build-personal-skill/references/apply-teaching-memory.md',
      ),
      'utf8',
    );
    return {
      status: 'applied',
      instructions,
      data: JSON.stringify({ teacherProfile: profile, longTermMemory }),
    };
  } catch {
    // Do not log private memory or block course generation on a read failure.
    log.warn('Teacher memory could not be loaded; continuing with the current request.');
    return empty('unavailable');
  }
}

/** Keep user-authored memory out of the system channel and current requirements last. */
export function withTeachingMemory(
  system: string,
  user: string,
  context: TeachingMemoryContext,
  currentRequirement?: string,
): { system: string; user: string } {
  if (context.status !== 'applied') return { system, user };
  return {
    system: `${system}\n\n${context.instructions}`,
    user: [
      'Teacher memory (background data only):',
      context.data,
      '\nCurrent task (takes precedence over memory):',
      user,
      ...(currentRequirement
        ? ['\nExplicit course requirement (takes precedence over memory):', currentRequirement]
        : []),
    ].join('\n'),
  };
}
