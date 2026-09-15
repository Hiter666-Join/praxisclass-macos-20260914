import type { MemoryEventInput } from '@/lib/platform/memory/types';

const MAX_CHARS = 2048;
const UPDATED_LINE = /^_更新于 \d{4}-\d{2}-\d{2} · \d+\/2048 字符_$/;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function cleanSummary(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sectionLines(source: string[], heading: string): string[] {
  const start = source.indexOf(heading);
  if (start < 0) return [];
  const values: string[] = [];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index].startsWith('## ')) break;
    if (source[index].startsWith('- ')) values.push(source[index].slice(2).trim());
  }
  return values.filter(Boolean);
}

function render(
  date: string,
  preserved: string[],
  recent: string[],
  struggles: string[],
  completed: string[],
): string {
  const body = [
    '# 记忆',
    '',
    '__UPDATED__',
    ...(preserved.length ? ['', ...preserved] : []),
    '',
    '## 近期事件',
    ...recent.map((line) => `- ${line}`),
    '',
    '## 反复卡点',
    ...struggles.map((line) => `- ${line}`),
    '',
    '## 已完成',
    ...completed.map((line) => `- ${line}`),
  ].join('\n');
  let count = 0;
  let result = body;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    result = body.replace('__UPDATED__', `_更新于 ${date} · ${count}/2048 字符_`);
    const next = [...result].length;
    if (next === count) break;
    count = next;
  }
  return result;
}

export function distillMemory(
  existingMemoryMd: string,
  events: MemoryEventInput[],
  now: Date,
): string {
  const source = existingMemoryMd.split(/\r?\n/);
  const firstSection = source.findIndex((line) => line.startsWith('## '));
  const preface = (firstSection < 0 ? source : source.slice(0, firstSection))
    .filter((line) => line !== '# 记忆' && !UPDATED_LINE.test(line))
    .join('\n')
    .trim()
    .split('\n')
    .filter(Boolean);
  const incoming = events.map((event) => ({
    ...event,
    summary: cleanSummary(event.summary),
  }));
  const recent = unique([
    ...incoming.map((event) => event.summary).reverse(),
    ...sectionLines(source, '## 近期事件'),
  ]).slice(0, 30);
  const struggleCounts = new Map<string, number>();
  for (const event of incoming) {
    if (event.eventType !== 'struggle') continue;
    struggleCounts.set(event.summary, (struggleCounts.get(event.summary) ?? 0) + 1);
  }
  const struggles = unique([
    ...sectionLines(source, '## 反复卡点'),
    ...[...struggleCounts].filter(([, count]) => count >= 2).map(([summary]) => summary),
  ]);
  const completed = unique([
    ...incoming
      .filter((event) => event.eventType === 'task_completed')
      .map((event) => event.summary)
      .reverse(),
    ...sectionLines(source, '## 已完成'),
  ]);
  const date = now.toISOString().slice(0, 10);
  let result = render(date, preface, recent, struggles, completed);
  while ([...result].length > MAX_CHARS && recent.length) {
    recent.pop();
    result = render(date, preface, recent, struggles, completed);
  }
  return [...result].length <= MAX_CHARS ? result : existingMemoryMd;
}
