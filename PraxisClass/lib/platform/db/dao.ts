import fs from 'node:fs';
import path from 'node:path';
import type { RecordKind } from '@/lib/platform/record-context';

import {
  getPlatformClient,
  resetPlatformClientForTests,
  type PlatformClient,
  type SqliteDatabase,
  type SqliteValue,
} from '@/lib/platform/db/client';
import type {
  CourseLabelRow,
  FeedbackFormType,
  FeedbackRow,
  IdempotentInsertResult,
  KnowledgeEntryRow,
  KnowledgePatch,
  MemoryEventRow,
  MemoryScope,
  NewFeedbackRecord,
  NewKnowledgeEntry,
  NewMemoryEvent,
  NewScheduleEvent,
  NewTestResult,
  ReadStats,
  ScheduleEventRow,
  ScheduleRow,
  TestResultRow,
  UpsertCourseLabelInput,
  UpsertScheduleInput,
} from '@/lib/platform/db/types';

type TableName =
  | 'memory_events'
  | 'feedback_records'
  | 'test_results'
  | 'course_labels'
  | 'class_schedule'
  | 'knowledge_entries'
  | 'schedule_events';

interface FeedbackFilters {
  recordKind?: RecordKind;
  formType?: FeedbackFormType;
  courseId?: string;
  subjectId?: string;
  limit?: number;
}

interface TestResultFilters {
  recordKind?: RecordKind;
  learnerKey?: string;
  courseId?: string;
  suite?: string;
  limit?: number;
}

export interface PlatformDao {
  readonly driver: 'sqlite' | 'jsonl';
  insertMemoryEvent(input: NewMemoryEvent): MemoryEventRow;
  listMemoryEvents(options: {
    scope: MemoryScope;
    subjectId: string;
    limit?: number;
  }): MemoryEventRow[];
  insertFeedback(input: NewFeedbackRecord): IdempotentInsertResult;
  listFeedback(options?: FeedbackFilters): FeedbackRow[];
  countFeedback(options?: { subjectId?: string }): number;
  insertTestResult(input: NewTestResult): IdempotentInsertResult;
  listTestResults(options?: TestResultFilters): TestResultRow[];
  countTestResults(options?: Omit<TestResultFilters, 'limit'>): number;
  countDistinctLearners(): number;
  upsertCourseLabel(input: UpsertCourseLabelInput): CourseLabelRow;
  getCourseLabel(stageId: string): CourseLabelRow | null;
  listCourseLabels(): CourseLabelRow[];
  listSchedule(options?: { enabledOnly?: boolean }): ScheduleRow[];
  upsertSchedule(input: UpsertScheduleInput): ScheduleRow;
  deleteSchedule(id: string): boolean;
  insertScheduleEvent(input: NewScheduleEvent): ScheduleEventRow;
  listScheduleEvents(options?: { since?: number; limit?: number }): ScheduleEventRow[];
  hasScheduleEvent(scheduleId: string, fireAt: number, scheduleUpdatedAt?: number): boolean;
  listKnowledge(options?: { q?: string; limit?: number }): KnowledgeEntryRow[];
  insertKnowledge(input: NewKnowledgeEntry): KnowledgeEntryRow;
  bulkInsertKnowledge(rows: NewKnowledgeEntry[]): KnowledgeEntryRow[];
  updateKnowledge(id: string, patch: KnowledgePatch): KnowledgeEntryRow | null;
  deleteKnowledge(id: string): boolean;
  markKnowledgeSynced(
    id: string,
    difyDocumentId: string,
    syncedAt: number,
  ): KnowledgeEntryRow | null;
  countKnowledge(): { total: number; withSource: number; synced: number };
  getReadStats(): ReadStats;
}

function take<T>(rows: T[], limit?: number): T[] {
  return limit === undefined ? rows : rows.slice(0, Math.max(0, limit));
}

function newest<T extends { id: string; created_at: number }>(rows: T[]): T[] {
  return rows.sort(
    (left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id),
  );
}

function makeMemoryRow(input: NewMemoryEvent): MemoryEventRow {
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    created_at: input.created_at ?? Date.now(),
  };
}

function makeFeedbackRow(input: NewFeedbackRecord): FeedbackRow {
  return {
    ...input,
    record_kind: input.record_kind ?? 'learning',
    id: input.id ?? crypto.randomUUID(),
    idempotency_key: input.idempotency_key ?? null,
    created_at: input.created_at ?? Date.now(),
  };
}

function makeTestResultRow(input: NewTestResult): TestResultRow {
  return {
    ...input,
    record_kind: input.record_kind ?? 'learning',
    attempt_id: input.attempt_id ?? null,
    scene_id: input.scene_id ?? null,
    stage_id: input.stage_id ?? null,
    attempt_total: input.attempt_total ?? null,
    id: input.id ?? crypto.randomUUID(),
    dimension: input.dimension ?? null,
    passed: input.passed === true || input.passed === 1 ? 1 : 0,
    duration_ms: input.duration_ms ?? null,
    failure_reason: input.failure_reason ?? null,
    idempotency_key: input.idempotency_key ?? null,
    created_at: input.created_at ?? Date.now(),
  };
}

function makeCourseLabelRow(input: UpsertCourseLabelInput): CourseLabelRow {
  return {
    stage_id: input.stage_id,
    course_id: input.course_id,
    course_version: input.course_version,
    title: input.title ?? null,
    updated_at: input.updated_at ?? Date.now(),
  };
}

function makeScheduleRow(input: UpsertScheduleInput, existing?: ScheduleRow): ScheduleRow {
  const now = Math.max(Date.now(), (existing?.updated_at ?? 0) + 1);
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title,
    location: input.location ?? null,
    rrule: input.rrule,
    start_at: input.start_at,
    duration_min: input.duration_min ?? 45,
    classroom_url: input.classroom_url ?? null,
    remind_before_min: input.remind_before_min ?? 10,
    enabled: input.enabled === false || input.enabled === 0 ? 0 : 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

function makeScheduleEventRow(input: NewScheduleEvent): ScheduleEventRow {
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    payload_json: input.payload_json ?? '{}',
    created_at: input.created_at ?? Date.now(),
    consumed: input.consumed === true || input.consumed === 1 ? 1 : 0,
  };
}

function normalizeScheduleEventRow(row: ScheduleEventRow): ScheduleEventRow {
  return { ...row, payload_json: row.payload_json ?? '{}', consumed: row.consumed ?? 0 };
}

function matchesScheduleRevision(row: ScheduleEventRow, revision?: number): boolean {
  if (revision === undefined) return true;
  try { return JSON.parse(row.payload_json || '{}').scheduleUpdatedAt === revision; }
  catch { return false; }
}

function makeKnowledgeRow(input: NewKnowledgeEntry): KnowledgeEntryRow {
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    stage: input.stage ?? null,
    dify_document_id: input.dify_document_id ?? null,
    synced_at: input.synced_at ?? null,
    created_at: input.created_at ?? Date.now(),
  };
}

function makeKnowledgeCounts(
  total: number,
  withSource: number,
  synced: number,
): { total: number; withSource: number; synced: number } {
  return Object.defineProperty({ total, withSource }, 'synced', { value: synced }) as {
    total: number;
    withSource: number;
    synced: number;
  };
}

function filterFeedback(rows: FeedbackRow[], options: FeedbackFilters = {}): FeedbackRow[] {
  return take(
    newest(rows).filter(
      (row) =>
        (!options.formType || row.form_type === options.formType) &&
        (!options.recordKind || (row.record_kind ?? 'legacy') === options.recordKind) &&
        (!options.courseId || row.course_id === options.courseId) &&
        (!options.subjectId || row.subject_id === options.subjectId),
    ),
    options.limit,
  );
}

function filterTestResults(
  rows: TestResultRow[],
  options: TestResultFilters = {},
): TestResultRow[] {
  return take(
    newest(rows).filter(
      (row) =>
        (!options.learnerKey || row.learner_key === options.learnerKey) &&
        (!options.recordKind || (row.record_kind ?? 'legacy') === options.recordKind) &&
        (!options.courseId || row.course_id === options.courseId) &&
        (!options.suite || row.suite === options.suite),
    ),
    options.limit,
  );
}

function filterKnowledge(
  rows: KnowledgeEntryRow[],
  options: { q?: string; limit?: number } = {},
): KnowledgeEntryRow[] {
  const query = options.q?.trim().toLocaleLowerCase();
  const limit = Math.min(options.limit ?? 50, 500);
  return take(
    newest(rows).filter(
      (row) => !query || `${row.name}\n${row.content}`.toLocaleLowerCase().includes(query),
    ),
    limit,
  );
}

class SqlitePlatformDao implements PlatformDao {
  readonly driver = 'sqlite' as const;

  constructor(private readonly database: SqliteDatabase) {
    const columns = this.rows<{ name: string }>('PRAGMA table_info(schedule_events)');
    if (!columns.some((column) => column.name === 'consumed')) {
      this.database.exec(
        'ALTER TABLE schedule_events ADD COLUMN consumed INTEGER NOT NULL DEFAULT 0',
      );
    }
  }

  private rows<T>(sql: string, params: SqliteValue[] = []): T[] {
    return this.database.prepare(sql).all(...params) as T[];
  }

  private row<T>(sql: string, params: SqliteValue[] = []): T | undefined {
    return this.database.prepare(sql).get(...params) as T | undefined;
  }

  insertMemoryEvent(input: NewMemoryEvent): MemoryEventRow {
    const row = makeMemoryRow(input);
    this.database
      .prepare(
        `INSERT INTO memory_events
          (id, scope, subject_id, session_id, event_type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.scope,
        row.subject_id,
        row.session_id,
        row.event_type,
        row.payload_json,
        row.created_at,
      );
    return row;
  }

  listMemoryEvents(options: {
    scope: MemoryScope;
    subjectId: string;
    limit?: number;
  }): MemoryEventRow[] {
    const rows = this.rows<MemoryEventRow>(
      `SELECT * FROM memory_events
       WHERE scope = ? AND subject_id = ?
       ORDER BY created_at DESC, id ASC`,
      [options.scope, options.subjectId],
    );
    return take(rows, options.limit);
  }

  insertFeedback(input: NewFeedbackRecord): IdempotentInsertResult {
    if (input.idempotency_key != null) {
      const existing = this.row<{ id: string }>(
        'SELECT id FROM feedback_records WHERE idempotency_key = ?',
        [input.idempotency_key],
      );
      if (existing) return { id: existing.id, duplicate: true };
    }
    const row = makeFeedbackRow(input);
    this.database
      .prepare(
        `INSERT INTO feedback_records
          (id, form_type, subject_id, course_id, course_version, ratings_json, text_json,
           idempotency_key, created_at, record_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.form_type,
        row.subject_id,
        row.course_id,
        row.course_version,
        row.ratings_json,
        row.text_json,
        row.idempotency_key,
        row.created_at,
        row.record_kind ?? 'learning',
      );
    return { id: row.id, duplicate: false };
  }

  listFeedback(options: FeedbackFilters = {}): FeedbackRow[] {
    return filterFeedback(this.rows<FeedbackRow>('SELECT * FROM feedback_records'), options);
  }

  countFeedback(options: { subjectId?: string } = {}): number {
    if (options.subjectId) {
      return (
        this.row<{ count: number }>(
          'SELECT COUNT(*) AS count FROM feedback_records WHERE subject_id = ?',
          [options.subjectId],
        )?.count ?? 0
      );
    }
    return (
      this.row<{ count: number }>('SELECT COUNT(*) AS count FROM feedback_records')?.count ?? 0
    );
  }

  insertTestResult(input: NewTestResult): IdempotentInsertResult {
    if (input.idempotency_key != null) {
      const existing = this.row<{ id: string }>(
        'SELECT id FROM test_results WHERE idempotency_key = ?',
        [input.idempotency_key],
      );
      if (existing) return { id: existing.id, duplicate: true };
    }
    const row = makeTestResultRow(input);
    this.database
      .prepare(
        `INSERT INTO test_results
          (id, suite, case_id, learner_key, course_id, course_version, dimension, passed,
           score, duration_ms, failure_reason, idempotency_key, created_at, record_kind, attempt_id, scene_id, stage_id, attempt_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.suite,
        row.case_id,
        row.learner_key,
        row.course_id,
        row.course_version,
        row.dimension,
        row.passed,
        row.score,
        row.duration_ms,
        row.failure_reason,
        row.idempotency_key,
        row.created_at,
        row.record_kind ?? 'learning',
        row.attempt_id ?? null,
        row.scene_id ?? null,
        row.stage_id ?? null,
        row.attempt_total ?? null,
      );
    return { id: row.id, duplicate: false };
  }

  listTestResults(options: TestResultFilters = {}): TestResultRow[] {
    return filterTestResults(this.rows<TestResultRow>('SELECT * FROM test_results'), options);
  }

  countTestResults(options: Omit<TestResultFilters, 'limit'> = {}): number {
    return filterTestResults(this.rows<TestResultRow>('SELECT * FROM test_results'), options)
      .length;
  }

  countDistinctLearners(): number {
    return (
      this.row<{ count: number }>('SELECT COUNT(DISTINCT learner_key) AS count FROM test_results')
        ?.count ?? 0
    );
  }

  upsertCourseLabel(input: UpsertCourseLabelInput): CourseLabelRow {
    const row = makeCourseLabelRow(input);
    this.database
      .prepare(
        `INSERT INTO course_labels (stage_id, course_id, course_version, title, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(stage_id) DO UPDATE SET
           course_id = excluded.course_id,
           course_version = excluded.course_version,
           title = excluded.title,
           updated_at = excluded.updated_at`,
      )
      .run(row.stage_id, row.course_id, row.course_version, row.title, row.updated_at);
    return row;
  }

  getCourseLabel(stageId: string): CourseLabelRow | null {
    return (
      this.row<CourseLabelRow>('SELECT * FROM course_labels WHERE stage_id = ?', [stageId]) ?? null
    );
  }

  listCourseLabels(): CourseLabelRow[] {
    return this.rows<CourseLabelRow>('SELECT * FROM course_labels ORDER BY stage_id ASC');
  }

  listSchedule(options: { enabledOnly?: boolean } = {}): ScheduleRow[] {
    return this.rows<ScheduleRow>(
      `SELECT * FROM class_schedule${options.enabledOnly ? ' WHERE enabled = 1' : ''}
       ORDER BY start_at ASC, id ASC`,
    );
  }

  upsertSchedule(input: UpsertScheduleInput): ScheduleRow {
    const existing = input.id
      ? this.row<ScheduleRow>('SELECT * FROM class_schedule WHERE id = ?', [input.id])
      : undefined;
    const row = makeScheduleRow(input, existing);
    this.database
      .prepare(
        `INSERT INTO class_schedule
          (id, title, location, rrule, start_at, duration_min, classroom_url,
           remind_before_min, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           location = excluded.location,
           rrule = excluded.rrule,
           start_at = excluded.start_at,
           duration_min = excluded.duration_min,
           classroom_url = excluded.classroom_url,
           remind_before_min = excluded.remind_before_min,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
      .run(
        row.id,
        row.title,
        row.location,
        row.rrule,
        row.start_at,
        row.duration_min,
        row.classroom_url,
        row.remind_before_min,
        row.enabled,
        row.created_at,
        row.updated_at,
      );
    return row;
  }

  deleteSchedule(id: string): boolean {
    const existing = this.row<{ id: string }>('SELECT id FROM class_schedule WHERE id = ?', [id]);
    this.database.prepare('DELETE FROM class_schedule WHERE id = ?').run(id);
    return !!existing;
  }

  insertScheduleEvent(input: NewScheduleEvent): ScheduleEventRow {
    const row = makeScheduleEventRow(input);
    this.database
      .prepare(
        `INSERT INTO schedule_events
          (id, schedule_id, kind, fire_at, payload_json, created_at, consumed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.schedule_id,
        row.kind,
        row.fire_at,
        row.payload_json,
        row.created_at,
        row.consumed,
      );
    return row;
  }

  listScheduleEvents(options: { since?: number; limit?: number } = {}): ScheduleEventRow[] {
    const rows = this.rows<ScheduleEventRow>(
      `SELECT * FROM schedule_events${options.since === undefined ? '' : ' WHERE fire_at >= ?'}
       ORDER BY fire_at DESC, id ASC`,
      options.since === undefined ? [] : [options.since],
    );
    return take(rows, options.limit);
  }

  hasScheduleEvent(scheduleId: string, fireAt: number, scheduleUpdatedAt?: number): boolean {
    return this.rows<ScheduleEventRow>(
      'SELECT * FROM schedule_events WHERE schedule_id = ? AND fire_at = ?',
      [scheduleId, fireAt],
    ).some(row => matchesScheduleRevision(row, scheduleUpdatedAt));
  }

  listKnowledge(options: { q?: string; limit?: number } = {}): KnowledgeEntryRow[] {
    return filterKnowledge(
      this.rows<KnowledgeEntryRow>('SELECT * FROM knowledge_entries'),
      options,
    );
  }

  insertKnowledge(input: NewKnowledgeEntry): KnowledgeEntryRow {
    const row = makeKnowledgeRow(input);
    this.database
      .prepare(
        `INSERT INTO knowledge_entries
          (id, name, content, source, stage, dify_document_id, synced_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.name,
        row.content,
        row.source,
        row.stage,
        row.dify_document_id,
        row.synced_at,
        row.created_at,
      );
    return row;
  }

  bulkInsertKnowledge(rows: NewKnowledgeEntry[]): KnowledgeEntryRow[] {
    return rows.map((row) => this.insertKnowledge(row));
  }

  updateKnowledge(id: string, patch: KnowledgePatch): KnowledgeEntryRow | null {
    const existing = this.row<KnowledgeEntryRow>('SELECT * FROM knowledge_entries WHERE id = ?', [
      id,
    ]);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.database
      .prepare(
        `UPDATE knowledge_entries
         SET name = ?, content = ?, source = ?, stage = ?, dify_document_id = ?, synced_at = ?
         WHERE id = ?`,
      )
      .run(
        updated.name,
        updated.content,
        updated.source,
        updated.stage,
        updated.dify_document_id,
        updated.synced_at,
        id,
      );
    return updated;
  }

  deleteKnowledge(id: string): boolean {
    const existing = this.row<{ id: string }>('SELECT id FROM knowledge_entries WHERE id = ?', [
      id,
    ]);
    this.database.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(id);
    return !!existing;
  }

  markKnowledgeSynced(
    id: string,
    difyDocumentId: string,
    syncedAt: number,
  ): KnowledgeEntryRow | null {
    const existing = this.row<KnowledgeEntryRow>('SELECT * FROM knowledge_entries WHERE id = ?', [
      id,
    ]);
    if (!existing) return null;
    this.database
      .prepare('UPDATE knowledge_entries SET dify_document_id = ?, synced_at = ? WHERE id = ?')
      .run(difyDocumentId, syncedAt, id);
    return { ...existing, dify_document_id: difyDocumentId, synced_at: syncedAt };
  }

  countKnowledge(): { total: number; withSource: number; synced: number } {
    const total =
      this.row<{ count: number }>('SELECT COUNT(*) AS count FROM knowledge_entries')?.count ?? 0;
    const withSource =
      this.row<{ count: number }>(
        "SELECT COUNT(*) AS count FROM knowledge_entries WHERE TRIM(source) <> ''",
      )?.count ?? 0;
    const synced =
      this.row<{ count: number }>(
        'SELECT COUNT(*) AS count FROM knowledge_entries WHERE dify_document_id IS NOT NULL',
      )?.count ?? 0;
    return makeKnowledgeCounts(total, withSource, synced);
  }

  getReadStats(): ReadStats {
    return { skippedLines: 0 };
  }
}

class JsonlPlatformDao implements PlatformDao {
  readonly driver = 'jsonl' as const;
  private skippedLines = 0;

  constructor(private readonly directory: string) {}

  private file(table: TableName): string {
    return path.join(this.directory, `${table}.jsonl`);
  }

  private read<T>(table: TableName): T[] {
    this.skippedLines = 0;
    let content: string;
    try {
      content = fs.readFileSync(this.file(table), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const rows: T[] = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed) as T);
      } catch {
        this.skippedLines += 1;
      }
    }
    return rows;
  }

  private append<T>(table: TableName, row: T): void {
    fs.mkdirSync(this.directory, { recursive: true });
    fs.appendFileSync(this.file(table), `${JSON.stringify(row)}\n`, 'utf8');
  }

  private rewrite<T>(table: TableName, rows: T[]): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const content = rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '';
    fs.writeFileSync(this.file(table), content, 'utf8');
  }

  insertMemoryEvent(input: NewMemoryEvent): MemoryEventRow {
    const row = makeMemoryRow(input);
    this.append('memory_events', row);
    return row;
  }

  listMemoryEvents(options: {
    scope: MemoryScope;
    subjectId: string;
    limit?: number;
  }): MemoryEventRow[] {
    const rows = newest(this.read<MemoryEventRow>('memory_events')).filter(
      (row) => row.scope === options.scope && row.subject_id === options.subjectId,
    );
    return take(rows, options.limit);
  }

  insertFeedback(input: NewFeedbackRecord): IdempotentInsertResult {
    if (input.idempotency_key != null) {
      const existing = this.read<FeedbackRow>('feedback_records').find(
        (row) => row.idempotency_key === input.idempotency_key,
      );
      if (existing) return { id: existing.id, duplicate: true };
    }
    const row = makeFeedbackRow(input);
    this.append('feedback_records', row);
    return { id: row.id, duplicate: false };
  }

  listFeedback(options: FeedbackFilters = {}): FeedbackRow[] {
    return filterFeedback(this.read<FeedbackRow>('feedback_records'), options);
  }

  countFeedback(options: { subjectId?: string } = {}): number {
    return this.read<FeedbackRow>('feedback_records').filter(
      (row) => !options.subjectId || row.subject_id === options.subjectId,
    ).length;
  }

  insertTestResult(input: NewTestResult): IdempotentInsertResult {
    if (input.idempotency_key != null) {
      const existing = this.read<TestResultRow>('test_results').find(
        (row) => row.idempotency_key === input.idempotency_key,
      );
      if (existing) return { id: existing.id, duplicate: true };
    }
    const row = makeTestResultRow(input);
    this.append('test_results', row);
    return { id: row.id, duplicate: false };
  }

  listTestResults(options: TestResultFilters = {}): TestResultRow[] {
    return filterTestResults(this.read<TestResultRow>('test_results'), options);
  }

  countTestResults(options: Omit<TestResultFilters, 'limit'> = {}): number {
    return filterTestResults(this.read<TestResultRow>('test_results'), options).length;
  }

  countDistinctLearners(): number {
    return new Set(this.read<TestResultRow>('test_results').map((row) => row.learner_key)).size;
  }

  upsertCourseLabel(input: UpsertCourseLabelInput): CourseLabelRow {
    const rows = this.read<CourseLabelRow>('course_labels');
    const row = makeCourseLabelRow(input);
    const index = rows.findIndex((item) => item.stage_id === row.stage_id);
    if (index >= 0) rows[index] = row;
    else rows.push(row);
    this.rewrite('course_labels', rows);
    return row;
  }

  getCourseLabel(stageId: string): CourseLabelRow | null {
    return (
      this.read<CourseLabelRow>('course_labels').find((row) => row.stage_id === stageId) ?? null
    );
  }

  listCourseLabels(): CourseLabelRow[] {
    return this.read<CourseLabelRow>('course_labels').sort((left, right) =>
      left.stage_id.localeCompare(right.stage_id),
    );
  }

  listSchedule(options: { enabledOnly?: boolean } = {}): ScheduleRow[] {
    return this.read<ScheduleRow>('class_schedule')
      .filter((row) => !options.enabledOnly || row.enabled === 1)
      .sort((left, right) => left.start_at - right.start_at || left.id.localeCompare(right.id));
  }

  upsertSchedule(input: UpsertScheduleInput): ScheduleRow {
    const rows = this.read<ScheduleRow>('class_schedule');
    const index = input.id ? rows.findIndex((row) => row.id === input.id) : -1;
    const row = makeScheduleRow(input, index >= 0 ? rows[index] : undefined);
    if (index >= 0) rows[index] = row;
    else rows.push(row);
    this.rewrite('class_schedule', rows);
    return row;
  }

  deleteSchedule(id: string): boolean {
    const rows = this.read<ScheduleRow>('class_schedule');
    const filtered = rows.filter((row) => row.id !== id);
    if (filtered.length === rows.length) return false;
    this.rewrite('class_schedule', filtered);
    return true;
  }

  insertScheduleEvent(input: NewScheduleEvent): ScheduleEventRow {
    const row = makeScheduleEventRow(input);
    this.append('schedule_events', row);
    return row;
  }

  listScheduleEvents(options: { since?: number; limit?: number } = {}): ScheduleEventRow[] {
    const rows = this.read<ScheduleEventRow>('schedule_events')
      .map(normalizeScheduleEventRow)
      .filter((row) => options.since === undefined || row.fire_at >= options.since)
      .sort((left, right) => right.fire_at - left.fire_at || left.id.localeCompare(right.id));
    return take(rows, options.limit);
  }

  hasScheduleEvent(scheduleId: string, fireAt: number, scheduleUpdatedAt?: number): boolean {
    return this.read<ScheduleEventRow>('schedule_events').some(
      (row) => row.schedule_id === scheduleId && row.fire_at === fireAt && matchesScheduleRevision(row, scheduleUpdatedAt),
    );
  }

  listKnowledge(options: { q?: string; limit?: number } = {}): KnowledgeEntryRow[] {
    return filterKnowledge(this.read<KnowledgeEntryRow>('knowledge_entries'), options);
  }

  insertKnowledge(input: NewKnowledgeEntry): KnowledgeEntryRow {
    const row = makeKnowledgeRow(input);
    this.append('knowledge_entries', row);
    return row;
  }

  bulkInsertKnowledge(rows: NewKnowledgeEntry[]): KnowledgeEntryRow[] {
    return rows.map((row) => this.insertKnowledge(row));
  }

  updateKnowledge(id: string, patch: KnowledgePatch): KnowledgeEntryRow | null {
    const rows = this.read<KnowledgeEntryRow>('knowledge_entries');
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    rows[index] = { ...rows[index], ...patch };
    this.rewrite('knowledge_entries', rows);
    return rows[index];
  }

  deleteKnowledge(id: string): boolean {
    const rows = this.read<KnowledgeEntryRow>('knowledge_entries');
    const filtered = rows.filter((row) => row.id !== id);
    if (filtered.length === rows.length) return false;
    this.rewrite('knowledge_entries', filtered);
    return true;
  }

  markKnowledgeSynced(
    id: string,
    difyDocumentId: string,
    syncedAt: number,
  ): KnowledgeEntryRow | null {
    const rows = this.read<KnowledgeEntryRow>('knowledge_entries');
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    rows[index] = { ...rows[index], dify_document_id: difyDocumentId, synced_at: syncedAt };
    this.rewrite('knowledge_entries', rows);
    return rows[index];
  }

  countKnowledge(): { total: number; withSource: number; synced: number } {
    const rows = this.read<KnowledgeEntryRow>('knowledge_entries');
    return makeKnowledgeCounts(
      rows.length,
      rows.filter((row) => row.source.trim()).length,
      rows.filter((row) => row.dify_document_id !== null).length,
    );
  }

  getReadStats(): ReadStats {
    return { skippedLines: this.skippedLines };
  }
}

let daoPromise: Promise<PlatformDao> | undefined;

function createDao(client: PlatformClient): PlatformDao {
  return client.driver === 'sqlite'
    ? new SqlitePlatformDao(client.database)
    : new JsonlPlatformDao(client.directory);
}

export function getPlatformDao(): Promise<PlatformDao> {
  if (!daoPromise) daoPromise = getPlatformClient().then(createDao);
  return daoPromise;
}

export function resetPlatformDaoForTests(): void {
  daoPromise = undefined;
  resetPlatformClientForTests();
}
