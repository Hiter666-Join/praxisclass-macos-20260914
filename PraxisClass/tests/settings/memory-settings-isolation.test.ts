// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({ mode: 'teacher', learnerKey: 'student-a' }));
vi.mock('@/components/platform/nav-config', () => ({
  usePlatformMode: () => ({ mode: identity.mode }),
}));
vi.mock('@/components/platform/use-learner-key', () => ({
  useLearnerKey: () => identity.learnerKey,
}));
vi.mock('@/lib/hooks/use-i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', t: (key: string) => key }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { MemorySettings } from '@/components/settings/memory-settings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let root: Root;
afterEach(() => {
  if (root) act(() => root.unmount());
  document.body.replaceChildren();
  identity.mode = 'teacher';
  identity.learnerKey = 'student-a';
  vi.unstubAllGlobals();
});
const response = (profile: string) => ({
  ok: true,
  json: async () => ({ profile, memory: '', updatedAt: 1 }),
});
const flush = async () => {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
};
function render() {
  if (!document.getElementById('test-root')) {
    const host = document.createElement('div');
    host.id = 'test-root';
    document.body.append(host);
    root = createRoot(host);
  }
  act(() => root.render(createElement(MemorySettings)));
}
function editProfile(text: string) {
  const input = document.getElementById('memory-profile')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('does not apply a late teacher save to the student editor and saves student data with its own key', async () => {
  let finishTeacherSave!: (value: ReturnType<typeof response>) => void;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url.includes('teacher'))
      return new Promise<ReturnType<typeof response>>((resolve) => {
        finishTeacherSave = resolve;
      });
    return response(url.includes('teacher') ? 'TEACHER PROFILE' : 'STUDENT PROFILE');
  });
  vi.stubGlobal('fetch', fetchMock);
  render();
  await flush();
  editProfile('UPDATED TEACHER');
  const save = () =>
    [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'settings.memory.save',
    )!;
  act(() => save().click());
  identity.mode = 'student';
  render();
  await flush();
  expect((document.getElementById('memory-profile') as HTMLTextAreaElement).value).toBe(
    'STUDENT PROFILE',
  );
  expect(document.querySelector('[data-testid="teaching-memory-hint"]')).toBeNull();
  await act(async () => finishTeacherSave(response('UPDATED TEACHER')));
  await flush();
  expect((document.getElementById('memory-profile') as HTMLTextAreaElement).value).toBe(
    'STUDENT PROFILE',
  );
  editProfile('UPDATED STUDENT');
  act(() => save().click());
  await flush();
  const studentSave = fetchMock.mock.calls.find(
    ([url, init]) => url.includes('learner') && init?.method === 'PUT',
  );
  expect(studentSave?.[1]?.headers).toMatchObject({ 'x-learner-key': 'student-a' });
  expect(studentSave?.[1]?.body).toBe(JSON.stringify({ profile: 'UPDATED STUDENT', memory: '' }));
});

it('resets unsaved fields when switching between student identities', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) =>
      response((init?.headers as Record<string, string>)['x-learner-key']),
    ),
  );
  identity.mode = 'student';
  render();
  await flush();
  editProfile('UNSAVED STUDENT A');
  identity.learnerKey = 'student-b';
  render();
  await flush();
  expect((document.getElementById('memory-profile') as HTMLTextAreaElement).value).toBe(
    'student-b',
  );
});
