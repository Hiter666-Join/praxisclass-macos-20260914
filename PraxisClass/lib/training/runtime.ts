import type { RuntimeRecord } from '@praxis/dsl';
import type { RuntimeStore } from '@praxis/storage';
import { canonical } from '@/lib/platform/training/contracts';
import { conflict } from '@/lib/platform/training/errors';
import type { EvidenceRow } from '@/lib/platform/training/dao';
import { trainingPayloadSchema, type TrainingPayload } from './payload';

export type TrainingRuntimeScope = Pick<
  EvidenceRow,
  'runtime_session_id' | 'stage_id' | 'scene_id' | 'learner_key' | 'created_at'
>;

export async function ensureTrainingSession(
  store: RuntimeStore,
  row: TrainingRuntimeScope,
  kind = 'trainingEvidence',
): Promise<void> {
  let session = await store.getSession(row.runtime_session_id);
  if (!session) {
    const time = new Date(row.created_at).toISOString();
    try {
      session = await store.createSession({
        id: row.runtime_session_id,
        kind,
        stageId: row.stage_id,
        learnerKey: row.learner_key,
        status: 'active',
        createdAt: time,
        updatedAt: time,
      });
    } catch (error) {
      session = await store.getSession(row.runtime_session_id);
      if (!session) throw error;
    }
  }
  if (
    session.kind !== kind ||
    session.stageId !== row.stage_id ||
    session.learnerKey !== row.learner_key ||
    session.status !== 'active'
  )
    conflict('运行容器与成果所属范围不一致。');
}

/** A lost response or a concurrent append is resolved by reading and comparing the actual fact. */
export async function appendTrainingFact(
  store: RuntimeStore,
  row: EvidenceRow,
  id: string,
  payload: TrainingPayload,
): Promise<RuntimeRecord> {
  trainingPayloadSchema.parse(payload);
  return appendImmutableRuntimeFact(
    store,
    row,
    id,
    payload,
    'submittedAt' in payload ? payload.submittedAt : payload.createdAt,
  );
}

export async function appendImmutableRuntimeFact(
  store: RuntimeStore,
  row: TrainingRuntimeScope,
  id: string,
  payload: RuntimeRecord['payload'],
  createdAt: string,
): Promise<RuntimeRecord> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const records = await store.listRecords(row.runtime_session_id);
    const existing = records.find((record) => record.id === id);
    if (existing) {
      if (canonical(existing.payload) !== canonical(payload))
        conflict('同一请求已保存不同内容，请以修订方式提交。');
      return existing;
    }
    try {
      return await store.appendRecord(
        {
          id,
          sessionId: row.runtime_session_id,
          sceneId: row.scene_id,
          createdAt,
          payload,
        },
        { expectedLastSeq: records.at(-1)?.seq ?? null },
      );
    } catch (error) {
      const current = await store.listRecords(row.runtime_session_id);
      const saved = current.find((record) => record.id === id);
      if (saved) {
        if (canonical(saved.payload) !== canonical(payload))
          conflict('同一请求已保存不同内容，请以修订方式提交。');
        return saved;
      }
      if (current.at(-1)?.seq === records.at(-1)?.seq || attempt === 3) throw error;
    }
  }
  throw new Error('Training append did not complete');
}
