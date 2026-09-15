const LEARNER_KEY_PATTERN = /^[A-Za-z0-9:_-]{6,128}$/;

export function readLearnerKey(req: Request): string | null {
  const value = req.headers.get('x-learner-key')?.trim();
  return value && LEARNER_KEY_PATTERN.test(value) ? value : null;
}
