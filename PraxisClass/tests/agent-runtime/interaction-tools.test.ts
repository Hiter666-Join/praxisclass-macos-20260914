import { describe, expect, it, vi } from 'vitest';
import { InMemorySessionRepo, type SessionTreeEntry } from '@earendil-works/pi-agent-core';
import { buildDslCourseTools } from '@/lib/server/agent-runtime/dsl-tools';
import type { CourseDocument, CourseStore } from '@/lib/server/agent-runtime/course-tools';
import {
  InteractionChecks,
  buildInteractionTool,
  INTERACTION_CHECKPOINT_TYPE,
  COURSE_CHECKPOINT_TYPE,
} from '@/lib/server/agent-runtime/interaction-tools';
import {
  runInteractionBrowser,
  type InteractionCase,
  type InteractionResult,
} from '@/lib/server/agent-runtime/interaction-browser';
import { completeCourseRepairs } from '@/lib/server/agent-runtime/course-completion';
import { CourseBriefState } from '@/lib/server/agent-runtime/course-brief';
import type { Scene } from '@/lib/types/stage';

const brokenHtml = `<!doctype html><html><body>
<select id="mode"><option value="ok">正常</option><option value="bad">故障</option></select>
<button id="run">检查</button><button id="reset">重置</button><output id="status">待检查</output>
<script>
const mode = document.querySelector('#mode'), status = document.querySelector('#status');
document.querySelector('#run').onclick = () => { status.textContent = mode.value === 'ok' ? 'GO' : 'STOP'; };
document.querySelector('#reset').onclick = () => { mode.value = 'ok'; status.textContent = '待检查'; };
/* invalidate */
</script></body></html>`;
const cases: InteractionCase[] = [
  {
    name: '正常通过',
    requirement: '正常条件可通过',
    steps: [
      { action: 'click', selector: '#run' },
      { action: 'expect', selector: '#status', property: 'text', expected: 'GO' },
    ],
  },
  {
    name: '故障阻止通过',
    requirement: '故障必须 STOP',
    steps: [
      { action: 'select', selector: '#mode', value: 'bad' },
      { action: 'click', selector: '#run' },
      { action: 'expect', selector: '#status', property: 'text', expected: 'STOP' },
    ],
  },
  {
    name: '输入改变撤销旧结果',
    requirement: '上游修改后不能保留旧 GO',
    steps: [
      { action: 'click', selector: '#run' },
      { action: 'select', selector: '#mode', value: 'bad' },
      { action: 'expect', selector: '#status', property: 'text', expected: '待检查' },
    ],
  },
  {
    name: '重置',
    requirement: '重置清空结果恢复初始输入',
    steps: [
      { action: 'select', selector: '#mode', value: 'bad' },
      { action: 'click', selector: '#run' },
      { action: 'click', selector: '#reset' },
      { action: 'expect', selector: '#status', property: 'text', expected: '待检查' },
      { action: 'expect', selector: '#mode', property: 'value', expected: 'ok' },
    ],
  },
];

function state(html = brokenHtml) {
  let doc = {
    stage: { id: 'stage-test', name: 'test', createdAt: 1, updatedAt: 1 },
    scenes: [
      {
        id: 'scene-a',
        stageId: 'stage-test',
        title: '验收',
        order: 1,
        type: 'interactive',
        content: { type: 'interactive', html },
        actions: [],
      },
    ],
    outline: {},
  } as CourseDocument;
  const store = {
    loadDocument: vi.fn(async () => structuredClone(doc)),
    putScene: vi.fn(async (_id: string, scene: Scene) => {
      doc = { ...doc, scenes: [scene] };
    }),
  } as unknown as CourseStore;
  const deps = { store, stageAccess: vi.fn(async () => ({ kind: 'owned' as const })) };
  return {
    deps,
    get: () => doc,
    change: (html: string) => {
      doc.scenes[0].content = { type: 'interactive', html };
    },
  };
}
const passed: InteractionResult = { status: 'passed', cases: [], blockedRequests: [] };
const custom = (customType: string, data: unknown) =>
  ({ type: 'custom', customType, data }) as SessionTreeEntry;

describe('native interactive tool and checkpoint reuse', () => {
  it('checks ownership before reading content or launching Chrome', async () => {
    const s = state();
    const run = vi.fn<(...args: unknown[]) => Promise<InteractionResult>>(async () => passed);
    const checks = new InteractionChecks(
      { ...s.deps, stageAccess: async () => ({ kind: 'foreign' }) },
      run,
    );
    const result = await buildInteractionTool(checks).execute('read', {
      stageId: 'foreign',
      sceneId: 'scene-a',
    } as never);
    expect(result).toHaveProperty('isError', true);
    expect(s.deps.store.loadDocument).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('a page load or a click alone is not behavior acceptance', async () => {
    const s = state();
    const run = vi.fn<(...args: unknown[]) => Promise<InteractionResult>>(async () => passed);
    const checks = new InteractionChecks(s.deps, run);
    await checks.execute('stage-test', 'scene-a');
    expect((await checks.inspect(s.get())).issues[0]).toContain('尚无行为验收');
    await expect(
      checks.execute('stage-test', 'scene-a', [
        { ...cases[0], steps: [{ action: 'click', selector: '#run' }] },
      ]),
    ).rejects.toThrow('expect');
    expect(run).toHaveBeenCalledOnce();
  });

  it('reuses exact unchanged content across worker restart; edits automatically replay saved cases', async () => {
    const s = state();
    const entries: SessionTreeEntry[] = [];
    const run = vi.fn<(...args: unknown[]) => Promise<InteractionResult>>(async () => passed);
    const checks = new InteractionChecks(s.deps, run, async (receipt) => {
      entries.push(custom(INTERACTION_CHECKPOINT_TYPE, structuredClone(receipt)));
    });
    await checks.execute('stage-test', 'scene-a', cases);
    expect(entries).toHaveLength(2); // pending cases then durable result
    const resumed = new InteractionChecks(s.deps, run);
    expect(resumed.restore(entries)).toEqual(new Set(['stage-test']));
    expect(await resumed.inspect(s.get())).toEqual({ issues: [], unavailable: [], checked: 1 });
    expect(run).toHaveBeenCalledOnce();
    s.change(brokenHtml + '\n<!-- changed -->');
    await resumed.inspect(s.get());
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1][1]).toEqual(cases);
  });

  it('pending cases survive interruption and omitted cases survive later additions', async () => {
    const s = state();
    const entries: SessionTreeEntry[] = [];
    const failedRun = vi.fn(async () => {
      throw new Error('worker stopped');
    });
    const checks = new InteractionChecks(s.deps, failedRun, async (receipt) => {
      entries.push(custom(INTERACTION_CHECKPOINT_TYPE, structuredClone(receipt)));
    });
    await expect(checks.execute('stage-test', 'scene-a', cases.slice(0, 2))).rejects.toThrow(
      'worker stopped',
    );
    const run = vi.fn<(...args: unknown[]) => Promise<InteractionResult>>(async () => passed);
    const resumed = new InteractionChecks(s.deps, run);
    resumed.restore(entries);
    await resumed.execute('stage-test', 'scene-a', [cases[2]]);
    expect(run.mock.calls[0][1]).toEqual(cases.slice(0, 3));
  });

  it('requires source-grounded cases and refuses silent or unsupported weakening', async () => {
    const s = state();
    const brief = new CourseBriefState('正常条件可通过，显示 GO', async () => {});
    await brief.update({ expectedRevision: 0, throughSeq: 0, intent: 'create', goal: '检查条件',
      upserts: [{ id: 'r1', text: '显示 GO', sourceSeq: 0, quote: '显示 GO' }], remove: [] });
    const receipts: unknown[] = [];
    const run = vi.fn(async () => passed);
    const checks = new InteractionChecks({ ...s.deps, courseBrief: brief }, run, async receipt => { receipts.push(receipt); });
    await expect(checks.execute('stage-test', 'scene-a', [cases[0]])).rejects.toThrow('requirementId');
    const original = { ...cases[0], requirementId: 'r1' };
    await checks.execute('stage-test', 'scene-a', [original]);
    const corrected = { ...original, steps: original.steps.map(step => ({ ...step, selector: step.selector === '#status' ? '#result' : step.selector })) };
    await expect(checks.execute('stage-test', 'scene-a', [corrected])).rejects.toThrow('静默覆盖');
    await checks.execute('stage-test', 'scene-a', [corrected], undefined, [{ name: original.name, reason: '结果节点的真实 ID 为 result' }]);
    const changed = { ...corrected, steps: [{ action: 'click' as const, selector: '#run' }, { action: 'expect' as const, selector: '#result', property: 'text' as const, expected: 'OK' }] };
    await expect(checks.execute('stage-test', 'scene-a', [changed], undefined, [{ name: original.name, reason: '为了通过' }])).rejects.toThrow('用户要求');
    brief.addMessages([{ seq: 1, text: '把成功提示改成 OK' }]);
    await brief.update({ expectedRevision: 1, throughSeq: 1, intent: 'edit', goal: '修改提示',
      upserts: [{ id: 'r1', text: '显示 OK', sourceSeq: 1, quote: '改成 OK' }], remove: [] });
    await checks.execute('stage-test', 'scene-a', [changed], undefined, [{ name: original.name, reason: '教师修改成功提示', sourceSeq: 1, quote: '改成 OK' }]);
    expect(receipts).toHaveLength(6);
    expect(run).toHaveBeenCalledTimes(3);
    expect(receipts[4]).toMatchObject({ amendments: [{ quote: '改成 OK' }] });
  });

  it('restores untested changed pages after restart, without testing unrelated pages', async () => {
    const s = state();
    const checks = new InteractionChecks(s.deps, vi.fn());
    expect((await checks.inspect(s.get())).issues).toEqual([]);
    checks.restore([
      custom(COURSE_CHECKPOINT_TYPE, {
        tool: 'patch_stage',
        stageId: 'stage-test',
        sceneId: 'scene-a',
      }),
    ]);
    expect((await checks.inspect(s.get())).issues[0]).toContain('scene-a');
  });

  it('does not restore unavailable execution conditions as a passing cache', async () => {
    const s = state();
    const checks = new InteractionChecks(s.deps, async () => passed);
    checks.restore([
      custom(INTERACTION_CHECKPOINT_TYPE, {
        stageId: 'stage-test',
        sceneId: 'scene-a',
        html: brokenHtml,
        cases,
        result: { status: 'unavailable', cases: [], blockedRequests: [] },
      }),
    ]);
    expect((await checks.execute('stage-test', 'scene-a')).cached).toBe(false);
  });

  it('native session compaction preserves checkpoints without adding source/cases to model context', async () => {
    const repo = new InMemorySessionRepo();
    const session = await repo.create();
    await session.appendMessage({ role: 'user', content: '原始课程目标', timestamp: 1 });
    const s = state();
    const checks = new InteractionChecks(
      s.deps,
      async () => passed,
      async (receipt) => {
        await session.appendCustomEntry(INTERACTION_CHECKPOINT_TYPE, receipt);
      },
    );
    await checks.execute('stage-test', 'scene-a', cases);
    const tail = await session.appendMessage({ role: 'user', content: '继续', timestamp: 2 });
    await session.appendCompaction('课程任务仍在继续', tail, 100);
    const reopened = await repo.open(await session.getMetadata());
    const resumedRun = vi.fn(async () => passed);
    const resumed = new InteractionChecks(s.deps, resumedRun);
    resumed.restore(await reopened.getBranch());
    await resumed.inspect(s.get());
    expect(resumedRun).not.toHaveBeenCalled();
    const context = JSON.stringify(await reopened.buildContext());
    expect(context).not.toContain('/* invalidate */');
    expect(context).not.toContain('输入改变撤销旧结果');
    expect(context).toContain('继续');
  });
});

// Explicit opt-in: deterministic fixtures use installed Chrome, no live model or student data.
describe.skipIf(process.env.PRAXIS_TEST_BROWSER !== '1')(
  'real Chrome self-correction evidence',
  () => {
    it('reports an actual stale GO, patches through the existing tool, and automatically retests the same cases', async () => {
      const s = state();
      const run = vi.fn(runInteractionBrowser);
      const checks = new InteractionChecks(s.deps, run);
      const browserTool = buildInteractionTool(checks);
      const first = await browserTool.execute('test', {
        stageId: 'stage-test',
        sceneId: 'scene-a',
        cases,
      } as never);
      expect(first).toHaveProperty('isError', true);
      expect(JSON.stringify(first.content)).toContain('实际');
      const report = JSON.parse((first.content[0] as { text: string }).text);
      expect(report.status).toBe('failed');
      expect(
        report.cases.map((c: { passed: boolean }) => c.passed),
        JSON.stringify(report),
      ).toEqual([true, true, false, true]);
      expect(report.cases[2].checks[0]).toMatchObject({ expected: '待检查', actual: 'GO' });
      const patch = buildDslCourseTools({
        ...s.deps,
        onCheckpoint: (info) => checks.markChanged(info),
      }).find((tool) => tool.name === 'patch_stage')!;
      // Only the agent.prompt boundary is stubbed; browser and persisted patch tools are real.
      const prompt = vi.fn(async (text: string) => {
        expect(text).toContain('输入改变撤销旧结果');
        const result = await patch.execute('repair', {
          stageId: 'stage-test',
          target: '/scenes/1',
          intent: '变更输入撤销旧 GO',
          ops: [
            {
              op: 'str_replace',
              path: '/content/html',
              oldText: '/* invalidate */',
              newText: "mode.onchange = () => { status.textContent = '待检查'; };",
            },
          ],
        } as never);
        expect(result).not.toHaveProperty('isError', true);
      });
      await completeCourseRepairs({
        inspect: async () => [{ stageId: 'stage-test', ...(await checks.inspect(s.get())) }],
        prompt,
        stopped: () => false,
      });
      expect(prompt).toHaveBeenCalledOnce();
      expect(run).toHaveBeenCalledTimes(2);
      expect((await checks.execute('stage-test', 'scene-a')).status).toBe('passed');
      expect(run).toHaveBeenCalledTimes(2);
      expect(s.deps.store.putScene).toHaveBeenCalledOnce();
    }, 45_000);

    it('surfaces runtime errors even when the visible assertion passes', async () => {
      const html = '<button id="run" onclick="throw new Error(\'broken-handler\')">运行</button>';
      const result = await runInteractionBrowser(html, [
        {
          name: '运行',
          requirement: '点击不应抛错',
          steps: [
            { action: 'click', selector: '#run' },
            { action: 'expect', selector: '#run', property: 'visible', expected: true },
          ],
        },
      ]);
      expect(result.status).toBe('failed');
      expect(result.cases[0].runtimeErrors.join(' ')).toContain('broken-handler');
    }, 15_000);

    it('does not submit classroom records or mix local storage between cases', async () => {
      const html = `<button id="run" onclick="localStorage.setItem('x','changed');fetch('http://127.0.0.1:3000/api/platform/test-result',{method:'POST',body:'{}'}).catch(()=>{})">运行</button><output id="value"></output><script>document.querySelector('#value').textContent = localStorage.getItem('x') || 'clean';</script>`;
      const result = await runInteractionBrowser(html, [
        {
          name: '尝试提交',
          requirement: '测试不得写入课堂',
          steps: [
            { action: 'click', selector: '#run' },
            { action: 'expect', selector: '#value', property: 'text', expected: 'clean' },
          ],
        },
        {
          name: '下一用例',
          requirement: '每个用例状态独立',
          steps: [{ action: 'expect', selector: '#value', property: 'text', expected: 'clean' }],
        },
      ]);
      expect(result.blockedRequests).toContain('http://127.0.0.1:3000/api/platform/test-result');
      expect(result.status).toBe('unavailable');
      expect(result.cases[1].passed, JSON.stringify(result)).toBe(true);
    }, 15_000);
  },
);
