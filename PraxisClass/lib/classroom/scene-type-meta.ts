import type { LucideIcon } from 'lucide-react';
import { BookOpen, ClipboardCheck, FlaskConical, ListChecks } from 'lucide-react';
import type { SceneType } from '@/lib/types/stage';

/**
 * Visual tone of a learning-path step. Colours resolve through the
 * `[data-scene-tone]` rules in `app/globals.css`, so components only set the
 * attribute and read `--scene-tone` / `--scene-tone-soft`.
 */
export type SceneTone = 'lecture' | 'practice' | 'task' | 'quiz';

export interface SceneTypeMeta {
  readonly tone: SceneTone;
  /** i18n key of the short page-type label (讲解 / 实操 / 任务 / 测验). */
  readonly labelKey: string;
  readonly icon: LucideIcon;
}

const SCENE_TYPE_META: Record<SceneType, SceneTypeMeta> = {
  slide: { tone: 'lecture', labelKey: 'classroomPath.types.lecture', icon: BookOpen },
  interactive: { tone: 'practice', labelKey: 'classroomPath.types.practice', icon: FlaskConical },
  pbl: { tone: 'task', labelKey: 'classroomPath.types.task', icon: ListChecks },
  quiz: { tone: 'quiz', labelKey: 'classroomPath.types.quiz', icon: ClipboardCheck },
};

/** Page-type presentation for a scene; unknown types read as a lecture page. */
export function getSceneTypeMeta(type: SceneType | string | undefined): SceneTypeMeta {
  return (type && SCENE_TYPE_META[type as SceneType]) || SCENE_TYPE_META.slide;
}

export type PathStepState = 'done' | 'current' | 'upcoming';

/** Position of a step relative to the page the learner is on. */
export function resolvePathStepState(index: number, currentIndex: number): PathStepState {
  if (currentIndex < 0 || index > currentIndex) return 'upcoming';
  return index === currentIndex ? 'current' : 'done';
}
