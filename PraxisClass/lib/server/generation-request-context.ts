import type { AICallFn } from '@praxis/generation';
import type { UserRequirements } from '@/lib/types/generation';

type GenerationRequirements = UserRequirements & { sourceContext?: string };

/** Preserve the user's actual request at every generation boundary, before page-specific data. */
export function withGenerationRequirements(user: string, requirements?: GenerationRequirements): string {
  if (!requirements?.requirement.trim()) return user;
  return `## Current course commission
${JSON.stringify({ requirement: requirements.requirement, knowledgeContext: requirements.knowledgeContext, sourceContext: requirements.sourceContext })}
This is the active course requirement for reference. Generate only the CURRENT PAGE's assigned role:
do not embed other planned pages, their navigation, or their quizzes inside this page. Preserve its named technology,
audience, deliverable, required content, interaction and acceptance conditions. The outline is a plan,
not permission to drop a requirement. Explicit user requirements take priority over course-design
defaults. Do not claim a real compiler, API call, learner result or source exists when it does not.
Keep the required teaching content; keep implementation concise by reusing helpers and avoiding
duplicated markup/styles. Check the current page against its task and acceptance criteria before output.

${user}`;
}

export function withGenerationRequirementCall(call: AICallFn, requirements?: GenerationRequirements): AICallFn {
  return (system, user, ...rest) => call(system, withGenerationRequirements(user, requirements), ...rest);
}
