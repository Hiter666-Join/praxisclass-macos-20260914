import fs from 'node:fs';
import path from 'node:path';
import type { AICallFn } from '@praxis/generation';
import type { SceneOutline, UserRequirements } from '@/lib/types/generation';
import { resolveVocationalActive } from '@/lib/config/feature-flags';
import { checkOutlineAgainstSkill, type OutlineConstraints } from './agent-runtime/skills';
import { GenerationQualityError } from './generation-content-quality';
import { loadVocationalSkillBody } from './vocational-skill';
import { createLogger } from '@/lib/logger';

const log = createLogger('Plan review');
type Coverage = { quote: string; sceneIds: string[] };
type Review = {
  requirements: Coverage[];
  updates?: Array<Partial<SceneOutline> & { id: string }>;
  additions?: Array<{ afterId: string; outline: SceneOutline }>;
  unresolved?: string[];
};

function parseReview(response: string): Review {
  let review: Review;
  try {
    review = JSON.parse(response.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    throw new GenerationQualityError(['目标核对未返回有效 JSON']);
  }
  if (!review || typeof review !== 'object' ||
    (review.updates !== undefined && !Array.isArray(review.updates)) ||
    (review.additions !== undefined && !Array.isArray(review.additions)) ||
    (review.unresolved !== undefined && (!Array.isArray(review.unresolved) || review.unresolved.some(item => typeof item !== 'string')))) {
    throw new GenerationQualityError(['目标核对的更新列表格式无效']);
  }
  return review;
}

function applyReview(original: SceneOutline[], review: Review): SceneOutline[] {
  const outlines = original.map(page => ({ ...page }));
  for (const update of review.updates ?? []) {
    const index = outlines.findIndex(page => page.id === update?.id);
    if (index < 0) throw new GenerationQualityError(['目标修复引用了不存在的页面']);
    const before = outlines[index];
    outlines[index] = { ...before, ...update, id: before.id, order: before.order,
      ...(update.widgetOutline ? { widgetOutline: { ...before.widgetOutline, ...update.widgetOutline } } : {}),
      ...(update.quizConfig ? { quizConfig: { ...before.quizConfig, ...update.quizConfig } } : {}),
      ...(update.pblConfig ? { pblConfig: { ...before.pblConfig, ...update.pblConfig } } : {}),
    };
  }
  for (const addition of review.additions ?? []) {
    const index = outlines.findIndex(page => page.id === addition?.afterId);
    if (index < 0 || !addition.outline?.id || outlines.some(page => page.id === addition.outline.id)) {
      throw new GenerationQualityError(['新增目标页面的位置或 ID 无效']);
    }
    outlines.splice(index + 1, 0, { ...addition.outline });
  }
  outlines.forEach((page, index) => { page.order = index + 1; });
  return outlines;
}

export function checkGenerationPlan(outlines: SceneOutline[], requirements: UserRequirements): string[] {
  const issues: string[] = [];
  if (!Array.isArray(outlines) || outlines.some(page => !page || typeof page !== 'object')) {
    return ['大纲必须是页面对象数组，不能包含空值'];
  }
  if (!outlines.length) issues.push('课程没有页面');
  if (new Set(outlines.map(page => page.id)).size !== outlines.length) issues.push('页面 ID 重复');
  if (outlines.some((page, index) => page.order !== index + 1)) issues.push('页面顺序必须从 1 连续排列且不能重复');
  for (const page of outlines) {
    if (typeof page.id !== 'string' || !page.id.trim() || typeof page.title !== 'string' || !page.title.trim() || !['slide', 'interactive', 'quiz', 'pbl'].includes(page.type)) {
      issues.push(`第 ${page.order} 页缺少有效 ID、标题或类型`);
    }
  }
  if (!resolveVocationalActive(requirements)) return issues;
  const constraints = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'skills/agent-runtime/vocational/outline-constraints.json'), 'utf8')) as OutlineConstraints;
  issues.push(...checkOutlineAgainstSkill(outlines, constraints));
  const practice = outlines.filter(page => page.widgetType === 'procedural-skill');
  for (const page of practice) {
    for (const field of ['tools', 'steps', 'successCriteria', 'errorConsequences'] as const) {
      if (!page.widgetOutline?.[field]?.length) issues.push(`第 ${page.order} 页缺少 ${field}`);
    }
  }
  return issues;
}

/** Legacy pipeline only: repair concrete structural gaps; valid plans cost no extra model call. */
export async function reviewGenerationPlan(
  original: SceneOutline[],
  requirements: UserRequirements,
  call: AICallFn,
  sourceContext?: unknown,
): Promise<{ outlines: SceneOutline[]; coverage: Coverage[]; changedPages: number; repairCalls: number; elapsedMs: number }> {
  const started = Date.now();
  const issues = checkGenerationPlan(original, requirements);
  if (!issues.length) {
    return { outlines: original, coverage: [], changedPages: 0, repairCalls: 0, elapsedMs: Date.now() - started };
  }
  const skill = resolveVocationalActive(requirements) ? loadVocationalSkillBody() : '';
  const response = await call(
    `Review a classroom plan against the ORIGINAL user request and active course rules before any page is generated.
Extract every concrete user requirement (content, named technology, audience, deliverable, interaction, quantity and acceptance conditions). requirements[].quote must be a verbatim excerpt from the request; sceneIds must identify the pages that actually teach or implement it. A title mentioning a topic is not sufficient coverage. Fill missing objectives in description/keyPoints/widgetOutline/quizConfig/pblConfig so downstream generators can implement them.
Apply minimal outline updates to address omissions and machine-check issues. Preserve existing IDs, valid fields, page roles and the user's requested scope. Add pages only where the current request needs them. Do not delete pages or rewrite unrelated ones. Skill teaching methods are optional; retain its data-validity and truthful-execution requirements. Explicit user instructions override design defaults; explain any unresolved conflict rather than silently omitting a goal. For code tasks, do not substitute keyword matching for requested execution. Do not invent learner results, sources or unavailable services.
Return only JSON: {"requirements":[{"quote":"exact user clause","sceneIds":["existing-or-added-id"]}],"updates":[{"id":"existing-id","description":"updated only if needed","keyPoints":["complete updated list"],"widgetOutline":{"task":"task if missing","steps":["concrete steps"],"successCriteria":["observable criteria"]}}],"additions":[{"afterId":"existing-id","outline":{complete new outline}}],"unresolved":[]}.
updates may contain any needed SceneOutline fields but must keep id. additions must include unique ids. Return empty updates/additions if already complete. Do not put satisfied requirements into unresolved.
${skill}`,
    JSON.stringify({ request: requirements.requirement, knowledgeContext: requirements.knowledgeContext, sourceContext, issues, outlines: original }),
  );
  const review = parseReview(response);
  let outlines = applyReview(original, review);
  const structuralIssues = checkGenerationPlan(outlines, requirements);
  let repairCalls = 0;
  let changedPages = (review.updates?.length ?? 0) + (review.additions?.length ?? 0);
  if (structuralIssues.length) {
    const repaired = parseReview(await call(
      'Fill the remaining machine-reported gaps in this already-reviewed course plan. Return only JSON {"updates":[{"id":"existing id","widgetOutline":{"task":"concrete task","steps":["concrete steps"],"successCriteria":["observable outcome"]}}],"additions":[]}. Use nested objects, never dotted property names. Include only fields actually needing correction, preserving specialized widget fields and every valid page. Every reported field must be populated with real teaching content. Do not repeat the full plan or the requirement review. Structural missing-page issues may use additions with {afterId,outline}.',
      JSON.stringify({ request: requirements.requirement, issues: structuralIssues, outlines }),
    ));
    repairCalls = 1;
    outlines = applyReview(outlines, repaired);
    changedPages += (repaired.updates?.length ?? 0) + (repaired.additions?.length ?? 0);
  }
  const remaining = [...checkGenerationPlan(outlines, requirements), ...(review.unresolved ?? [])];
  if (!Array.isArray(review.requirements) || !review.requirements.length) {
    remaining.push('没有返回用户要求与页面的对应关系');
  } else {
    for (const item of review.requirements) {
      if (!item.quote || !requirements.requirement.includes(item.quote) || !Array.isArray(item.sceneIds) || !item.sceneIds.length || item.sceneIds.some(id => !outlines.some(page => page.id === id))) {
        remaining.push('目标核对包含无来源的要求、缺失的对应页或无效页面 ID');
      }
    }
  }
  const elapsedMs = Date.now() - started;
  log.info('Requirement review', { pages: outlines.length, changedPages, elapsedMs, reviewCalls: 1, repairCalls, passed: remaining.length === 0 });
  if (remaining.length) throw new GenerationQualityError(remaining);
  return { outlines, coverage: review.requirements, changedPages, repairCalls, elapsedMs };
}
