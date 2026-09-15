import { randomUUID } from 'node:crypto';
import { getPlatformClient, type SqliteDatabase } from '@/lib/platform/db/client';
import {
  canonical,
  EMPTY_PROCESSING,
  type TeachingPlan,
  type EvidenceInput,
  type Processing,
} from './contracts';
import { TrainingError, conflict, notFound } from './errors';

export interface TaskRow {
  id: string;
  owner_id: string;
  create_request_id: string;
  create_content_json: string;
  active_revision: number;
  draft_json: string;
  draft_seq: number;
  draft_receipts_json: string;
  created_at: number;
  updated_at: number;
}
export interface RevisionRow {
  task_id: string;
  revision: number;
  schema_version: number;
  content_json: string;
  applied_from_draft_seq: number;
  apply_request_id: string;
  expected_active_revision: number;
  created_at: number;
}
export interface EvidenceRow {
  evidence_id: string;
  task_id: string;
  plan_revision: number;
  output_group_id: string;
  stage_id: string;
  scene_id: string;
  learner_key: string;
  record_kind: 'demo' | 'learning';
  origin: 'live_submission';
  native_attempt_id: string;
  source_record_refs: string;
  runtime_session_id: string;
  submission_record_id: string;
  latest_assessment_ref: string | null;
  processing_json: string;
  summary_json: string;
  supersedes_id: string | null;
  created_at: number;
  updated_at: number;
}

export class TrainingDao {
  constructor(readonly db: SqliteDatabase) {}
  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  task(id: string): TaskRow {
    return (
      (this.db.prepare('SELECT * FROM teaching_tasks WHERE id = ?').get(id) as TaskRow) ||
      notFound()
    );
  }
  ownedTask(id: string, ownerId: string): TaskRow {
    const task = this.task(id);
    if (task.owner_id !== ownerId) notFound();
    return task;
  }
  revision(id: string, revision: number): RevisionRow {
    return (
      (this.db
        .prepare('SELECT * FROM teaching_task_revisions WHERE task_id = ? AND revision = ?')
        .get(id, revision) as RevisionRow) || notFound()
    );
  }
  listTasks(ownerId?: string, stageId?: string): TaskRow[] {
    // json_each confines the course query in SQLite rather than scanning student records.
    return this.db
      .prepare(
        `SELECT t.* FROM teaching_tasks t
      WHERE (? IS NULL OR owner_id = ?) AND (? IS NOT NULL OR active_revision > 0)
      AND (? IS NULL OR (? IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(t.draft_json, '$.activities') a
        WHERE json_extract(a.value, '$.stageId') = ?))
        OR EXISTS (SELECT 1 FROM teaching_task_revisions r, json_each(r.content_json, '$.activities') a
          WHERE r.task_id = t.id AND r.revision = t.active_revision AND json_extract(a.value, '$.stageId') = ?))
      ORDER BY updated_at DESC LIMIT 100`,
      )
      .all(
        ownerId ?? null,
        ownerId ?? null,
        ownerId ?? null,
        stageId ?? null,
        ownerId ?? null,
        stageId ?? null,
        stageId ?? null,
      ) as TaskRow[];
  }
  create(ownerId: string, requestId: string, content: TeachingPlan): TaskRow {
    return this.transaction(() => {
      const encoded = canonical(content);
      const existing = this.db
        .prepare('SELECT * FROM teaching_tasks WHERE owner_id = ? AND create_request_id = ?')
        .get(ownerId, requestId) as TaskRow | undefined;
      if (existing) {
        if (existing.create_content_json !== encoded) conflict('同一创建请求携带了不同内容。');
        return existing;
      }
      const id = randomUUID();
      const now = Date.now();
      this.db
        .prepare(
          `INSERT INTO teaching_tasks
        (id, owner_id, create_request_id, create_content_json, draft_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, ownerId, requestId, encoded, encoded, now, now);
      return this.task(id);
    });
  }
  saveDraft(
    id: string,
    ownerId: string,
    input: {
      requestId: string;
      expectedDraftSeq: number;
      baseRevision: number;
      content: TeachingPlan;
    },
  ): { draftSeq: number } {
    return this.transaction(() => {
      const task = this.ownedTask(id, ownerId);
      const receipts = JSON.parse(task.draft_receipts_json) as Record<
        string,
        { input: string; draftSeq: number }
      >;
      const previous = receipts[input.requestId];
      const encoded = canonical(input);
      if (previous) {
        if (previous.input !== encoded) conflict();
        return { draftSeq: previous.draftSeq };
      }
      if (task.draft_seq !== input.expectedDraftSeq || task.active_revision !== input.baseRevision)
        conflict();
      const draftSeq = task.draft_seq + 1;
      receipts[input.requestId] = { input: encoded, draftSeq };
      this.db
        .prepare(
          'UPDATE teaching_tasks SET draft_json = ?, draft_seq = ?, draft_receipts_json = ?, updated_at = ? WHERE id = ?',
        )
        .run(canonical(input.content), draftSeq, JSON.stringify(receipts), Date.now(), id);
      return { draftSeq };
    });
  }
  appliedRequest(
    id: string,
    input: { requestId: string; expectedDraftSeq: number; expectedActiveRevision: number },
  ): RevisionRow | undefined {
    const previous = this.db
      .prepare('SELECT * FROM teaching_task_revisions WHERE task_id = ? AND apply_request_id = ?')
      .get(id, input.requestId) as RevisionRow | undefined;
    if (
      previous &&
      (previous.applied_from_draft_seq !== input.expectedDraftSeq ||
        previous.expected_active_revision !== input.expectedActiveRevision)
    )
      conflict();
    return previous;
  }
  apply(
    id: string,
    ownerId: string,
    input: { requestId: string; expectedDraftSeq: number; expectedActiveRevision: number },
  ): RevisionRow {
    return this.transaction(() => {
      const task = this.ownedTask(id, ownerId);
      const previous = this.appliedRequest(id, input);
      if (previous) return previous;
      if (
        task.draft_seq !== input.expectedDraftSeq ||
        task.active_revision !== input.expectedActiveRevision
      )
        conflict();
      const revision = task.active_revision + 1;
      const now = Date.now();
      this.db
        .prepare(
          `INSERT INTO teaching_task_revisions
        (task_id, revision, schema_version, content_json, applied_from_draft_seq, apply_request_id, expected_active_revision, created_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          revision,
          task.draft_json,
          task.draft_seq,
          input.requestId,
          input.expectedActiveRevision,
          now,
        );
      this.db
        .prepare('UPDATE teaching_tasks SET active_revision = ?, updated_at = ? WHERE id = ?')
        .run(revision, now, id);
      return this.revision(id, revision);
    });
  }
  evidence(id: string): EvidenceRow | undefined {
    return this.db
      .prepare('SELECT * FROM training_evidence_index WHERE evidence_id = ?')
      .get(id) as EvidenceRow | undefined;
  }
  reserveEvidence(
    input: EvidenceInput,
    learnerKey: string,
    recordKind: 'demo' | 'learning',
  ): EvidenceRow {
    return this.transaction(() => {
      const existing = this.evidence(input.evidenceId);
      if (existing) {
        const sameBinding =
          existing.task_id === input.taskId &&
          existing.plan_revision === input.planRevision &&
          existing.output_group_id === input.outputGroupId &&
          existing.stage_id === input.stageId &&
          existing.scene_id === input.sceneId &&
          existing.learner_key === learnerKey &&
          existing.record_kind === recordKind &&
          existing.native_attempt_id === input.nativeAttemptId &&
          existing.source_record_refs === canonical(input.sourceRecordRefs) &&
          existing.supersedes_id === (input.supersedesEvidenceId ?? null);
        if (!sameBinding) conflict('同一成果编号不能改变任务、学习者或作答绑定。');
        return existing;
      }
      const native = this.db
        .prepare(
          `SELECT evidence_id FROM training_evidence_index
        WHERE task_id = ? AND plan_revision = ? AND output_group_id = ? AND learner_key = ? AND native_attempt_id = ?`,
        )
        .get(
          input.taskId,
          input.planRevision,
          input.outputGroupId,
          learnerKey,
          input.nativeAttemptId,
        );
      if (native) conflict('这次作答已经登记，请回到原成果重试保存。');
      if (input.supersedesEvidenceId) {
        const old = this.evidence(input.supersedesEvidenceId);
        if (
          !old ||
          old.learner_key !== learnerKey ||
          old.task_id !== input.taskId ||
          old.output_group_id !== input.outputGroupId ||
          JSON.parse(old.processing_json).saved !== 'server'
        )
          conflict('找不到可修订的本人已保存成果。');
      }
      const sessionId = `training:${Buffer.from(JSON.stringify([input.stageId, learnerKey])).toString('base64url')}`;
      const now = Date.now();
      this.db
        .prepare(
          `INSERT INTO training_evidence_index
        (evidence_id, task_id, plan_revision, output_group_id, stage_id, scene_id, learner_key, record_kind, origin,
        native_attempt_id, source_record_refs, runtime_session_id, submission_record_id, processing_json, supersedes_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live_submission', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.evidenceId,
          input.taskId,
          input.planRevision,
          input.outputGroupId,
          input.stageId,
          input.sceneId,
          learnerKey,
          recordKind,
          input.nativeAttemptId,
          canonical(input.sourceRecordRefs),
          sessionId,
          `submission:${input.evidenceId}`,
          JSON.stringify(EMPTY_PROCESSING),
          input.supersedesEvidenceId ?? null,
          now,
          now,
        );
      return this.evidence(input.evidenceId)!;
    });
  }
  updateProcessing(id: string, processing: Processing, assessmentRef: string | null = null): void {
    this.db
      .prepare(
        `UPDATE training_evidence_index SET processing_json = ?, latest_assessment_ref = ?, updated_at = ? WHERE evidence_id = ?`,
      )
      .run(JSON.stringify(processing), assessmentRef, Date.now(), id);
  }
  listEvidence(
    taskId: string,
    options: { learnerKey?: string; recordKind: string; outputGroupId?: string; cursor?: string },
  ): EvidenceRow[] {
    return this.db
      .prepare(
        `SELECT * FROM training_evidence_index WHERE task_id = ? AND record_kind = ?
      AND (? IS NULL OR learner_key = ?) AND (? IS NULL OR output_group_id = ?)
      AND (? IS NULL OR evidence_id > ?) ORDER BY evidence_id LIMIT 51`,
      )
      .all(
        taskId,
        options.recordKind,
        options.learnerKey ?? null,
        options.learnerKey ?? null,
        options.outputGroupId ?? null,
        options.outputGroupId ?? null,
        options.cursor ?? null,
        options.cursor ?? null,
      ) as EvidenceRow[];
  }
}

export async function getTrainingDao(): Promise<TrainingDao> {
  const client = await getPlatformClient();
  if (client.driver !== 'sqlite')
    throw new TrainingError(
      503,
      'TRAINING_STORAGE_UNSUPPORTED',
      '实训共享记录需要SQLite业务存储；当前存储不支持方案事务。',
    );
  return new TrainingDao(client.database);
}
