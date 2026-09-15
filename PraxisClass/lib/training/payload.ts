import { z } from 'zod';
import type { RuntimePayloadValidator } from '@praxis/storage';
import {
  assessmentSchema,
  evidenceInputSchema,
  planSchema,
  trainingId,
} from '@/lib/platform/training/contracts';

export const submissionSchema = evidenceInputSchema
  .extend({
    type: z.literal('submission'),
    payloadVersion: z.literal(1),
    recordKind: z.enum(['learning', 'demo']),
    origin: z.literal('live_submission'),
    contextSnapshot: planSchema,
    submittedAt: z.iso.datetime(),
  })
  .strict();
export const explanationSchema = z
  .object({
    type: z.literal('explanation'),
    payloadVersion: z.literal(1),
    evidenceId: trainingId,
    evaluationId: trainingId,
    assessmentRecordId: trainingId,
    content: z.string().min(1).max(16000),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const trainingPayloadSchema = z.discriminatedUnion('type', [
  submissionSchema,
  assessmentSchema,
  explanationSchema,
]);
export type Submission = z.infer<typeof submissionSchema>;
export type TrainingPayload = z.infer<typeof trainingPayloadSchema>;
export const trainingEvidenceValidator: RuntimePayloadValidator = (payload) => {
  const result = trainingPayloadSchema.safeParse(payload);
  return result.success
    ? { valid: true }
    : {
        valid: false,
        errors: result.error.issues.map((issue) => ({
          path: `/payload/${issue.path.join('/')}`,
          message: issue.message,
        })),
      };
};
