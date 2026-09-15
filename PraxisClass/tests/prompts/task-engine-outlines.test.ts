import { expect, test } from 'vitest';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';

test('the assembled vocational prompt preserves contracts without reintroducing a preset course', () => {
  const prompt = buildPrompt(PROMPT_IDS.TASK_ENGINE_OUTLINES, {
    requirement: '为护理学生讲解交接班沟通，使用两页讲解和一次情境讨论。',
    pdfContent: '交接记录 §2：说明观察、处理与待办事项。',
    availableImages: 'No images available', researchContext: 'None', teacherContext: '', userProfile: '',
  });
  expect(prompt).not.toBeNull();
  const text = `${prompt!.system}\n${prompt!.user}`;
  expect(text).toContain('为护理学生讲解交接班沟通');
  expect(text).toContain('交接记录 §2');
  expect(text).toContain('successCriteria');
  expect(text).toContain('errorConsequences');
  expect(text).toContain('playable payload');
  expect(text).toContain('16:9');
  expect(text).toMatch(/do not invent/i);
  expect(text).toMatch(/optional/i);
  expect(text).not.toMatch(/10-14 scenes|at least 10|3-6 practice scenes|1 final `pbl`|first scene must be|exactly 3 stable information cards|Never provide fewer than 4/);
  expect(text).not.toContain('{{');
});

test('unsuitable topics may use ordinary explanations rather than fabricated workplace procedures', () => {
  const prompt = buildPrompt(PROMPT_IDS.TASK_ENGINE_OUTLINES, {
    requirement: '讲解勾股定理', pdfContent: '', availableImages: '', researchContext: '', teacherContext: '', userProfile: '',
  })!;
  expect(prompt.system).toMatch(/Pythagorean theorem/);
  expect(prompt.user).toMatch(/standard outline/);
  expect(prompt.system).toMatch(/concepts|concept explanations/i);
});
