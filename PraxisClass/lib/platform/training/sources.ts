import type { ServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { getReadyOwnerMaterials } from '@/lib/persistence/owner-materials';
import { getMaterialByteStore } from '@/lib/server/materials/bytes';
import type { TeachingPlan } from './contracts';
import { TrainingError } from './errors';

/** Read only an explicitly selected upload belonging to the task's teacher. */
export async function readTrainingSourceText(
  pool: ServerPersistenceProvider['pool'],
  source: TeachingPlan['sources'][number],
  ownerId: string,
): Promise<string> {
  if (source.kind !== 'upload') {
    throw new TrainingError(
      422,
      'DIFY_SOURCE_UNVERIFIED',
      '此来源尚未核验，请选择直接上传的资料。',
    );
  }
  const [material] = await getReadyOwnerMaterials(pool, ownerId, [source.materialRef]);
  if (!material)
    throw new TrainingError(
      503,
      'SOURCE_UNAVAILABLE',
      '选中的资料当前不可读取，请恢复资料后重试。',
    );
  if (!['text/markdown', 'text/plain', 'text/csv'].includes(material.mime ?? '')) {
    throw new TrainingError(
      422,
      'SOURCE_TEXT_REQUIRED',
      '实训来源请先选择 Markdown 或文本正文；PDF 原件可在备课资料库保留。',
    );
  }
  if (material.bytes > 200000)
    throw new TrainingError(422, 'SOURCE_TOO_LARGE', '请选择与本次任务有关的正文片段。');
  try {
    const bytes = await getMaterialByteStore().get(material.ossKey);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TrainingError(503, 'SOURCE_UNAVAILABLE', '资料正文当前不可读取，请恢复资料后重试。');
  }
}
