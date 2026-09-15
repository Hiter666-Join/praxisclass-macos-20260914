export const PLATFORM_SCHEMA = `
CREATE TABLE IF NOT EXISTS memory_events (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('teacher','learner')),
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS memory_events_scope_subject_created_idx
  ON memory_events (scope, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_records (
  id TEXT PRIMARY KEY,
  record_kind TEXT NOT NULL DEFAULT 'legacy',
  form_type TEXT NOT NULL CHECK(form_type IN ('learner_session','teacher_prep','teacher_post_class')),
  subject_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  ratings_json TEXT NOT NULL,
  text_json TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_records_form_created_idx
  ON feedback_records (form_type, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_records_course_version_idx
  ON feedback_records (course_id, course_version);

CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  record_kind TEXT NOT NULL DEFAULT 'legacy',
  attempt_id TEXT,
  scene_id TEXT,
  stage_id TEXT,
  attempt_total INTEGER,
  suite TEXT NOT NULL,
  case_id TEXT NOT NULL,
  learner_key TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  dimension TEXT,
  passed INTEGER NOT NULL,
  score REAL NOT NULL,
  duration_ms INTEGER,
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS test_results_suite_course_version_idx
  ON test_results (suite, course_id, course_version);
CREATE INDEX IF NOT EXISTS test_results_learner_created_idx
  ON test_results (learner_key, created_at DESC);

CREATE TABLE IF NOT EXISTS course_labels (
  stage_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  title TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS class_schedule (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  rrule TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 45,
  classroom_url TEXT,
  remind_before_min INTEGER NOT NULL DEFAULT 10,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  stage TEXT,
  dify_document_id TEXT,
  synced_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('upcoming')),
  fire_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS schedule_events_fire_at_idx
  ON schedule_events (fire_at DESC);

CREATE TABLE IF NOT EXISTS teaching_tasks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  create_request_id TEXT NOT NULL,
  create_content_json TEXT NOT NULL,
  active_revision INTEGER NOT NULL DEFAULT 0,
  draft_json TEXT NOT NULL,
  draft_seq INTEGER NOT NULL DEFAULT 0,
  draft_receipts_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(owner_id, create_request_id)
);
CREATE TABLE IF NOT EXISTS teaching_task_revisions (
  task_id TEXT NOT NULL REFERENCES teaching_tasks(id),
  revision INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  applied_from_draft_seq INTEGER NOT NULL,
  apply_request_id TEXT NOT NULL,
  expected_active_revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(task_id, revision),
  UNIQUE(task_id, apply_request_id)
);
CREATE TABLE IF NOT EXISTS training_evidence_index (
  evidence_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES teaching_tasks(id),
  plan_revision INTEGER NOT NULL,
  output_group_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  learner_key TEXT NOT NULL,
  record_kind TEXT NOT NULL,
  origin TEXT NOT NULL,
  native_attempt_id TEXT NOT NULL,
  source_record_refs TEXT NOT NULL,
  runtime_session_id TEXT NOT NULL,
  submission_record_id TEXT NOT NULL,
  latest_assessment_ref TEXT,
  processing_json TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  supersedes_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(task_id, plan_revision, output_group_id, learner_key, native_attempt_id)
);
CREATE INDEX IF NOT EXISTS training_evidence_task_learner_idx
  ON training_evidence_index(task_id, learner_key, created_at DESC, evidence_id);
`;
