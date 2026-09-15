import { getPlatformDao } from '@/lib/platform/db/dao';
import type { NormalizedItem } from '@/lib/platform/knowledge/types';

const SEPARATORS = /[\s，。！？；、：,.!?;:（）()\[\]【】]+/u;

export async function localQuery(query: string, topK = 5): Promise<NormalizedItem[]> {
  const rawQuery = query.toLocaleLowerCase();
  const keywords = [...new Set(rawQuery.split(SEPARATORS).filter(Boolean))].slice(
    0,
    8,
  );
  if (!keywords.length) return [];
  const dao = await getPlatformDao();
  return dao
    .listKnowledge({ limit: 500 })
    .map((entry) => {
      const name = entry.name.trim().toLocaleLowerCase();
      const haystack = `${entry.name}\n${entry.content}`.toLocaleLowerCase();
      const nameMatch =
        name.length >= 2 &&
        (rawQuery.includes(name) || (name.endsWith('原理') && rawQuery.includes(name.slice(0, -2))));
      const matches = keywords.filter((keyword) => haystack.includes(keyword)).length + Number(nameMatch);
      return {
        title: entry.name,
        content: entry.content,
        source: entry.source,
        stage: entry.stage ?? '',
        score: Math.min(1, matches / keywords.length),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, Math.max(0, topK));
}
