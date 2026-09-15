'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, FileText, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { DifyDocumentList } from '@/lib/platform/knowledge/types';
import { knowledgeCall } from './use-knowledge-api';

type DifyStatus = Partial<DifyDocumentList> & { configured: boolean; ok: boolean };

export function DifyPanel() {
  const { t } = useI18n();
  const [status, setStatus] = useState<DifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    knowledgeCall<DifyStatus>('documents')
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch(() => {
        if (active) setStatus({ configured: true, ok: false });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  return (
    <section
      className="workspace-panel space-y-4 p-5 sm:p-6"
      aria-label={t('platform.knowledge.difyTitle')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Cloud className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('platform.knowledge.difyTitle')}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('platform.knowledge.difyDescription')}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-10"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('platform.knowledge.difyRefresh')}
        </Button>
      </div>
      <div role="status" aria-live="polite" className="text-sm">
        {loading ? (
          <p className="text-muted-foreground">{t('platform.knowledge.difyLoading')}</p>
        ) : status?.ok ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t('platform.knowledge.difyConnected')}
            </span>
            <span className="font-medium">{status.name}</span>
            <span className="text-muted-foreground">
              {t('platform.knowledge.difyDocuments', { total: status.total ?? 0 })}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t(
              status?.configured === false
                ? 'platform.knowledge.difyUnconfigured'
                : 'platform.knowledge.difyUnavailable',
            )}
          </p>
        )}
      </div>
      {!loading &&
        status?.ok &&
        (status.documents?.length ? (
          <ul className="grid gap-x-8 lg:grid-cols-2">
            {status.documents.map((document) => (
              <li
                key={document.id}
                className="flex items-start gap-3 border-t border-border/60 py-3 text-sm"
              >
                <FileText
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 break-words">{document.name}</span>
                <span
                  className={
                    document.available
                      ? 'shrink-0 text-xs text-emerald-700 dark:text-emerald-400'
                      : 'shrink-0 text-xs text-muted-foreground'
                  }
                >
                  {t(
                    document.disabled
                      ? 'platform.knowledge.difyDisabled'
                      : document.available
                        ? 'platform.knowledge.difyReady'
                        : document.indexingStatus === 'error'
                          ? 'platform.knowledge.difyFailed'
                          : 'platform.knowledge.difyProcessing',
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('platform.knowledge.difyEmpty')}</p>
        ))}
    </section>
  );
}
