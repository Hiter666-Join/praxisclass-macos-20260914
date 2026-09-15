import type { RuntimeStore } from '@praxis/storage';
import type { TeachingPlan, EvidenceInput } from '@/lib/platform/training/contracts';
import type { EvidenceRow } from '@/lib/platform/training/dao';
import { TrainingError } from '@/lib/platform/training/errors';
import { ensureTrainingSession, appendImmutableRuntimeFact } from './runtime';

export function validateQuestionAnswers(
  output: TeachingPlan['outputs'][number],
  content: EvidenceInput['submittedContent'],
) {
  if (!output.questions) return;
  const questions = new Map(output.questions.map((question) => [question.id, question]));
  for (const key of Object.keys(content)) {
    const question = questions.get(key);
    const value = content[key];
    const valid =
      question &&
      (question.type === 'short_answer'
        ? typeof value === 'string'
        : Array.isArray(value) &&
          value.every(
            (item) =>
              typeof item === 'string' && question.options?.some((option) => option.value === item),
          ) &&
          new Set(value).size === value.length &&
          (question.type !== 'single' || value.length === 1));
    if (!valid)
      throw new TrainingError(
        422,
        'INVALID_ANSWER',
        '作答与开始时的题目选项不一致，请核对当前活动。',
      );
  }
  if (
    output.requiredParts.some((key) => {
      const value = content[key];
      return typeof value === 'string'
        ? !value.trim()
        : !Array.isArray(value) || value.length === 0;
    })
  )
    throw new TrainingError(
      422,
      'INCOMPLETE_ANSWER',
      '请先填写全部必需部分；尚未完成的内容可保留为草稿。',
    );
}

export function questionRecordRef(evidenceId: string) {
  return { sessionId: `quiz-evidence:${evidenceId}`, recordId: `quiz-submit:${evidenceId}` };
}

/** The quizAttempt record is the original; the evidence references the same submitted answers. */
export async function saveQuestionOriginal(
  store: RuntimeStore,
  row: EvidenceRow,
  content: EvidenceInput['submittedContent'],
) {
  const ref = questionRecordRef(row.evidence_id);
  const nativeRow = { ...row, runtime_session_id: ref.sessionId };
  await ensureTrainingSession(store, nativeRow, 'quizAttempt');
  await appendImmutableRuntimeFact(
    store,
    nativeRow,
    ref.recordId,
    { payloadVersion: 1, phase: 'submitted', answers: content },
    new Date(row.created_at).toISOString(),
  );
}
