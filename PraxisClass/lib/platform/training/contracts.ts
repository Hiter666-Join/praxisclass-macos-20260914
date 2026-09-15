import { z } from 'zod';

export const trainingId = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[\w:.-]+$/);
const text = z.string().max(12000);
export const activitySchema = z
  .object({
    stageId: trainingId,
    sceneId: trainingId,
    questionId: trainingId.optional(),
    microtaskId: trainingId.optional(),
    purpose: text,
    outputGroupId: trainingId,
    checkRefs: z.array(trainingId).max(80),
    contentRevision: z.string().min(1).max(120),
    required: z.boolean(),
  })
  .strict();
export const sourceSchema = z
  .object({
    sourceId: trainingId,
    kind: z.enum(['upload', 'dify']),
    title: text,
    materialRef: z.string().min(1).max(500),
    locator: text,
    excerpt: text,
    basisType: z.enum(['professional', 'technical', 'teaching']),
    studentVisible: z.boolean(),
  })
  .strict();
export const checkSchema = z
  .object({
    id: trainingId,
    revision: z.number().int().positive(),
    criterion: text,
    required: z.boolean(),
    appliesWhen: z.enum(['always']),
    evaluator: z.enum(['rule', 'ai', 'human']),
    ruleId: trainingId.optional(),
    sourceRefs: z.array(trainingId).max(80),
  })
  .strict();
export const outputSchema = z
  .object({
    id: trainingId,
    title: text,
    requiredParts: z.array(z.string().min(1).max(200)).max(30),
    activityRefs: z.array(trainingId).max(100),
    checkRefs: z.array(trainingId).max(80),
    interaction: z.enum(['ai-code', 'retry', 'vision', 'warehouse']).optional(),
    questions: z
      .array(
        z
          .object({
            id: trainingId,
            type: z.enum(['single', 'multiple', 'short_answer']),
            question: text,
            options: z
              .array(z.object({ value: trainingId, label: text }).strict())
              .max(30)
              .optional(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict();
export const planSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().min(1).max(200),
    professionalGroup: text,
    occupation: text,
    jobTask: text,
    learnerProfile: text,
    learningGoals: z.array(text).max(30),
    sources: z.array(sourceSchema).max(100),
    competencies: z
      .array(
        z
          .object({
            id: trainingId,
            name: text,
            description: text,
            checkIds: z.array(trainingId).max(80),
          })
          .strict(),
      )
      .max(30),
    checks: z.array(checkSchema).max(80),
    outputs: z.array(outputSchema).max(10),
    activities: z.array(activitySchema).max(100),
    supportNotes: text,
    orderedActivityRefs: z.array(trainingId).max(100),
    changeReason: text,
    basedOnEvidenceIds: z.array(trainingId).max(100),
  })
  .strict();
export type TeachingPlan = z.infer<typeof planSchema>;
export const createTaskSchema = z.object({ requestId: trainingId, content: planSchema }).strict();
export const saveDraftSchema = z
  .object({
    requestId: trainingId,
    expectedDraftSeq: z.number().int().nonnegative(),
    baseRevision: z.number().int().nonnegative(),
    content: planSchema,
  })
  .strict();
export const applyTaskSchema = z
  .object({
    requestId: trainingId,
    expectedDraftSeq: z.number().int().nonnegative(),
    expectedActiveRevision: z.number().int().nonnegative(),
  })
  .strict();
export const sourceRecordRefSchema = z
  .object({
    sessionId: trainingId,
    recordId: trainingId,
  })
  .strict();
export const evidenceInputSchema = z
  .object({
    evidenceId: trainingId,
    taskId: trainingId,
    planRevision: z.number().int().positive(),
    outputGroupId: trainingId,
    stageId: trainingId,
    sceneId: trainingId,
    nativeAttemptId: trainingId,
    sourceRecordRefs: z.array(sourceRecordRefSchema).max(30),
    submittedContent: z.record(z.string().max(200), z.json()),
    supersedesEvidenceId: trainingId.optional(),
  })
  .strict();
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
export const processingSchema = z
  .object({
    saved: z.enum(['none', 'server']),
    assessment: z.enum(['not_started', 'partial', 'ready', 'failed']),
    explanation: z.enum(['not_requested', 'pending', 'ready', 'failed']),
    index: z.enum(['pending', 'ready', 'failed']),
  })
  .strict();
export type Processing = z.infer<typeof processingSchema>;
export const EMPTY_PROCESSING: Processing = {
  saved: 'none',
  assessment: 'not_started',
  explanation: 'not_requested',
  index: 'pending',
};
export const competencyStatusSchema = z.enum(['unassessed', 'pending', 'needs_work', 'achieved']);
export const checkResultSchema = z
  .object({
    checkId: trainingId,
    checkRevision: z.number().int().positive(),
    status: z.enum(['passed', 'failed', 'unknown', 'not_applicable']),
    method: z.enum(['rule', 'ai', 'human']),
    basis: text,
  })
  .strict();
export const assessmentSchema = z
  .object({
    type: z.literal('assessment'),
    payloadVersion: z.literal(1),
    evidenceId: trainingId,
    evaluationId: trainingId,
    assessmentRevision: z.number().int().positive(),
    checkResults: z.array(checkResultSchema).max(80),
    competencyResults: z.array(
      z.object({ competencyId: trainingId, status: competencyStatusSchema }).strict(),
    ),
    basisRefs: z.array(trainingId),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type Assessment = z.infer<typeof assessmentSchema>;

/** Key order is irrelevant to retries; original text/array order is significant. No digest needed. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row)
      .filter((key) => row[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function studentPlan(plan: TeachingPlan): TeachingPlan {
  const sources = plan.sources.filter((source) => source.studentVisible);
  const ids = new Set(sources.map((source) => source.sourceId));
  return {
    ...plan,
    sources,
    learnerProfile: '',
    changeReason: '',
    basedOnEvidenceIds: [],
    checks: plan.checks.map((check) => ({
      ...check,
      sourceRefs: check.sourceRefs.filter((id) => ids.has(id)),
    })),
  };
}
