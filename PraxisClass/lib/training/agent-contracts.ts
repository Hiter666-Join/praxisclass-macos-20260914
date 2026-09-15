import { z } from 'zod';
import { trainingId } from '@/lib/platform/training/contracts';

export const teachingSuggestionSchema = z
  .object({
    learnerProfile: z.string().max(12000).optional(),
    supportAddition: z.string().min(1).max(6000),
    changeReason: z.string().min(1).max(12000),
    basedOnEvidenceIds: z.array(trainingId).max(20),
  })
  .strict();
export type TeachingSuggestion = z.infer<typeof teachingSuggestionSchema>;
export const trainingAgentInputSchema = z
  .object({
    conversationId: z.uuid(),
    requestId: z.uuid(),
    planRevision: z.number().int().positive(),
    intent: z.enum(['help', 'assess']),
    message: z.string().trim().min(1).max(4000),
    outputGroupId: trainingId.optional(),
    evidenceId: trainingId.optional(),
    currentInput: z.record(z.string().max(200), z.json()).optional(),
    serviceSettings: z.unknown(),
  })
  .strict();
export type TrainingAgentInput = z.infer<typeof trainingAgentInputSchema>;
export type TrainingAgentReply = {
  requestId: string;
  content: string;
  sourceRefs: { sourceId: string; title: string; locator: string }[];
  suggestion?: TeachingSuggestion;
  assessmentSaved?: boolean;
  recordRef: { sessionId: string; recordId: string };
};
