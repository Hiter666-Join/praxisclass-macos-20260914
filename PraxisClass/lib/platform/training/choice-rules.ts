import { gradeChoiceQuestions } from '@/lib/quiz/grading';
import type { TeachingPlan, EvidenceInput } from './contracts';
import { canonical } from './contracts';
import { MAIN_QUESTIONS_A, MAIN_QUESTIONS_B } from '@/lib/training/main-case';

// Teacher-reviewed Q-MAIN 1.0 answer keys stay in this server service module.
const RULES: Record<string, { questionId: string; answer: string[]; basis: string }> = {
  'main-a-c1-v1': {
    questionId: 'A-C1',
    answer: ['A1-O1'],
    basis:
      '接口契约要求 productId、productVersion、question 为非空字符串；JSON 属性顺序不影响判断。',
  },
  'main-a-c2-v1': {
    questionId: 'A-C2',
    answer: ['A2-O1', 'A2-O2'],
    basis: '页面问题进入请求的 question，再对应后端接收对象；请求与响应的数据方向分别核对。',
  },
  'main-a-c3-v1': {
    questionId: 'A-C3',
    answer: ['A3-O1', 'A3-O2', 'A3-O4'],
    basis: 'answer 展示处理说明，sources 展示实际引用；HTTP 200 不表示资料一定充分。',
  },
  'main-b-flow-v1': {
    questionId: 'B-C1',
    answer: ['P1', 'P2'],
    basis: '适用性筛选可在检索前或后；回答前必须核验支撑关系，资料不足时不能补写产品功能。',
  },
};

export function hasChoiceRule(id: string) {
  return Object.hasOwn(RULES, id);
}

export function isChoiceRuleCompatible(id: string, outputs: TeachingPlan['outputs']) {
  const rule = RULES[id];
  if (!rule) return false;
  const expected = [...MAIN_QUESTIONS_A, ...MAIN_QUESTIONS_B].find(
    (question) => question.id === rule.questionId,
  );
  return outputs.some((output) =>
    output.questions?.some(
      (question) => question.id === rule.questionId && canonical(question) === canonical(expected),
    ),
  );
}

export function evaluateChoiceRule(
  id: string,
  output: TeachingPlan['outputs'][number],
  content: EvidenceInput['submittedContent'],
) {
  const rule = RULES[id];
  const question = rule && output.questions?.find((item) => item.id === rule.questionId);
  const answer = rule && content[rule.questionId];
  if (!question || !Array.isArray(answer) || !answer.every((item) => typeof item === 'string'))
    return null;
  const expected = [...MAIN_QUESTIONS_A, ...MAIN_QUESTIONS_B].find(
    (item) => item.id === rule.questionId,
  );
  if (canonical(question) !== canonical(expected)) return null;
  const [result] = gradeChoiceQuestions([{ ...question, answer: rule.answer }], {
    [rule.questionId]: answer as string[],
  });
  return { status: result.correct ? ('passed' as const) : ('failed' as const), basis: rule.basis };
}
