'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/hooks/use-i18n';

import { knowledgeCall, useKnowledgeList, type KnowledgeEntry } from './use-knowledge-api';

const CONTENT_PREVIEW = 80;

interface KnowledgeTableProps {
  reloadToken?: number;
  onUnauthorized?: () => void;
}

function truncate(value: string): string {
  return value.length > CONTENT_PREVIEW ? `${value.slice(0, CONTENT_PREVIEW)}…` : value;
}

export function KnowledgeTable({ reloadToken = 0, onUnauthorized }: KnowledgeTableProps) {
  const { t } = useI18n();
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const { items, total, synced, loading, reload } = useKnowledgeList(search);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', content: '', source: '', stage: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(rawSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  useEffect(() => {
    if (reloadToken > 0) reload();
  }, [reloadToken, reload]);

  const withSource = items.filter((item) => item.source.trim() !== '').length;

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'teacher_required') onUnauthorized?.();
    else toast.error(t('platform.knowledge.actionFailed'));
  };

  const submitDraft = async () => {
    if (!draft.name.trim() || !draft.content.trim() || !draft.source.trim()) {
      toast.error(t('platform.knowledge.nameContentRequired'));
      return;
    }
    setSaving(true);
    try {
      await knowledgeCall('upsert', {
        name: draft.name.trim(),
        content: draft.content.trim(),
        source: draft.source.trim(),
        stage: draft.stage.trim() || undefined,
      });
      setDraft({ name: '', content: '', source: '', stage: '' });
      setAdding(false);
      reload();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: KnowledgeEntry) => {
    if (!window.confirm(t('platform.knowledge.confirmDelete', { name: entry.name }))) return;
    try {
      await knowledgeCall('delete', { id: entry.id });
      reload();
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('platform.knowledge.localEntriesHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={rawSearch}
          onChange={(event) => setRawSearch(event.target.value)}
          placeholder={t('platform.knowledge.searchPlaceholder')}
          className="w-64"
        />
        <Button size="sm" variant="outline" onClick={() => setAdding((value) => !value)}>
          {t('platform.knowledge.addEntry')}
        </Button>
      </div>

      {adding && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder={t('platform.knowledge.columnName')}
            />
            <Input
              value={draft.source}
              onChange={(event) => setDraft({ ...draft, source: event.target.value })}
              placeholder={t('platform.knowledge.columnSource')}
            />
            <Input
              value={draft.stage}
              onChange={(event) => setDraft({ ...draft, stage: event.target.value })}
              placeholder={t('platform.knowledge.columnStage')}
            />
          </div>
          <Textarea
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            placeholder={t('platform.knowledge.columnContent')}
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={() => void submitDraft()}>
              {t('platform.knowledge.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t('platform.knowledge.cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.knowledge.columnName')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.knowledge.columnContent')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.knowledge.columnSource')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.knowledge.columnStage')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.knowledge.columnSynced')}
              </th>
              <th className="px-3 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="border-t">
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {loading ? t('platform.knowledge.loading') : t('platform.knowledge.empty')}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.name}</td>
                  <td
                    className="max-w-[24rem] px-3 py-2 text-muted-foreground"
                    title={item.content}
                  >
                    {truncate(item.content)}
                  </td>
                  <td className="px-3 py-2">{item.source || '—'}</td>
                  <td className="px-3 py-2">{item.stage ?? '—'}</td>
                  <td className="px-3 py-2">{item.dify_document_id ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => void remove(item)}>
                      {t('platform.knowledge.delete')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('platform.knowledge.footer', { total, synced, withSource })}
      </p>
    </div>
  );
}
