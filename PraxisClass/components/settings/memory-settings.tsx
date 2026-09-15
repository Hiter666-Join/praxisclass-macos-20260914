'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLearnerKey } from '@/components/platform/use-learner-key';
import { usePlatformMode } from '@/components/platform/nav-config';
import { useI18n } from '@/lib/hooks/use-i18n';
import { teachingMemoryCopy } from '@/lib/platform/memory/teaching-copy';

const MAX_CHARS = 2048;

interface MemoryPayload {
  profile: string;
  memory: string;
  updatedAt: number | null;
}

function codePointLength(value: string): number {
  return [...value].length;
}

export function MemorySettings() {
  const { mode } = usePlatformMode();
  const learnerKey = useLearnerKey();
  const scope = mode === 'teacher' ? 'teacher' : 'learner';

  // A role/key switch starts a fresh editor. Late saves from the previous
  // identity cannot replace the new identity's visible profile or memory.
  return (
    <MemoryEditor
      key={`${scope}:${scope === 'teacher' ? 'main' : learnerKey}`}
      scope={scope}
      learnerKey={learnerKey}
    />
  );
}

function MemoryEditor({
  scope,
  learnerKey,
}: {
  scope: 'teacher' | 'learner';
  learnerKey: string | null;
}) {
  const { t, locale } = useI18n();
  const copy = teachingMemoryCopy(locale);
  const [profile, setProfile] = useState('');
  const [memory, setMemory] = useState('');
  const [saved, setSaved] = useState<MemoryPayload>({ profile: '', memory: '', updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  const headers = useCallback((): HeadersInit => {
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (scope === 'learner' && learnerKey) base['x-learner-key'] = learnerKey;
    return base;
  }, [scope, learnerKey]);

  const apply = useCallback((payload: MemoryPayload) => {
    setSaved(payload);
    setProfile(payload.profile ?? '');
    setMemory(payload.memory ?? '');
  }, []);

  useEffect(() => {
    if (scope === 'learner' && !learnerKey) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetch(`/api/platform/memory?scope=${scope}`, { headers: headers(), signal: AbortSignal.timeout(10000) })
      .then((response) => {
        if (!response.ok) throw new Error('Memory load failed');
        return response.json() as Promise<MemoryPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (payload) apply(payload);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scope, learnerKey, headers, apply, reload]);

  const profileLength = codePointLength(profile);
  const memoryLength = codePointLength(memory);
  const overCap = profileLength > MAX_CHARS || memoryLength > MAX_CHARS;
  const unchanged = profile === saved.profile && memory === saved.memory;

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/platform/memory?scope=${scope}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ profile, memory }),
      });
      if (!response.ok) {
        toast.error(t('settings.memory.saveFailed'));
        return;
      }
      apply((await response.json()) as MemoryPayload);
      toast.success(t('settings.memory.saved'));
    } catch {
      toast.error(t('settings.memory.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm(t('settings.memory.clearConfirm'))) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/platform/memory?scope=${scope}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!response.ok) {
        toast.error(t('settings.memory.saveFailed'));
        return;
      }
      apply({ profile: '', memory: '', updatedAt: null });
      toast.success(t('settings.memory.cleared'));
    } catch {
      toast.error(t('settings.memory.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('settings.memory.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {scope === 'teacher' ? copy.teacherDescription : copy.learnerDescription}
        </p>
        {scope === 'teacher' && (
          <p className="text-sm text-muted-foreground" data-testid="teaching-memory-hint">
            {copy.hint}
          </p>
        )}
      </div>

      {scope === 'learner' && (
        <p className="text-xs text-muted-foreground">{t('settings.memory.isolationNote')}</p>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('settings.memory.loading')}
          </CardContent>
        </Card>
      ) : loadError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive">{copy.loadFailed}</p>
          <Button variant="outline" onClick={() => setReload((value) => value + 1)}>{copy.retry}</Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="memory-profile">{copy.profileLabel}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {profileLength}/{MAX_CHARS}
              </span>
            </div>
            <Textarea
              id="memory-profile"
              rows={6}
              value={profile}
              onChange={(event) => setProfile(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="memory-memory">{copy.memoryLabel}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {memoryLength}/{MAX_CHARS}
              </span>
            </div>
            <Textarea
              id="memory-memory"
              rows={8}
              value={memory}
              onChange={(event) => setMemory(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={saving || unchanged || overCap} onClick={() => void save()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t('settings.memory.save')}
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void clear()}>
              {t('settings.memory.clear')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {saved.updatedAt
                ? t('settings.memory.updatedAt', {
                    time: new Date(saved.updatedAt).toLocaleString(),
                  })
                : t('settings.memory.neverSaved')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
