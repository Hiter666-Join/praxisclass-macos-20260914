'use client';

import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/hooks/use-i18n';

import type { KnowledgeSource } from './use-knowledge-api';

interface SourceIndicatorProps {
  source: KnowledgeSource;
}

export function SourceIndicator({ source }: SourceIndicatorProps) {
  const { t } = useI18n();

  if (source === 'unknown') {
    return <Badge variant="outline">{t('platform.knowledge.sourceUnknown')}</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className={
        source === 'dify'
          ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
          : 'text-muted-foreground'
      }
    >
      {source === 'dify'
        ? t('platform.knowledge.sourceDify')
        : t('platform.knowledge.sourceLocal')}
    </Badge>
  );
}
