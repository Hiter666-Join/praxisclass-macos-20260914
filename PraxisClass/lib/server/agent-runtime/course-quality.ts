import type { CourseDocument } from './course-tools';
import type { AppDocumentOutline } from '@/lib/document-store/persistence-types';
import { checkInteractiveScripts } from '@/lib/server/generation-content-quality';
import { matchOutlineEntries } from './course-outline-union';
import { checkScenesAgainstSkill, type OutlineConstraints } from './skills';
import type { Scene } from '@/lib/types/stage';
import type { SceneOutline } from '@/lib/types/generation';

/** Reused by writes and completion so a saved patch cannot mask a known failure. */
export function inspectSceneQuality(scene: Scene, planned?: SceneOutline) {
  const issues: string[] = [];
  if (scene.content.type === 'quiz' && planned?.quizConfig?.questionCount !== undefined &&
    scene.content.questions.length !== planned.quizConfig.questionCount) {
    issues.push(`第 ${scene.order} 页测验应有 ${planned.quizConfig.questionCount} 题，实际 ${scene.content.questions.length} 题`);
  }
  const scriptErrors = scene.content.type === 'interactive' && scene.content.html
    ? checkInteractiveScripts(scene.content.html) : [];
  issues.push(...scriptErrors.map(error => `第 ${scene.order} 页 (${scene.id}): ${error}`));
  return { issues, scriptErrors };
}

/** Deterministic evidence for the running agent, never an extra reviewer model. */
export function inspectCourseQuality(doc: CourseDocument, constraints: OutlineConstraints | null = null) {
  const plan = doc.outline as AppDocumentOutline | undefined;
  const issues = checkScenesAgainstSkill(doc.scenes, constraints);
  if (plan?.generationComplete === false) {
    const matched = new Set(matchOutlineEntries(doc.scenes, plan.outlines ?? []).values());
    for (const [index, page] of (plan.outlines ?? []).entries()) {
      if (!matched.has(index)) issues.push(`第 ${page.order} 页 ${page.title} 尚未生成`);
    }
  }
  const pages = [...doc.scenes].sort((a, b) => a.order - b.order).map(scene => {
    const planned = plan?.outlines?.find(page => page.id === scene.outlineId || page.order === scene.order);
    const checked = inspectSceneQuality(scene, planned);
    issues.push(...checked.issues);
    return { id: scene.id, order: scene.order, title: scene.title, type: scene.type,
      actionCount: scene.actions?.length ?? 0, scriptErrors: checked.scriptErrors };
  });
  return { stageId: doc.stage.id, requirement: plan?.requirement ?? '', pageCount: pages.length,
    pages, issues, passed: issues.length === 0,
    scope: '页面完整性、Skill 结构及内联脚本语法。未执行交互，也未判定教学目标的语义覆盖；须按原始要求读取内容核对。' };
}
