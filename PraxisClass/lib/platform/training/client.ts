import { getPersistenceRequestHeaders } from '@/lib/persistence/bootstrap';
import { getDeviceLearnerKey } from '@/lib/runtime/learner-key';
import { demoLearnerKey } from '@/lib/platform/record-context';
import type { TrainingService } from './service';

export type TrainingTaskView = ReturnType<TrainingService['getTask']>;
export type TrainingEvidenceView = Awaited<ReturnType<TrainingService['getEvidence']>>;
export type TrainingEvidenceList = ReturnType<TrainingService['listEvidence']>;
export class TrainingRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function trainingLearnerKey(role: 'teacher' | 'student'): Promise<string> {
  const base = await getDeviceLearnerKey();
  return role === 'teacher' ||
    new URLSearchParams(window.location.search).get('trainingDemo') === '1'
    ? demoLearnerKey(base)
    : base;
}
export async function trainingFetch<T>(
  path: string,
  role: 'teacher' | 'student',
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const headers = {
    ...(await getPersistenceRequestHeaders()),
    'x-learner-key': await trainingLearnerKey(role),
    'x-praxis-role': role,
    'Content-Type': 'application/json',
  };
  const response = await fetch(`/api/platform/training/${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new TrainingRequestError(
      [
        result.message ?? '实训请求未完成。',
        ...(result.fieldErrors ?? []).map((item: { message: string }) => item.message),
      ].join(' '), response.status,
    );
  return result as T;
}
