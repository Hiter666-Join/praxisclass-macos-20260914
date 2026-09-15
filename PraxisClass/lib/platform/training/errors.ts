export class TrainingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export function conflict(message = '请求内容或版本已变化，请保留当前编辑并重新读取。'): never {
  throw new TrainingError(409, 'TRAINING_CONFLICT', message);
}
export function notFound(): never {
  throw new TrainingError(404, 'TRAINING_NOT_FOUND', '找不到当前身份可读取的任务或成果。');
}
