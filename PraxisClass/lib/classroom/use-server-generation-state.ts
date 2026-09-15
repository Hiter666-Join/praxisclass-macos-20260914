'use client';
import { useEffect } from 'react';
import { useStageStore } from '@/lib/store/stage';
import { serverGenerationPresentation } from './server-generation-state';

/** Observe the producing job without starting or completing any generation. */
export function useServerGenerationState(classroomId: string) {
  const producer = useStageStore((state) => state.stage?.id === classroomId ? state.outlineProducer : null);
  const sessionId = useStageStore((state) => state.stage?.id === classroomId ? state.outlineProducerRef : null);
  const complete = useStageStore((state) => state.generationComplete);
  useEffect(() => {
    if (producer !== 'server-job' || !sessionId || complete) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) return;
        const meta = await response.json() as { status?: string };
        const state = useStageStore.getState();
        if (cancelled || state.stage?.id !== classroomId || state.outlineProducerRef !== sessionId || state.generationComplete) return;
        if (!['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(meta.status ?? '')) return;
        useStageStore.setState(serverGenerationPresentation(meta.status!, state.outlines, state.scenes));
      } catch {
        // An unavailable status must not claim the producer stopped.
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [classroomId, producer, sessionId, complete]);
}
