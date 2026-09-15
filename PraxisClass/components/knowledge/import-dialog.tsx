'use client';

import { useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/hooks/use-i18n';

import { knowledgeCall } from './use-knowledge-api';

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
  onUnauthorized?: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
  onUnauthorized,
}: ImportDialogProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState<'json' | 'markdown'>('json');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const readFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
    if (file.name.endsWith('.json')) setFormat('json');
    else setFormat('markdown');
  };

  const submit = async () => {
    if (!text.trim()) {
      toast.error(t('platform.knowledge.importEmpty'));
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await knowledgeCall<ImportResult>('import', { format, text });
      toast.success(
        t('platform.knowledge.importDone', {
          inserted: result.inserted ?? 0,
          skipped: result.skipped ?? 0,
        }),
      );
      setErrors(result.errors ?? []);
      onImported?.();
      if ((result.errors ?? []).length === 0) {
        setText('');
        onOpenChange(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'teacher_required') onUnauthorized?.();
      else setErrors([message]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('platform.knowledge.importTitle')}</DialogTitle>
          <DialogDescription>{t('platform.knowledge.importHelp')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={format} onValueChange={(value) => setFormat(value as 'json' | 'markdown')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
            <Input type="file" accept=".json,.md,.txt" className="w-64" onChange={readFile} />
          </div>

          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder={t('platform.knowledge.importPlaceholder')}
            className="font-mono text-xs"
          />

          {errors.length > 0 && (
            <ul className="space-y-1 text-xs text-destructive">
              {errors.map((message, index) => (
                <li key={`${index}:${message}`}>{message}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('platform.knowledge.cancel')}
          </Button>
          <Button disabled={submitting} onClick={() => void submit()}>
            {t('platform.knowledge.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
