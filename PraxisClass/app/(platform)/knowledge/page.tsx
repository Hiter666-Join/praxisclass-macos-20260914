'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/platform/page-header';
import { ExtractPanel } from '@/components/knowledge/extract-panel';
import { DifyPanel } from '@/components/knowledge/dify-panel';
import { SourceIndicator } from '@/components/knowledge/source-indicator';
import { knowledgeCall, type KnowledgeQueryItem } from '@/components/knowledge/use-knowledge-api';
import { useI18n } from '@/lib/hooks/use-i18n';

interface QueryResponse {
  items: KnowledgeQueryItem[];
  source: 'dify';
}

/** Optional Dify workspace, reached from Settings rather than the main teaching flow. */
export default function KnowledgePage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeQueryItem[]>([]);
  const [querying, setQuerying] = useState(false);
  const [queried, setQueried] = useState(false);
  const [errorKey, setErrorKey] = useState('');

  const runQuery = async () => {
    if (!query.trim() || querying) return;
    setQuerying(true);
    setResults([]);
    setErrorKey('');
    setQueried(false);
    try {
      const result = await knowledgeCall<QueryResponse>('query', { query: query.trim(), topK: 5 });
      setResults((result.items ?? []).slice(0, 5));
      setQueried(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setErrorKey(
        message === 'dify_unconfigured'
          ? 'platform.knowledge.difyUnconfigured'
          : message === 'dify_unavailable'
            ? 'platform.knowledge.difyUnavailable'
            : 'platform.design.knowledgeQueryError',
      );
    } finally {
      setQuerying(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('settings.knowledge.title')}
        description={t('settings.knowledge.description')}
      />
      <DifyPanel />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-2">
        <section
          className="workspace-panel space-y-5 p-5 sm:p-6"
          aria-labelledby="knowledge-search-heading"
        >
          <div>
            <h2 id="knowledge-search-heading" className="text-lg font-semibold">
              {t('platform.design.knowledgeSearch')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('platform.design.knowledgeSearchHint')}
            </p>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runQuery();
            }}
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('platform.knowledge.queryPlaceholder')}
              aria-label={t('platform.knowledge.queryPlaceholder')}
              maxLength={2000}
              className="h-11 min-w-40 flex-1 bg-background"
            />
            <Button type="submit" className="h-11 gap-2" disabled={querying || !query.trim()}>
              {querying ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}
              {t(querying ? 'platform.design.searching' : 'platform.design.searchKnowledge')}
            </Button>
          </form>
          <div aria-live="polite" aria-busy={querying}>
            {errorKey && (
              <p role="alert" className="text-sm text-destructive">
                {t(errorKey)}
              </p>
            )}
            {queried && results.length === 0 && (
              <p className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                {t('platform.design.noKnowledgeResults')}
              </p>
            )}
            {results.length > 0 && (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t('platform.design.resultsCount', { count: results.length })}</span>
                  <SourceIndicator source="dify" />
                </div>
                <ul className="divide-y divide-border/70">
                  {results.map((item, index) => (
                    <li
                      key={`${index}:${item.title}`}
                      className="space-y-2 py-4 text-sm first:pt-1"
                    >
                      <h3 className="break-words font-medium">{item.title}</h3>
                      {item.source !== item.title && (
                        <p className="break-words text-xs text-muted-foreground">{item.source}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                        {item.content}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
        <section
          className="workspace-panel space-y-5 p-5 sm:p-6"
          aria-labelledby="knowledge-extract-heading"
        >
          <div>
            <h2 id="knowledge-extract-heading" className="text-lg font-semibold">
              {t('platform.knowledge.extractTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('platform.design.extractHint')}
            </p>
          </div>
          <ExtractPanel />
        </section>
      </div>
    </>
  );
}
