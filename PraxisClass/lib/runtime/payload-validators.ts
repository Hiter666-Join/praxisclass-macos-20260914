import { isChatMessageSkeleton, isQuizAttemptSkeleton } from '@praxis/dsl';
import type { RuntimePayloadValidator } from '@praxis/storage';

import { whiteboardRuntimePayloadValidator } from '@/lib/whiteboard/runtime/validate';
import { trainingEvidenceValidator } from '@/lib/training/payload';

const chat: RuntimePayloadValidator = (payload) =>
  isChatMessageSkeleton(payload)
    ? { valid: true }
    : {
        valid: false,
        errors: [
          {
            path: '/payload',
            message: 'chat payload must match ChatMessageSkeleton (role + content)',
          },
        ],
      };

const quizAttempt: RuntimePayloadValidator = (payload) =>
  isQuizAttemptSkeleton(payload)
    ? { valid: true }
    : {
        valid: false,
        errors: [
          {
            path: '/payload',
            message: 'quizAttempt payload must match QuizAttemptSkeleton (phase + answers)',
          },
        ],
      };

/** Complete app validator table. RuntimeStore options replace their defaults. */
export const APP_RUNTIME_PAYLOAD_VALIDATORS = Object.freeze({
  chat,
  quizAttempt,
  whiteboard: whiteboardRuntimePayloadValidator,
  trainingEvidence: trainingEvidenceValidator,
}) satisfies Readonly<Record<string, RuntimePayloadValidator>>;
