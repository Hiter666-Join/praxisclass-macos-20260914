import type { KnowledgeEntry } from '@/lib/platform/knowledge/types';

export function renderEntryBlock(entry: KnowledgeEntry): string {
  return `【名称】${entry.name}\n【内容】${entry.content}\n【来源】${entry.source}\n【适用环节】${entry.stage ?? ''}`;
}

export function parseSourceLine(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const marker = line.indexOf('【来源】');
    if (marker >= 0) return line.slice(marker + '【来源】'.length).trim();
  }
  return null;
}

export function parseStageLine(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const marker = line.indexOf('【适用环节】');
    if (marker >= 0) return line.slice(marker + '【适用环节】'.length).trim();
  }
  return null;
}
