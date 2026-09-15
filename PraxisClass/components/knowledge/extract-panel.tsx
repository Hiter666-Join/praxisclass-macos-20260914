'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/hooks/use-i18n';

import { SourceIndicator } from './source-indicator';
import { knowledgeCall, type KnowledgePoint, type KnowledgeSource } from './use-knowledge-api';

const MAX_CHARS = 8000;

export const KNOWLEDGE_POINTS_KEY = 'praxis.knowledgePoints';

interface ExtractResponse {
  points: KnowledgePoint[];
  source: KnowledgeSource;
  llm: boolean;
}

export function ExtractPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState('');
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<KnowledgeSource>('unknown');
  const [llm, setLlm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const extract = async () => {
    if (!text.trim()) {
      toast.error(t('platform.knowledge.extractEmpty'));
      return;
    }
    setLoading(true);
    try {
      const result = await knowledgeCall<ExtractResponse>('extract', {
        text: text.slice(0, MAX_CHARS),
        topK: 10,
      });
      const list = result.points ?? [];
      setPoints(list);
      setSelected(new Set(list.map((_, index) => index)));
      setSource(result.source ?? 'unknown');
      setLlm(result.llm !== false);
      setExtracted(true);
    } catch (error) {
      setPoints([]);
      setSelected(new Set());
      setExtracted(false);
      const message = error instanceof Error ? error.message : '';
      toast.error(t(
        message === 'dify_unconfigured'
          ? 'platform.knowledge.difyUnconfigured'
          : message === 'dify_unavailable'
            ? 'platform.knowledge.difyUnavailable'
            : 'platform.knowledge.extractFailed',
      ));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (index: number) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const insert = () => {
    const lines = points
      .filter((_, index) => selected.has(index))
      .map((point) => {
        const stage = point.stage ? `｜适用：${point.stage}` : '';
        const evidence = point.content
          .split(/\r?\n/)
          .map((line) => `  > ${line}`)
          .join('\n');
        return `- ${point.name}（来源：${point.source}${stage}）${point.sourceUrl ? `\n  原文件：${point.sourceUrl}` : ''}\n${evidence}`;
      });
    if (lines.length === 0) {
      toast.error(t('platform.knowledge.insertEmpty'));
      return;
    }
    try {
      sessionStorage.setItem(KNOWLEDGE_POINTS_KEY, `${text.trim()}\n\n${lines.join('\n\n')}`);
    } catch {
      toast.error(t('platform.knowledge.insertFailed'));
      return;
    }
    router.push('/');
  };

  return (
    <div className="space-y-4">
      <label htmlFor="knowledge-material" className="block text-sm font-medium">
        {t('platform.design.knowledgeMaterial')}
      </label>
      <Textarea
        id="knowledge-material"
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, MAX_CHARS))}
        rows={7}
        className="min-h-40 bg-background text-sm leading-7"
        aria-describedby="knowledge-character-count"
        placeholder={t('platform.knowledge.extractPlaceholder')}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-11 gap-2"
          disabled={loading || !text.trim()}
          onClick={() => void extract()}
        >
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t(loading ? 'platform.design.extracting' : 'platform.knowledge.extract')}
        </Button>
        <span id="knowledge-character-count" className="text-xs tabular-nums text-muted-foreground">
          {text.length}/{MAX_CHARS}
        </span>
        {points.length > 0 && <SourceIndicator source={source} />}
        {points.length > 0 && !llm && (
          <span className="text-xs text-muted-foreground">
            {t('platform.knowledge.extractNoLlm')}
          </span>
        )}
      </div>

      {extracted && points.length === 0 && (
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          {t('platform.design.extractEmptyResult')}
        </p>
      )}

      {points.length > 0 && (
        <>
          <ul className="divide-y divide-border/70">
            {points.map((point, index) => (
              <li key={`${index}:${point.name}`} className="flex items-start gap-3 py-4 text-sm">
                <Checkbox
                  id={`knowledge-point-${index}`}
                  checked={selected.has(index)}
                  onCheckedChange={() => toggle(index)}
                  className="mt-1"
                />
                <label
                  htmlFor={`knowledge-point-${index}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span className="font-medium">{point.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {point.source}
                    {point.stage ? ` · ${point.stage}` : ''}
                  </span>
                  <span className="mt-2 block whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {point.content}
                  </span>
                  {point.sourceUrl && <a href={point.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline underline-offset-4">核对原文件</a>}
                </label>
              </li>
            ))}
          </ul>
          <Button
            className="h-11 gap-2"
            variant="outline"
            disabled={selected.size === 0}
            onClick={insert}
          >
            {t('platform.knowledge.insertToOutline')}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  );
}
