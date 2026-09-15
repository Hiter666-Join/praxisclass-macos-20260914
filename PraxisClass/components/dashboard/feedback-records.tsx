'use client';

import type { FeedbackRow } from '@/lib/platform/db/types';
import { useI18n } from '@/lib/hooks/use-i18n';

function parse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function FeedbackRecords({
  rows,
  courseNames = {},
}: {
  rows: FeedbackRow[];
  courseNames?: Record<string, string>;
}) {
  const { t, locale } = useI18n();
  if (!rows.length)
    return <p className="py-4 text-sm text-muted-foreground">{t('studentLearning.noFeedback')}</p>;
  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <article key={row.id} className="space-y-3 py-5 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{courseNames[row.course_id] ?? row.course_id}</h3>
            <time className="text-xs text-muted-foreground">
              {new Date(row.created_at).toLocaleString(locale)}
            </time>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`platform.forms.title.${row.form_type}`)} · {row.course_version} ·{' '}
            {t(`studentLearning.${row.record_kind ?? 'legacy'}`)}
          </p>
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {Object.entries(parse(row.ratings_json)).map(([key, value]) => (
              <div key={key}>
                <dt className="inline text-muted-foreground">
                  {t(`studentLearning.ratings.${key}`, { defaultValue: key })}:{' '}
                </dt>
                <dd className="inline">{String(value)}/5</dd>
              </div>
            ))}
          </dl>
          {Object.entries(parse(row.text_json))
            .filter(([, value]) => (Array.isArray(value) ? value.length : String(value).trim()))
            .map(([key, value]) => (
              <p key={key} className="whitespace-pre-wrap break-words text-sm leading-6">
                <span className="text-muted-foreground">
                  {t(`studentLearning.fields.${key}`, { defaultValue: key })}:{' '}
                </span>
                {Array.isArray(value)
                  ? value.map((item) => t(String(item))).join('、')
                  : String(value)}
              </p>
            ))}
        </article>
      ))}
    </div>
  );
}
