import { resolveVocationalActive } from '@/lib/config/feature-flags';
import type { SceneOutline, UserRequirements } from '@/lib/types/generation';

/** Keep repeated course guidance before changing page inputs for prefix caching. */
export function withVocationalGenerationContext(user: string, context: string): string {
  return context ? `${context}\n\n${user}` : user;
}

/** Request-local guidance for the existing generation routes, never classroom/global memory. */
export function buildVocationalGenerationContext(
  requirements: UserRequirements | undefined,
  outline: SceneOutline,
  allOutlines: SceneOutline[],
): string {
  if (!resolveVocationalActive(requirements)) return '';

  const plan = allOutlines.map(({ order, title, type, keyPoints }) => ({
    order,
    title,
    type,
    keyPoints,
  }));
  const diagnosticGuidance =
    outline.type === 'quiz'
      ? '\nAssess this page\'s stated learning goal using its planned question count/types. Ground feedback in the relevant materials. Do not fabricate a learner score.'
      : outline.type === 'pbl'
        ? '\nBuild the planned project around its actual deliverable and learners. Use prior learning evidence only when supplied by the runtime; neither a competency graph nor a prior quiz is required. Never invent results.'
        : '';

  return `

## Vocational Course Continuity (current request only)
Follow the current outline's scene type and output schema. Generate this page only, preserving its role in the same job case; do not replace it with another four-part course.
Use this page's assigned teaching goal and relevant neighboring pages. Teaching methods and page counts follow the current request, not a fixed vocational sequence. Necessary concept explanations, worked examples and reflection are allowed. Do not invent a workplace for a non-job topic.
Use supplied sources for job demand, standards, safety limits and resources. If evidence or a curriculum baseline is absent, label recommendations as drafts for teacher confirmation. Do not invent live trends, source links, standard numbers, interviews or learner results.
Include only the source facts needed for this page. Preserve renderer-required fields internally; they do not require a checklist layout. Practice must respond to learner input with meaningful feedback and observable results.
Narration should briefly link the current page to its preceding outcome and next activity in plain teaching language. Do not read out competition or implementation labels.

Course plan (reference data):
${JSON.stringify(plan.filter(page => Math.abs(page.order - outline.order) <= 1))}

Current page: ${outline.order}. ${outline.title}${diagnosticGuidance}
`;
}
