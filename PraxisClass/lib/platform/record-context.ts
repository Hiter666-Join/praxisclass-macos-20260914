export type RecordKind = 'learning' | 'demo' | 'legacy';

export const DEMO_LEARNER_PREFIX = 'demo:';

export function isDemoLearner(key: string): boolean {
  return key.startsWith(DEMO_LEARNER_PREFIX);
}

export function demoLearnerKey(key: string): string {
  return isDemoLearner(key) ? key : `${DEMO_LEARNER_PREFIX}${key}`;
}

/** Capture purpose at submission creation, so a later role switch cannot relabel it. */
export function recordKindForLearner(key: string): 'learning' | 'demo' {
  return isDemoLearner(key) ? 'demo' : 'learning';
}

export function requestRecordKind(
  request: Request,
  key: string,
  declared?: 'learning' | 'demo',
): RecordKind {
  if (
    isDemoLearner(key) ||
    declared === 'demo' ||
    request.headers.get('x-praxis-role') === 'teacher'
  )
    return 'demo';
  if (declared === 'learning' || request.headers.get('x-praxis-role') === 'student')
    return 'learning';
  return 'legacy';
}
