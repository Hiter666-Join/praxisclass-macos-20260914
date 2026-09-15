import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ stage: { id: 'course-a' }, scenes: [{ id: 'a1', order: 1 }], errors: {} as Record<string, string[]> }));
vi.mock('@/lib/store/stage', () => ({ useStageStore: { getState: () => state } }));
vi.mock('@/lib/store/scene-runtime-errors', () => ({ useSceneRuntimeErrors: { getState: () => ({ errors: state.errors }) } }));
import { withClassroomRuntimeErrors } from '@/lib/workbench/runtime-error-context';

describe('classroom evidence isolation', () => {
  beforeEach(() => { state.errors = {}; });
  it('does not attach errors from another course or without an active course', () => {
    state.errors = { a1: ['private current course error'], b1: ['other learner error'] };
    expect(withClassroomRuntimeErrors('修复', 'course-b')).toBe('修复');
    expect(withClassroomRuntimeErrors('修复')).toBe('修复');
  });
  it('attaches only the active course pages and caps diagnostic text', () => {
    state.errors = { a1: ['error ' + 'x'.repeat(3000)], b1: ['other learner error'] };
    const request = withClassroomRuntimeErrors('修复', 'course-a');
    expect(request).toContain('"sceneId":"a1"');
    expect(request).not.toContain('other learner');
    expect(request).not.toContain('x'.repeat(2001));
  });
});
