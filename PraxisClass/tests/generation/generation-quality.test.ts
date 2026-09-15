import { afterEach, describe, expect, test, vi } from 'vitest';
import { checkInteractiveScripts, GenerationQualityError, repairInteractiveContent } from '@/lib/server/generation-content-quality';
import { checkGenerationPlan, reviewGenerationPlan } from '@/lib/server/generation-plan-review';
import { withGenerationRequirements } from '@/lib/server/generation-request-context';
import type { SceneOutline } from '@/lib/types/generation';

const outline: SceneOutline = { id: 'p1', order: 1, title: '接口验收', type: 'interactive', description: '检查状态码', keyPoints: [], widgetType: 'code', widgetOutline: { language: 'java' } };
afterEach(() => vi.unstubAllEnvs());

describe('generation goals and targeted repair', () => {
  test('keeps the full original request ahead of changing page details without adding another caller data', () => {
    const request = { requirement: 'Java 接口验收；必须包含空列表和 null；请保留完整验收记录。' };
    const first = withGenerationRequirements('PAGE A', request);
    const second = withGenerationRequirements('PAGE B', request);
    expect(first).toContain(request.requirement);
    expect(first.slice(0, first.indexOf('PAGE A'))).toBe(second.slice(0, second.indexOf('PAGE B')));
    expect(withGenerationRequirements('PAGE B', { requirement: 'Python 文件操作' })).not.toContain('Java 接口验收');
  });

  test('catches the observed broken comment and regex; compiles without running page code', () => {
    expect(checkInteractiveScripts('<script>const s={x:null, // true |\n false | null\n y:null};</script>')[0]).toContain('Unexpected token');
    expect(checkInteractiveScripts('<script>const pattern=/(ResponseEntity\\(/;</script>')[0]).toContain('regular expression');
    const located = checkInteractiveScripts('<h1>Title</h1>\n<script>\nconst ok = 1;\nconst broken = ;\n</script>')[0];
    expect(located).toContain('script 1 line 3 (HTML line 4)');
    expect(located).toContain('3: const broken = ;');
    expect(checkInteractiveScripts('<script type="application/json">{"x":1}</script><script>throw new Error("must never run")</script>')).toEqual([]);
  });

  test('a valid interactive page causes zero extra LLM calls', async () => {
    const call = vi.fn();
    const content = { html: '<h1>用户指定交付物</h1><script>const ready=true;</script>', widgetType: 'code' as const };
    expect(await repairInteractiveContent(content, outline, call)).toBe(content);
    expect(call).not.toHaveBeenCalled();
  });

  test('repairs only the failed fragment, preserving the requested teaching content', async () => {
    const content = { html: '<h1>Java null 与空列表验收记录</h1><script>const x = ;</script>', widgetType: 'code' as const };
    const call = vi.fn<(...args: unknown[]) => Promise<string>>(async () => JSON.stringify({ edits: [{ before: 'const x = ;', after: 'const x = null;' }] }));
    const result = await repairInteractiveContent(content, outline, call, { requirement: '必须包含 Java null 与空列表验收记录' });
    expect(result.html).toContain('<h1>Java null 与空列表验收记录</h1>');
    expect(checkInteractiveScripts(result.html)).toEqual([]);
    expect(call).toHaveBeenCalledOnce();
    expect(call.mock.calls[0]?.[1]).toContain('必须包含 Java null 与空列表验收记录');
    expect(content.html).toContain('const x = ;');
  });

  test('does not treat a still broken repair as complete or retry the whole page', async () => {
    const call = vi.fn(async () => JSON.stringify({ edits: [{ before: 'const x = ;', after: 'const x = /(/;' }] }));
    await expect(repairInteractiveContent({ html: '<script>const x = ;</script>' }, outline, call)).rejects.toBeInstanceOf(GenerationQualityError);
    expect(call).toHaveBeenCalledOnce();
  });

  test('finds native structure and common-field omissions before content generation', () => {
    vi.stubEnv('PRAXIS_ENABLE_VOCATIONAL', 'true');
    const issues = checkGenerationPlan([outline], { requirement: '职业接口实训', taskEngineMode: true });
    expect(issues.some(issue => issue.includes('task'))).toBe(true);
    expect(issues.some(issue => issue.includes('三个'))).toBe(false);
  });

  test('accepts a short vocational course and explanation-heavy courses without extra activity quotas', () => {
    vi.stubEnv('PRAXIS_ENABLE_VOCATIONAL', 'true');
    const practice = { ...outline, widgetOutline: { task: '检查状态码', steps: ['观察响应'], successCriteria: ['正确解释状态'] } };
    expect(checkGenerationPlan([practice], { requirement: '一次接口练习', taskEngineMode: true })).toEqual([]);
    const explanations = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, order: i + 1, title: `概念 ${i}`, type: 'slide' as const, description: '理解关键概念', keyPoints: ['概念与实例'] }));
    expect(checkGenerationPlan(explanations, { requirement: '四页概念讲解', taskEngineMode: true })).toEqual([]);
  });

  test('valid plans do not spend a reviewer call or claim semantic coverage', async () => {
    const pages = [outline, { ...outline, id: 'p2', order: 2, title: '验收记录' }];
    const request = { requirement: '使用 Java。必须包含 null 情况的验收记录。' };
    const call = vi.fn(async () => JSON.stringify({ requirements: [{ quote: '使用 Java', sceneIds: ['p1'] }, { quote: '必须包含 null 情况的验收记录', sceneIds: ['p2'] }], updates: [{ id: 'p2', keyPoints: ['null 情况的实测结果、原因和验收结论'] }], additions: [], unresolved: [] }));
    const reviewed = await reviewGenerationPlan(pages, request, call);
    expect(reviewed.outlines[0]).toEqual(pages[0]);
    expect(reviewed.outlines[1]?.keyPoints).toEqual([]);
    expect(pages[1]?.keyPoints).toEqual([]);
    expect(reviewed.changedPages).toBe(0);
    expect(reviewed.coverage).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });

  test('rejects invented requirement coverage instead of reporting successful completion', async () => {
    const call = vi.fn(async () => JSON.stringify({ requirements: [{ quote: '用户并没有说的话', sceneIds: ['p1'] }], updates: [], additions: [] }));
    await expect(reviewGenerationPlan([{ ...outline, title: '' }], { requirement: 'Java 实训' }, call)).rejects.toThrow('无来源的要求');
  });
});
