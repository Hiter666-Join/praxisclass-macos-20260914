import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { TrainingError } from './errors';
import type { TrainingActor } from './service';

export const knowledgeCaseSchema = z.enum(['main-ticket', 'ai-code', 'retry', 'vision', 'warehouse']);
const files = {
  sources: ['KNOWLEDGE-SOURCES', '01-来源目录.md'],
  http: ['KP-HTTP', '02-HTTP请求与响应-10条.md'],
  spring: ['KP-SPRING', '03-Spring接口应用-8条.md'],
  rag: ['KP-RAG', '04-SpringAI与资料问答-14条.md'],
  testing: ['KP-TESTING', '05-代码验收与运行证据-10条.md'],
  retry: ['KP-RETRY', '06-可靠重试与幂等-10条.md'],
} as const;
const selected: Record<z.infer<typeof knowledgeCaseSchema>, (keyof typeof files)[]> = {
  'main-ticket': ['sources', 'http', 'spring', 'rag'], 'ai-code': ['sources', 'testing'],
  retry: ['sources', 'http', 'retry'], vision: ['sources', 'testing'], warehouse: ['sources', 'testing'],
};

/** Bundle availability is not task selection. The teacher explicitly uploads and applies these files. */
export async function trainingKnowledgeMaterials(caseId: z.infer<typeof knowledgeCaseSchema>, actor: TrainingActor) {
  if (actor.role !== 'teacher') throw new TrainingError(403, 'TEACHER_REQUIRED', '请在教师侧选择本次所用专业知识。');
  const materials = [];
  for (const key of selected[caseId]) {
    let [sourceId, filename]: [string, string] = [...files[key]];
    let text = await readFile(join(process.cwd(), 'resources/training/knowledge', filename), 'utf8');
    if (key === 'testing' && (caseId === 'vision' || caseId === 'warehouse')) {
      const blocks = text.match(/^## KP-\d{3}[^]*?(?=^## KP-\d{3}|$(?![^]))/gm) ?? [];
      text = '# 需求与功能验证：两条共用知识\n\nSOFTWARE-KNOWLEDGE-1.0；从正式测试主题选取KP-033、KP-034，完整保留依据与边界；具体领域规则仍读本案例正文。\n\n' + blocks.filter((block) => /^## KP-03[34]\b/.test(block)).join('\n');
      sourceId = 'KP-VALIDATION'; filename = 'KP-033-034-需求与功能验证.md';
    }
    materials.push({ sourceId, filename, text, basisType: 'technical' as const, studentVisible: true });
  }
  return { version: 'SOFTWARE-KNOWLEDGE-1.0', availableUniqueEntries: 52, files: materials };
}
