/**
 * PBL v2 — Evaluation helpers.
 *
 * Evaluation records produced by `record_closing_check` (task-level)
 * and by the standalone evaluator runs (milestone / final, PR 6 / 7).
 * PR 3 only needs the helper to write a task-level evaluation when
 * `advance_micro_task` is called; richer evaluations come in
 * later PRs.
 */

import type {
  PBLEvaluation,
  PBLEvaluationKind,
  PBLProjectV2,
  PBLScenarioActGoals,
} from '../../types';
import { mirrorTestResult } from '@/lib/platform/mirror/client';
import { getLearnerKey } from '@/lib/runtime/learner-key';
import {
  appendRuntimeEvent,
  milestoneIdForMicrotask,
  mintRuntimeEventId,
} from '../kernel/runtime-events';

function newId(prefix: string): string {
  return (
    prefix + '_' + Math.random().toString(16).slice(2, 8) + Math.random().toString(16).slice(2, 8)
  );
}

function mirrorEvaluation(project: PBLProjectV2, evaluation: PBLEvaluation): void {
  if (typeof window === 'undefined') return;
  const embeddedStageId = (project as PBLProjectV2 & { stageId?: unknown }).stageId;
  const routeMatch = /^\/classroom\/([^/]+)/.exec(window.location?.pathname ?? '');
  const stageId =
    typeof embeddedStageId === 'string' && embeddedStageId
      ? embeddedStageId
      : routeMatch?.[1]
        ? decodeURIComponent(routeMatch[1])
        : null;
  if (!stageId) return;
  const embeddedLearnerKey = (project as PBLProjectV2 & { learnerKey?: unknown }).learnerKey;
  const normalizedScore =
    typeof evaluation.score === 'number' && Number.isFinite(evaluation.score)
      ? Math.max(0, Math.min(1, evaluation.score / 100))
      : typeof evaluation.stars === 'number' && Number.isFinite(evaluation.stars)
        ? Math.max(0, Math.min(1, evaluation.stars / 5))
        : null;
  // Narrative feedback remains saved, but it is not a numeric pass or full score.
  if (normalizedScore === null) return;
  const learnerKey =
    typeof embeddedLearnerKey === 'string' && embeddedLearnerKey
      ? Promise.resolve(embeddedLearnerKey)
      : getLearnerKey();
  void learnerKey
    .then((resolvedLearnerKey) => {
      mirrorTestResult({
        suite: 'pbl_microtask',
        caseId: evaluation.microtaskId ?? evaluation.milestoneId ?? 'final',
        stageId,
        learnerKey: resolvedLearnerKey,
        attemptId: evaluation.id,
        passed: normalizedScore >= 0.6,
        score: normalizedScore,
      });
    })
    .catch(() => undefined);
}

export function addEvaluation(
  project: PBLProjectV2,
  args: {
    kind: PBLEvaluationKind;
    microtaskId?: string;
    milestoneId?: string;
    feedback: string;
    strengths?: string[];
    improvements?: string[];
    score?: number;
    stars?: number;
    whatYouBuilt?: string[];
    whatYouLearned?: string[];
    whatsNext?: string;
    actGoals?: PBLScenarioActGoals[];
  },
): PBLEvaluation {
  const evaluation: PBLEvaluation = {
    id: newId('eval'),
    kind: args.kind,
    microtaskId: args.microtaskId,
    milestoneId: args.milestoneId,
    feedback: args.feedback,
    strengths: args.strengths ?? [],
    improvements: args.improvements ?? [],
    score: args.score,
    stars: args.stars,
    whatYouBuilt: args.whatYouBuilt,
    whatYouLearned: args.whatYouLearned,
    whatsNext: args.whatsNext,
    actGoals: args.actGoals,
    createdAt: new Date().toISOString(),
  };
  project.evaluations.push(evaluation);
  appendRuntimeEvent(project, {
    id: mintRuntimeEventId(),
    kind: 'evaluation_created',
    actorType: 'system',
    evaluationId: evaluation.id,
    ts: evaluation.createdAt,
    microtaskId: evaluation.microtaskId,
    milestoneId: evaluation.milestoneId ?? milestoneIdForMicrotask(project, evaluation.microtaskId),
  });
  mirrorEvaluation(project, evaluation);
  project.updatedAt = evaluation.createdAt;
  return evaluation;
}

export function listEvaluationsForMicrotask(
  project: PBLProjectV2,
  microtaskId: string,
): PBLEvaluation[] {
  return project.evaluations.filter((e) => e.microtaskId === microtaskId);
}

export function listEvaluationsForMilestone(
  project: PBLProjectV2,
  milestoneId: string,
): PBLEvaluation[] {
  return project.evaluations.filter((e) => e.milestoneId === milestoneId);
}
