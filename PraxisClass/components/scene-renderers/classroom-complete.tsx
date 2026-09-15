'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { animate, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { Home, RotateCcw, Trophy } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { useInWorkbenchPanel } from '@/lib/workbench/panel-context';
import type { Scene, SceneType } from '@/lib/types/stage';
import { getSceneTypeMeta } from '@/lib/classroom/scene-type-meta';
import {
  completeSummaryForScenes,
  pendingCompleteSummary,
  readSceneQuizAnswers,
  summarizeScenes,
} from '@/lib/classroom/complete-summary';
import { loadQuizAttemptState } from '@/lib/quiz/runtime';
import { createLogger } from '@/lib/logger';
import { useSettingsMode } from '@/lib/store/settings-mode';
import { resolveClassroomExit } from '@/lib/workbench/classroom-exit';

const log = createLogger('ClassroomComplete');

const TYPE_ORDER: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

/** Confetti in the classroom palette: coral plus the four page tones. */
const CONFETTI_COLORS = [
  '#c64f3c',
  '#e08b7a',
  '#1f8a70',
  '#b7791f',
  '#5b6f8c',
  '#8fd0be',
  '#f0c36a',
];

function encouragementKey(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  w: number;
  h: number;
  duration: number;
  delay: number;
  round: boolean;
}

function makeConfetti(count: number): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const distance = 180 + Math.random() * 280;
    const w = 6 + Math.random() * 6;
    arr.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 50,
      rotate: (Math.random() - 0.5) * 720,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w,
      h: Math.random() > 0.3 ? w * 0.4 : w,
      duration: 1.0 + Math.random() * 0.9,
      delay: Math.random() * 0.12,
      round: Math.random() > 0.72,
    });
  }
  return arr;
}

function Confetti() {
  const prefersReducedMotion = useReducedMotion();
  const particles = useMemo(() => makeConfetti(55), []);
  if (prefersReducedMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.2 }}
          animate={{
            x: p.x,
            y: p.y + 220,
            opacity: 0,
            rotate: p.rotate,
            scale: 1,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.1, 0.5, 0.4, 1] }}
          style={{
            position: 'absolute',
            width: p.w,
            height: p.h,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : 2,
          }}
        />
      ))}
    </div>
  );
}

function AnimatedCounter({
  value,
  delay = 0,
  duration = 0.9,
}: {
  value: number;
  delay?: number;
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(0, value, {
      delay,
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay, duration, prefersReducedMotion]);

  return <>{prefersReducedMotion ? value : display}</>;
}

/** Score ring, drawn in the quiz tone of the classroom palette. */
function QuizRing({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: 62, height: 62 }}>
      <svg viewBox="0 0 62 62" className="h-full w-full -rotate-90">
        <circle
          cx="31"
          cy="31"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-(--scene-tone-soft)"
        />
        <motion.circle
          cx="31"
          cy="31"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className="text-(--scene-tone)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{
            duration: prefersReducedMotion ? 0 : 1.1,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold tabular-nums text-(--scene-tone)">
          <AnimatedCounter value={pct} delay={delay} duration={1.0} />
          <span className="text-[10px] font-semibold">%</span>
        </span>
      </div>
    </div>
  );
}

interface ClassroomCompletePageProps {
  readonly scenes: Scene[];
  readonly title: string;
  /** Restart the course from page 1. Hidden when the host cannot navigate. */
  readonly onReplay?: () => void;
  /** Where "back home" goes; omitted inside the workbench, which owns its own routing. */
  readonly homeHref?: string;
  readonly feedbackHref?: string;
}

/**
 * End-of-session summary: what the learner walked through (page counts by
 * type, in the learning-path tones) and how the quiz went, with the two moves
 * that follow — run it again, or leave.
 */
export function ClassroomCompletePage({
  scenes,
  title,
  onReplay,
  homeHref,
  feedbackHref,
}: ClassroomCompletePageProps) {
  const { t, locale } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const [resolvedSummary, setResolvedSummary] = useState(() => ({
    scenes,
    summary: pendingCompleteSummary(scenes),
  }));
  const summary = completeSummaryForScenes(scenes, resolvedSummary);

  useEffect(() => {
    let cancelled = false;
    void summarizeScenes(scenes, async (sceneId) => {
      const scene = scenes.find((candidate) => candidate.id === sceneId);
      try {
        return await readSceneQuizAnswers(scene, loadQuizAttemptState);
      } catch (error) {
        log.warn(`Failed to load quiz summary for scene ${sceneId}:`, error);
        return undefined;
      }
    }).then((next) => {
      if (!cancelled) setResolvedSummary({ scenes, summary: next });
    });
    return () => {
      cancelled = true;
    };
  }, [scenes]);

  const dateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale).format(new Date());
    } catch {
      return new Date().toLocaleDateString();
    }
  }, [locale]);

  const trailItems = TYPE_ORDER.filter((type) => (summary.countsByType[type] ?? 0) > 0).map(
    (type) => {
      const meta = getSceneTypeMeta(type);
      return {
        type,
        count: summary.countsByType[type] ?? 0,
        Icon: meta.icon,
        tone: meta.tone,
        label: t(meta.labelKey),
      };
    },
  );

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? 'always' : 'user'}>
      <section
        data-classroom-complete
        // `m-auto` on the content instead of `items-center`: centred when the
        // canvas is tall enough, scrolled from the top when it is not.
        className="absolute inset-0 z-[105] flex overflow-auto bg-background"
        aria-label={t('classroomComplete.title')}
      >
        {/* Single-shot announcement for screen readers — replaces the noisy
            outer aria-live region that used to wrap the live-updating counters. */}
        <span className="sr-only" role="status">
          {t('classroomComplete.title')}
        </span>
        {/* Warm wash behind the summary, in the brand coral */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 62%)',
          }}
        />
        <Confetti />

        {/* Content */}
        <div className="relative m-auto flex w-full max-w-xl flex-col items-center gap-3 px-5 py-5">
          {/* Seal + title */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-accent ring-1 ring-primary/25">
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full ring-1 ring-primary/30"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
              />
              <Trophy className="size-6 text-primary" strokeWidth={1.6} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wide text-primary">
                {t('classroomPath.completeStep')}
              </div>
              <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground md:text-xl">
                {title || t('classroomComplete.title')}
              </h2>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </motion.div>

          {/* Learning-path review — one pill per page type, in its tone */}
          {trailItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="workspace-eyebrow">{t('classroomComplete.pathReview')}</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {trailItems.map(({ type, count, Icon, tone, label }, idx) => (
                  <div
                    key={type}
                    data-scene-tone={tone}
                    className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5"
                  >
                    <Icon
                      className="size-3.5 shrink-0 text-(--scene-tone)"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold leading-none tabular-nums text-foreground">
                      <AnimatedCounter value={count} delay={0.4 + idx * 0.08} />
                    </span>
                    <span className="text-xs leading-none text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quiz result */}
          {summary.quiz && (
            <motion.div
              data-scene-tone="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.4, ease: 'easeOut' }}
              className="workspace-panel flex w-full items-center gap-3.5 px-4 py-3"
            >
              <QuizRing pct={summary.quiz.pct} delay={0.5} />
              <div className="min-w-0 flex-1">
                <div className="workspace-eyebrow">{t('classroomComplete.quizSection')}</div>
                <div className="text-sm font-semibold text-foreground">
                  {t('classroomComplete.quizScoreLabel', {
                    correct: summary.quiz.correct,
                    total: summary.quiz.total,
                  })}
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  {t(`classroomComplete.encouragement.${encouragementKey(summary.quiz.pct)}`)}
                </div>
              </div>
            </motion.div>
          )}

          {/* What happens next */}
          {(onReplay || homeHref || feedbackHref) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
              className="mt-0.5 flex flex-wrap items-center justify-center gap-2.5"
            >
              {onReplay && (
                <button
                  type="button"
                  onClick={onReplay}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  {t('classroomComplete.replay')}
                </button>
              )}
              {feedbackHref && (
                <Link
                  href={feedbackHref}
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
                >
                  {t('studentLearning.feedback')}
                </Link>
              )}
              {homeHref && (
                <Link
                  href={homeHref}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Home className="size-4" aria-hidden />
                  {t('classroom.backToHome')}
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </MotionConfig>
  );
}

export function ClassroomCompletePageConnected({ onReplay }: { readonly onReplay?: () => void }) {
  const stage = useStageStore((s) => s.stage);
  const scenes = useStageStore((s) => s.scenes);
  const inWorkbenchPanel = useInWorkbenchPanel();
  const platformMode = useSettingsMode((s) => s.mode);
  const searchParams = useSearchParams();
  return (
    <ClassroomCompletePage
      key={platformMode}
      scenes={scenes}
      title={stage?.name ?? ''}
      onReplay={onReplay}
      homeHref={
        inWorkbenchPanel ? undefined : resolveClassroomExit({ searchParams, platformMode }).href
      }
      feedbackHref={
        platformMode === 'student' && stage
          ? `/student/feedback?course=${encodeURIComponent(stage.id)}`
          : undefined
      }
    />
  );
}
