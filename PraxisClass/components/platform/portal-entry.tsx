'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, GraduationCap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import { BrandLogo } from '@/components/brand-logo';
import { usePlatformMode } from './nav-config';

export function PortalEntry() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setMode } = usePlatformMode();

  const nextPath = () => {
    const next = searchParams.get('next');
    // Only local paths: protocol-relative URLs and backslashes can leave this origin.
    return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
      ? next
      : '/teacher';
  };

  const enterTeacher = () => {
    setMode('teacher');
    router.push(nextPath());
  };

  const enterStudent = () => {
    setMode('student');
    router.push('/student');
  };

  return (
    <main className="flex min-h-[100dvh] w-full flex-col bg-background px-5 pb-16 pt-8 sm:px-10 sm:pt-12">
      <div className="mx-auto w-full max-w-6xl">
        <BrandLogo size="lg" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.12fr_0.88fr] lg:gap-20">
        <section aria-labelledby="portal-heading" className="min-w-0">
          <p className="workspace-eyebrow mb-5">{t('platform.portal.slogan')}</p>
          <h1
            id="portal-heading"
            className="max-w-[14em] text-balance text-3xl font-semibold leading-[1.4] tracking-tight sm:text-4xl sm:leading-[1.4]"
          >
            {t('platform.design.portalTitle')}
          </h1>
          <p className="mt-5 max-w-md text-base leading-8 text-muted-foreground">
            {t('platform.design.portalLead')}
          </p>

          <ol className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6 sm:mt-14 sm:gap-6">
            {(['plan', 'practice', 'reflect'] as const).map((step, index) => (
              <li key={step} className="space-y-3">
                <span className="text-xs font-medium tabular-nums text-primary">0{index + 1}</span>
                <h2 className="text-sm font-semibold">{t(`platform.design.${step}`)}</h2>
                <p className="hidden text-xs leading-6 text-muted-foreground sm:block">
                  {t(`platform.design.${step}Hint`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-4">
          <p className="px-1 text-sm leading-6 text-muted-foreground">{t('platform.portal.demoNotice')}</p>
          <section aria-labelledby="teacher-entry-heading" className="workspace-panel p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/7 text-primary">
                <GraduationCap className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 id="teacher-entry-heading" className="text-xl font-semibold tracking-tight">
                  {t('platform.portal.teacherTitle')}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('platform.portal.teacherDescription')}
                </p>
              </div>
            </div>
            <Button
              className="min-h-11 w-full justify-between rounded-xl px-4"
              onClick={enterTeacher}
            >
              <span>{t('platform.portal.enterTeacher')}</span>
              <ArrowRight className="size-4" />
            </Button>
          </section>

          <section aria-labelledby="student-entry-heading" className="workspace-panel p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                <Users className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 id="student-entry-heading" className="text-xl font-semibold tracking-tight">
                  {t('platform.portal.studentTitle')}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('platform.portal.studentDescription')}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="min-h-11 w-full justify-between rounded-xl px-4"
              onClick={enterStudent}
            >
              <span>{t('platform.portal.enterStudent')}</span>
              <ArrowRight className="size-4" />
            </Button>
          </section>
        </div>
      </div>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5 text-xs leading-6 text-muted-foreground">
        <span>{t('home.slogan')}</span>
        <span>{t('platform.portal.aiNotice')}</span>
      </footer>
    </main>
  );
}
