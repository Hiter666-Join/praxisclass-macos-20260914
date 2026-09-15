import { describe, expect, it } from 'vitest';
import { trainingKnowledgeMaterials } from '@/lib/platform/training/knowledge';
import type { TrainingActor } from '@/lib/platform/training/service';
const teacher: TrainingActor = { ownerId: 't', learnerKey: 'demo:t', role: 'teacher' };
describe('task-selected professional knowledge', () => {
  it('provides 52 unique complete entries across relevant software themes, without teacher answer files', async () => {
    const all = await Promise.all((['main-ticket', 'ai-code', 'retry'] as const).map((id) => trainingKnowledgeMaterials(id, teacher)));
    const sources = new Map(all.flatMap((catalog) => catalog.files).map((file) => [file.sourceId, file]));
    const entries = [...sources.values()].flatMap((file) => [...file.text.matchAll(/^## (KP-\d{3})\b/gm)].map((m) => m[1]));
    expect(entries.length).toBe(52); expect(new Set(entries).size).toBe(52);
    expect([...sources.values()].every((f) => f.text.length <= 12000 && f.text.length > 100 && !f.filename.includes('教师'))).toBe(true);
  });
  it('selects only the two common validation entries for adjacent industry cases', async () => {
    for (const id of ['vision','warehouse'] as const) {
      const catalog=await trainingKnowledgeMaterials(id,teacher),text=catalog.files.find((f)=>f.sourceId==='KP-VALIDATION')!.text;
      expect([...text.matchAll(/^## (KP-\d{3})\b/gm)].map((m)=>m[1])).toEqual(['KP-033','KP-034']);
      expect(text).toContain('PDF第12页'); expect(text).not.toContain('## KP-035');
    }
  });
  it('does not let a student perform teacher material selection', async () => {
    await expect(trainingKnowledgeMaterials('main-ticket',{...teacher,role:'student'})).rejects.toMatchObject({status:403});
  });
});
