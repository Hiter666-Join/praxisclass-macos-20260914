import type { RecordKind } from '@/lib/platform/record-context';
export type MemoryScope = 'teacher' | 'learner';
export type FeedbackFormType = 'learner_session' | 'teacher_prep' | 'teacher_post_class';

export interface MemoryEventRow {
  id: string;
  scope: MemoryScope;
  subject_id: string;
  session_id: string;
  event_type: string;
  payload_json: string;
  created_at: number;
}

export interface FeedbackRow {
  record_kind?: RecordKind;
  id: string;
  form_type: FeedbackFormType;
  subject_id: string;
  course_id: string;
  course_version: string;
  ratings_json: string;
  text_json: string;
  idempotency_key: string | null;
  created_at: number;
}

export type FeedbackRecordRow = FeedbackRow;

export interface TestResultRow {
  record_kind?: RecordKind;
  attempt_id?: string | null;
  scene_id?: string | null;
  stage_id?: string | null;
  attempt_total?: number | null;
  id: string;
  suite: string;
  case_id: string;
  learner_key: string;
  course_id: string;
  course_version: string;
  dimension: string | null;
  passed: 0 | 1;
  score: number;
  duration_ms: number | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  created_at: number;
}

export interface CourseLabelRow {
  stage_id: string;
  course_id: string;
  course_version: string;
  title: string | null;
  updated_at: number;
}

export interface ScheduleRow {
  id: string;
  title: string;
  location: string | null;
  rrule: string;
  start_at: number;
  duration_min: number;
  classroom_url: string | null;
  remind_before_min: number;
  enabled: 0 | 1;
  created_at: number;
  updated_at: number;
}

export type ClassScheduleRow = ScheduleRow;

export interface KnowledgeEntryRow {
  id: string;
  name: string;
  content: string;
  source: string;
  stage: string | null;
  dify_document_id: string | null;
  synced_at: number | null;
  created_at: number;
}

export type KnowledgeRow = KnowledgeEntryRow;

export interface ScheduleEventRow {
  id: string;
  schedule_id: string;
  kind: 'upcoming';
  fire_at: number;
  payload_json: string;
  created_at: number;
  consumed: 0 | 1;
}

export type NewMemoryEvent = Omit<MemoryEventRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: number;
};

export type NewFeedbackRecord = Omit<FeedbackRow, 'id' | 'idempotency_key' | 'created_at'> & {
  id?: string;
  idempotency_key?: string | null;
  created_at?: number;
};

export type NewTestResult = Omit<
  TestResultRow,
  | 'id'
  | 'dimension'
  | 'passed'
  | 'duration_ms'
  | 'failure_reason'
  | 'idempotency_key'
  | 'created_at'
> & {
  id?: string;
  dimension?: string | null;
  passed: boolean | 0 | 1;
  duration_ms?: number | null;
  failure_reason?: string | null;
  idempotency_key?: string | null;
  created_at?: number;
};

export type UpsertCourseLabelInput = Omit<CourseLabelRow, 'title' | 'updated_at'> & {
  title?: string | null;
  updated_at?: number;
};

export interface UpsertScheduleInput {
  id?: string;
  title: string;
  location?: string | null;
  rrule: string;
  start_at: number;
  duration_min?: number;
  classroom_url?: string | null;
  remind_before_min?: number;
  enabled?: boolean | 0 | 1;
}

export type NewScheduleEvent = Omit<
  ScheduleEventRow,
  'id' | 'payload_json' | 'created_at' | 'consumed'
> & {
  id?: string;
  payload_json?: string;
  created_at?: number;
  consumed?: boolean | 0 | 1;
};

export type NewKnowledgeEntry = Omit<
  KnowledgeEntryRow,
  'id' | 'stage' | 'dify_document_id' | 'synced_at' | 'created_at'
> & {
  id?: string;
  stage?: string | null;
  dify_document_id?: string | null;
  synced_at?: number | null;
  created_at?: number;
};

export type KnowledgePatch = Partial<
  Pick<
    KnowledgeEntryRow,
    'name' | 'content' | 'source' | 'stage' | 'dify_document_id' | 'synced_at'
  >
>;

export interface IdempotentInsertResult {
  id: string;
  duplicate: boolean;
}

export interface ReadStats {
  skippedLines: number;
}
