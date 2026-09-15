'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';

export interface Taskcard {
  工作情境: string;
  规范要点: string[];
  来源: string[];
  评价标准: string[];
}

const FENCE = /```taskcard\s*\r?\n([\s\S]*?)```/;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Pulls the single ```taskcard fenced block out of a scene description.
 * A missing or unparsable block leaves the description untouched.
 */
export function parseTaskcard(description: string): {
  card: Taskcard | null;
  rest: string;
  fence: string | null;
} {
  const match = FENCE.exec(description);
  if (!match) return { card: null, rest: description, fence: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return { card: null, rest: description, fence: null };
  }
  if (parsed === null || typeof parsed !== 'object')
    return { card: null, rest: description, fence: null };
  const record = parsed as Record<string, unknown>;
  const card: Taskcard = {
    工作情境: typeof record['工作情境'] === 'string' ? record['工作情境'] : '',
    规范要点: toStringArray(record['规范要点']),
    来源: toStringArray(record['来源']),
    评价标准: toStringArray(record['评价标准']),
  };
  return { card, rest: description.replace(FENCE, '').trim(), fence: match[0] };
}

function Section({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function TaskcardView({ card }: { card: Taskcard }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t('platform.taskcard.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {card.工作情境 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('platform.taskcard.situation')}
            </p>
            <p className="text-sm">{card.工作情境}</p>
          </div>
        )}
        <Section label={t('platform.taskcard.norms')} items={card.规范要点} />
        {card.来源.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('platform.taskcard.sources')}
            </p>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm">
              {card.来源.map((source, index) => (
                <li key={index}>{source}</li>
              ))}
            </ol>
          </div>
        )}
        <Section label={t('platform.taskcard.criteria')} items={card.评价标准} />
      </CardContent>
    </Card>
  );
}
