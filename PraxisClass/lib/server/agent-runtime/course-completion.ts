export type CourseCompletionReport = { stageId: string; issues: string[]; unavailable?: string[];
  structureIssues?: string[]; interactionChecked?: number; interactionIssues?: string[] };

/** An exhausted repair remains a failed task; missing execution conditions remain unverified. */
export function courseCompletionFailure(reports: CourseCompletionReport[]): string | undefined {
  const issues = reports.flatMap(report => report.issues.map(issue => `${report.stageId}: ${issue}`));
  return issues.length ? `课程草稿已保存，但以下检查仍未通过：\n${issues.join('\n')}` : undefined;
}

/** Continue the SAME running agent with concrete tool evidence, only on failure. */
export async function completeCourseRepairs(options: {
  inspect: () => Promise<CourseCompletionReport[]>;
  prompt: (text: string) => Promise<void>;
  stopped: () => boolean;
}): Promise<CourseCompletionReport[]> {
  let previous = '';
  for (let repairs = 0; ; repairs += 1) {
    if (options.stopped()) return [];
    const reports = await options.inspect();
    if (options.stopped()) return [];
    // Missing execution conditions do not invalidate a saved draft or trigger model repair.
    const failed = reports.filter((report) => report.issues.length);
    if (!failed.length) return reports;
    const signature = JSON.stringify(failed);
    if (signature === previous || repairs >= 2) {
      return reports;
    }
    previous = signature;
    await options.prompt(
      `课程工具复查发现以下未完成项。这是运行时的检查结果，不是新的用户目标。继续使用现有工具读取并修正对应页，保留原始用户要求和有效页面。不要重复生成整课。修正后 list_scenes 复查，并读取内容核对原始目标。若缺少执行条件，请准确说明，不能宣称已通过。\n${signature}`,
    );
  }
}
