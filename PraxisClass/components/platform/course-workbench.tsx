'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import { matchCourseStats } from './course-card';
import { formatUpdatedAt } from './recent-courses';
import { WorkspaceDrawer } from './workspace-drawer';
import { TrainingTaskPanel } from '@/components/training/task-panel';
import { getDocumentStore } from '@/lib/document-store/store';
import type { AppDocumentOutline } from '@/lib/document-store/persistence-types';

export interface WorkbenchCourse {
  id: string;
  name: string;
  updatedAt?: number;
}

export function CourseWorkbench({
  courses,
  loading,
  dashboard,
  student = false,
  emptyAction,
  onFeedback,
}: {
  courses: WorkbenchCourse[];
  loading: boolean;
  dashboard: DashboardPayload | null;
  student?: boolean;
  emptyAction: ReactNode;
  onFeedback?: (course: WorkbenchCourse) => void;
}) {
  const { t } = useI18n();
  const sortId = useId();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [selected, setSelected] = useState<WorkbenchCourse | null>(null);
  const rows = courses
    .filter((course) => course.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );
  const stats = selected ? matchCourseStats(dashboard, selected.id, selected.name) : null;

  return (
    <>
      <section
        className="workspace-panel min-w-0 overflow-hidden"
        data-course-workbench
        aria-label={t('platform.design.allCourses')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">
            {t('platform.design.allCourses')}
            <span className="ml-2.5 text-sm font-normal tabular-nums text-muted-foreground">
              {courses.length}
            </span>
          </h2>
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
            <label htmlFor={sortId} className="shrink-0 text-sm text-muted-foreground">
              {t('platform.workbench.sort')}
            </label>
            <SelectField
              id={sortId}
              value={sort}
              onValueChange={setSort}
              className="flex-1 sm:w-44 sm:flex-none"
              options={[
                { value: 'recent', label: t('platform.workbench.recentFirst') },
                { value: 'name', label: t('platform.workbench.byName') },
              ]}
            />
          </div>
        </div>
        <div className="relative mx-5 my-4">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('platform.design.courseSearch')}
            aria-label={t('platform.design.courseSearch')}
            className="h-11 rounded-xl bg-card pl-10 pr-11"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuery('')}
              aria-label={t('platform.design.clearSearch')}
              className="absolute right-0.5 top-0.5 size-10"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem] gap-4 border-y border-border bg-muted/60 px-5 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
          <span>{t('platform.schedule.columnTitle')}</span>
          <span>{t('platform.teacher.passRate')}</span>
          <span className="text-right">{t('platform.workbench.actions')}</span>
        </div>
        <div aria-busy={loading}>
          {loading ? (
            <div className="space-y-4 p-5" aria-label={t('common.loading')}>
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 rounded-lg bg-muted motion-safe:animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-52 flex-col items-start justify-center gap-3 px-5 py-7">
              <div className="flex items-center gap-3">
                <BookOpen className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  {t(query ? 'platform.design.noMatchingCourses' : 'platform.workbench.noCourses')}
                </h3>
              </div>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                {t(student ? 'platform.design.emptyStudentHint' : 'platform.workbench.createHint')}
              </p>
              {query ? (
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setQuery('')}>
                  {t('platform.design.clearSearch')}
                </Button>
              ) : (
                emptyAction
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((course) => {
                const rowStats = matchCourseStats(dashboard, course.id, course.name);
                return (
                  <li
                    key={course.id}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:gap-4"
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(course)}
                      className="group flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      aria-haspopup="dialog"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <BookOpen className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold group-hover:text-primary">
                          {course.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {course.updatedAt
                            ? t('platform.teacher.updatedAt', {
                                date: formatUpdatedAt(course.updatedAt),
                              })
                            : t('platform.workbench.details')}
                        </span>
                      </span>
                    </button>
                    <span className="hidden text-sm tabular-nums sm:block">
                      {rowStats.passRate === null ? '—' : `${Math.round(rowStats.passRate * 100)}%`}
                    </span>
                    <Button variant="outline" asChild className="h-11 rounded-xl px-3">
                      <Link href={`/classroom/${course.id}`}>
                        <span className="hidden lg:inline">
                          {t(
                            student
                              ? 'platform.student.continue'
                              : 'platform.teacher.enterClassroom',
                          )}
                        </span>
                        <ArrowRight className="size-4" />
                        <span className="sr-only lg:hidden">
                          {t('platform.teacher.enterClassroom')} · {course.name}
                        </span>
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div
          className="border-t border-border px-5 py-3 text-xs text-muted-foreground"
          role="status"
        >
          {t('platform.design.courseCount', { count: rows.length })}
        </div>
      </section>
      <WorkspaceDrawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={t('platform.workbench.details')}
      >
        {selected && stats && (
          <div className="space-y-6">
            <div>
              <BookOpen className="mb-4 size-7 text-primary" />
              <h2 className="break-words text-2xl font-semibold leading-8">{selected.name}</h2>
              {selected.updatedAt && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('platform.teacher.updatedAt', { date: formatUpdatedAt(selected.updatedAt) })}
                </p>
              )}
            </div>
            <Button asChild className="h-12 w-full justify-between rounded-xl px-4">
              <Link href={`/classroom/${selected.id}`}>
                {t(student ? 'platform.student.continue' : 'platform.teacher.enterClassroom')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <CoursePreparationStatus key={`${selected.id}:${student}`} stageId={selected.id} student={student} />
            <dl className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
              {[
                [t('platform.teacher.versionLabel', { version: stats.version ?? '—' }), ''],
                [
                  t('platform.teacher.passRate'),
                  stats.passRate === null ? '—' : `${Math.round(stats.passRate * 100)}%`,
                ],
                [t('platform.teacher.statFeedback'), String(stats.feedbackCount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <details className="space-y-4 border-t border-border pt-4">
              <summary className="cursor-pointer text-base font-medium">实训要求与成果</summary>
              <TrainingTaskPanel key={`${selected.id}:${student}`} stageId={selected.id} title={selected.name} student={student} />
            </details>
            {onFeedback && (
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
                onClick={() => {
                  setSelected(null);
                  onFeedback(selected);
                }}
              >
                {t('platform.teacher.postClassFeedback')}
              </Button>
            )}
          </div>
        )}
      </WorkspaceDrawer>
    </>
  );
}

function CoursePreparationStatus({ stageId, student }: { stageId: string; student: boolean }) {
  const [state, setState] = useState<{ preset: boolean; outline?: AppDocumentOutline; stale: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDocumentStore().loadDocument(stageId).then(doc => {
      if (cancelled || !doc) return;
      const outline = doc.outline as AppDocumentOutline | undefined;
      // Recognize the provenance already saved by the retired example initializers.
      const preset = /^(MAIN-TICKET|AI-CODE|RETRY-TICKET|VISION-QC|WAREHOUSE-ROUTE)-\d/.test(doc.stage.description ?? '');
      setState({ preset, outline, stale: Boolean(outline?.validation && doc.stage.updatedAt > outline.validation.checkedAt) });
    }).catch(() => { /* Course access still uses the normal classroom error boundary. */ });
    return () => { cancelled = true; };
  }, [stageId]);
  if (!state || (!state.preset && (!state.outline?.validation || student))) return null;
  const validation = state.outline?.validation;
  return <section className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm" aria-label="课程准备状态">
    {state.preset && <p className="font-medium">预置示例／课程草稿</p>}
    {state.preset && <p className="text-muted-foreground">由已准备的资料与互动组成，学习成效以实际提交的成果为准。</p>}
    {!student && validation && <>
      <p>草稿已保存 · 结构{validation.structure === 'passed' ? '检查通过' : '待修正'} · {validation.interaction === 'passed' ? '所选互动用例通过' : validation.interaction === 'unavailable' ? '互动未验证（执行条件缺失）' : validation.interaction === 'failed' ? '互动待修正' : validation.interaction === 'not-run' ? '互动尚未检查' : '本次无互动检查'} · 教师待审阅</p>
      <p className="text-xs text-muted-foreground">检查时间：{new Date(validation.checkedAt).toLocaleString()}{state.stale ? '；课程之后已有更新，需要重新检查。' : '；此记录不代表学生已经掌握。'}</p>
      {validation.issues.length > 0 && <details><summary className="cursor-pointer">查看待处理项</summary><ul className="mt-2 list-disc space-y-1 pl-5">{validation.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
    </>}
    {!student && state.outline?.currentBrief && <details><summary className="cursor-pointer">查看当前委托</summary>
      <p className="mt-2">{state.outline.currentBrief.goal}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{state.outline.currentBrief.requirements.map(requirement => <li key={requirement.id}>{requirement.text}</li>)}</ul>
    </details>}
  </section>;
}
