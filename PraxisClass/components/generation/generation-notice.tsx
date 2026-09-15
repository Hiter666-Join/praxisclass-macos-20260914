'use client';

import { Info } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';

/** Persists across preview and classroom generation; it does not block navigation. */
export function GenerationNotice({ paused = false, serverDraft = false }: { paused?: boolean; serverDraft?: boolean }) {
  const { locale } = useI18n();
  const text = locale.startsWith('zh')
    ? paused
      ? serverDraft ? 'Pro 制作已停止，当前为未完成草稿。可导出已有内容，或回 Pro 继续备课。' : '课程生成已暂停，请在当前页面重试，完成后再返回首页或切换课程。'
      : '课程正在生成，请留在当前页面，完成后再返回首页或切换课程。'
    : paused
      ? serverDraft ? 'Pro preparation has stopped. This is an unfinished draft. Export the saved pages or continue in Pro.' : 'Course generation is paused. Retry here before returning home or switching courses.'
      : 'Your course is being generated. Stay on this page until it finishes before returning home or switching courses.';

  return (
    <div
      role="status"
      data-testid="generation-notice"
      className="pointer-events-none fixed bottom-16 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground shadow-lg sm:max-w-lg"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{text}</span>
    </div>
  );
}
