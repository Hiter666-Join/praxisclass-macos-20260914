import type { RuntimeStore } from '@praxis/storage';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { readStageMeta } from '@/lib/persistence/stage-meta';
import { appendTrainingFact, ensureTrainingSession } from '@/lib/training/runtime';
import {
  submissionSchema,
  trainingPayloadSchema,
  explanationSchema,
  type Submission,
} from '@/lib/training/payload';
import { TrainingDao, getTrainingDao, type TaskRow, type EvidenceRow } from './dao';
import { TrainingError, conflict, notFound } from './errors';
import { readTrainingSourceText } from './sources';
import { hasChoiceRule, evaluateChoiceRule, isChoiceRuleCompatible } from './choice-rules';
import { codeEvidenceSchema, codeFunctionalResult } from '@/lib/training/code-acceptance';
import { isSimulationCase, simulationSchemas, simulationParts, simulationRule } from '@/lib/training/simulation-evidence';
import {
  validateQuestionAnswers,
  questionRecordRef,
  saveQuestionOriginal,
} from '@/lib/training/question-submission';
import {
  canonical,
  studentPlan,
  type TeachingPlan,
  type EvidenceInput,
  type Assessment,
  type Processing,
} from './contracts';

export interface TrainingActor {
  ownerId: string;
  learnerKey: string;
  role: 'teacher' | 'student';
}
export interface TrainingDependencies {
  dao: TrainingDao;
  runtime: RuntimeStore;
  validateActivities: (plan: TeachingPlan, ownerId: string) => Promise<void>;
  validateSources: (plan: TeachingPlan, ownerId: string) => Promise<void>;
  readSourceText?: (source: TeachingPlan['sources'][number], ownerId: string) => Promise<string>;
}
function teacher(actor: TrainingActor): void {
  if (actor.role !== 'teacher')
    throw new TrainingError(403, 'TEACHER_REQUIRED', '请在教师侧编辑实训安排。');
}
function parsePlan(json: string): TeachingPlan {
  return JSON.parse(json) as TeachingPlan;
}

export function validatePlanReferences(plan: TeachingPlan): void {
  const errors: { path: string; message: string }[] = [];
  const fail = (path: string, message: string) => errors.push({ path, message });
  for (const [name, values] of Object.entries({
    outputs: plan.outputs.map((item) => item.id),
    checks: plan.checks.map((item) => item.id),
    competencies: plan.competencies.map((item) => item.id),
    sources: plan.sources.map((item) => item.sourceId),
    activities: plan.activities.map((item) => item.sceneId),
  }))
    if (new Set(values).size !== values.length) fail(name, '编号必须唯一。');
  if (
    !plan.outputs.length ||
    !plan.activities.length ||
    !plan.checks.length ||
    !plan.competencies.length
  )
    fail('content', '必须具备成果、活动、能力与检查项。');
  const sources = new Set(plan.sources.map((source) => source.sourceId));
  const checks = new Set(plan.checks.map((check) => check.id));
  const activities = new Map(plan.activities.map((activity) => [activity.sceneId, activity]));
  const outputs = new Map(plan.outputs.map((output) => [output.id, output]));
  for (const check of plan.checks) {
    if (!check.criterion.trim()) fail(`checks.${check.id}`, '请填写检查依据。');
    if (check.sourceRefs.some((id) => !sources.has(id)))
      fail(`checks.${check.id}.sourceRefs`, '引用的资料不存在。');
    if (
      check.evaluator === 'rule' &&
      check.ruleId !== 'submission-complete' &&
      check.ruleId !== 'code-functional-v1' &&
      !['retry-simulation-v1', 'vision-simulation-v1', 'warehouse-simulation-v1'].includes(check.ruleId ?? '') &&
      !hasChoiceRule(check.ruleId ?? '')
    )
      fail(`checks.${check.id}.ruleId`, '当前规则尚未接入，不能执行任意规则标识。');
    if (
      check.evaluator === 'rule' &&
      hasChoiceRule(check.ruleId ?? '') &&
      !isChoiceRuleCompatible(check.ruleId!, plan.outputs)
    )
      fail(`checks.${check.id}.ruleId`, '题目或选项已变化，不能继续使用原版本的固定评价规则。');
    if (check.ruleId === 'code-functional-v1' && !plan.outputs.some((output) => output.interaction === 'ai-code' && output.checkRefs.includes(check.id)))
      fail(`checks.${check.id}.ruleId`, '代码验收规则必须关联代码实训成果。');
    for (const caseId of ['retry', 'vision', 'warehouse']) {
      if (check.ruleId === `${caseId}-simulation-v1` && !plan.outputs.some((output) => output.interaction === caseId && output.checkRefs.includes(check.id)))
        fail(`checks.${check.id}.ruleId`, '规则必须关联对应的实训成果。');
    }
  }
  for (const output of plan.outputs) {
    if (output.questions) {
      const ids = output.questions.map((question) => question.id);
      if (new Set(ids).size !== ids.length || output.requiredParts.some((id) => !ids.includes(id)))
        fail(`outputs.${output.id}.questions`, '必需作答必须对应唯一题目。');
      for (const question of output.questions) {
        if (
          question.type !== 'short_answer' &&
          (!question.options?.length ||
            new Set(question.options.map((option) => option.value)).size !==
              question.options.length)
        )
          fail(`outputs.${output.id}.questions`, '选择题需要互不重复的选项。');
      }
    }
    if (
      !output.requiredParts.length ||
      !output.activityRefs.length ||
      !output.checkRefs.length ||
      output.checkRefs.some((id) => !checks.has(id)) ||
      output.activityRefs.some((id) => activities.get(id)?.outputGroupId !== output.id)
    )
      fail(`outputs.${output.id}`, '成果的内容、活动与检查引用不完整。');
  }
  for (const activity of plan.activities) {
    if (
      !outputs.get(activity.outputGroupId)?.activityRefs.includes(activity.sceneId) ||
      activity.checkRefs.some((id) => !checks.has(id))
    )
      fail(`activities.${activity.sceneId}`, '活动关联不完整。');
  }
  for (const competency of plan.competencies)
    if (!competency.checkIds.length || competency.checkIds.some((id) => !checks.has(id)))
      fail(`competencies.${competency.id}`, '能力必须关联有效检查项。');
  if (
    new Set(plan.orderedActivityRefs).size !== plan.activities.length ||
    plan.orderedActivityRefs.length !== plan.activities.length ||
    plan.orderedActivityRefs.some((id) => !activities.has(id))
  )
    fail('orderedActivityRefs', '活动顺序必须包含每项活动且不重复。');
  if (errors.length)
    throw new TrainingError(422, 'PLAN_INCOMPLETE', '实训安排还有未完成项。', errors);
}

export class TrainingService {
  constructor(readonly deps: TrainingDependencies) {}
  taskView(task: TaskRow, actor: TrainingActor, revision?: number) {
    if (actor.role === 'teacher') this.deps.dao.ownedTask(task.id, actor.ownerId);
    const selectedRevision = revision ?? task.active_revision;
    if (actor.role === 'student' && !selectedRevision) notFound();
    const content = selectedRevision
      ? parsePlan(this.deps.dao.revision(task.id, selectedRevision).content_json)
      : null;
    return {
      id: task.id,
      activeRevision: task.active_revision,
      revision: selectedRevision,
      content: content && (actor.role === 'teacher' ? content : studentPlan(content)),
      ...(actor.role === 'teacher'
        ? { draft: parsePlan(task.draft_json), draftSeq: task.draft_seq }
        : {}),
    };
  }
  getTask(id: string, actor: TrainingActor, revision?: number) {
    return this.taskView(this.deps.dao.task(id), actor, revision);
  }
  async readSource(id: string, sourceId: string, actor: TrainingActor, revision?: number) {
    const task = this.deps.dao.task(id);
    const view = this.taskView(task, actor, revision);
    const source = view.content?.sources.find((item) => item.sourceId === sourceId) ?? notFound();
    if (!this.deps.readSourceText)
      throw new TrainingError(503, 'SOURCE_UNAVAILABLE', '资料读取服务暂不可用。');
    return {
      sourceId: source.sourceId,
      title: source.title,
      locator: source.locator,
      basisType: source.basisType,
      text: await this.deps.readSourceText(source, task.owner_id),
      planRevision: view.revision,
    };
  }
  listTasks(actor: TrainingActor, stageId?: string) {
    if (actor.role === 'student' && !stageId)
      throw new TrainingError(422, 'STAGE_REQUIRED', '请从当前课堂读取实训。');
    return this.deps.dao
      .listTasks(actor.role === 'teacher' ? actor.ownerId : undefined, stageId)
      .map((task) => this.taskView(task, actor));
  }
  createTask(actor: TrainingActor, input: { requestId: string; content: TeachingPlan }) {
    teacher(actor);
    return this.taskView(
      this.deps.dao.create(actor.ownerId, input.requestId, input.content),
      actor,
    );
  }
  saveDraft(id: string, actor: TrainingActor, input: Parameters<TrainingDao['saveDraft']>[2]) {
    teacher(actor);
    return this.deps.dao.saveDraft(id, actor.ownerId, input);
  }
  async applyTask(id: string, actor: TrainingActor, input: Parameters<TrainingDao['apply']>[2]) {
    teacher(actor);
    const task = this.deps.dao.ownedTask(id, actor.ownerId);
    const previous = this.deps.dao.appliedRequest(id, input);
    if (!previous) {
      if (
        task.draft_seq !== input.expectedDraftSeq ||
        task.active_revision !== input.expectedActiveRevision
      )
        conflict();
      const plan = parsePlan(task.draft_json);
      validatePlanReferences(plan);
      await this.deps.validateActivities(plan, actor.ownerId);
      await this.deps.validateSources(plan, actor.ownerId);
      for (const evidenceId of plan.basedOnEvidenceIds) {
        const evidence = this.deps.dao.evidence(evidenceId);
        if (
          !evidence ||
          evidence.task_id !== id ||
          JSON.parse(evidence.processing_json).saved !== 'server'
        )
          throw new TrainingError(
            422,
            'EVIDENCE_UNAVAILABLE',
            '调整依据必须是本任务已保存的成果。',
          );
      }
    }
    // The DAO rechecks the draft and active revision after asynchronous resource validation.
    const revision = this.deps.dao.apply(id, actor.ownerId, input);
    return {
      revision: revision.revision,
      appliedChanges: parsePlan(revision.content_json).changeReason,
      warnings: [],
    };
  }
  authorizeEvidence(row: EvidenceRow, actor: TrainingActor) {
    if (actor.role === 'teacher') this.deps.dao.ownedTask(row.task_id, actor.ownerId);
    else if (row.learner_key !== actor.learnerKey) notFound();
  }
  async validateNativeRefs(input: EvidenceInput, actor: TrainingActor) {
    for (const ref of input.sourceRecordRefs) {
      const session = await this.deps.runtime.getSession(ref.sessionId);
      if (
        !session ||
        session.stageId !== input.stageId ||
        session.learnerKey !== actor.learnerKey ||
        !['quizAttempt', 'pbl'].includes(session.kind)
      )
        notFound();
      const record = (await this.deps.runtime.listRecords(ref.sessionId)).find(
        (item) => item.id === ref.recordId,
      );
      if (!record || record.sceneId !== input.sceneId) notFound();
      const payload = record.payload as { phase?: string; type?: string; answers?: unknown };
      if (
        payload.phase !== 'submitted' &&
        payload.phase !== 'reviewed' &&
        payload.type !== 'submission_created'
      )
        throw new TrainingError(422, 'NATIVE_SUBMISSION_REQUIRED', '原始作答尚未提交保存。');
      if (payload.answers !== undefined && canonical(payload.answers) !== canonical(input.submittedContent))
        conflict('成果内容与所引用的原始作答不同，请提交对应的新原文。');
    }
  }
  async saveEvidence(input: EvidenceInput, actor: TrainingActor) {
    if (actor.role !== 'student')
      throw new TrainingError(403, 'STUDENT_REQUIRED', '请切换到学生侧完成本次实训。');
    const plan = parsePlan(this.deps.dao.revision(input.taskId, input.planRevision).content_json);
    const output = plan.outputs.find((item) => item.id === input.outputGroupId);
    const activity = plan.activities.find(
      (item) =>
        item.sceneId === input.sceneId &&
        item.stageId === input.stageId &&
        item.outputGroupId === input.outputGroupId,
    );
    if (!output || !activity)
      throw new TrainingError(422, 'INVALID_BINDING', '本次作答与方案中的活动或成果不对应。');
    if (
      Object.keys(input.submittedContent).length === 0 ||
      canonical(input.submittedContent).length > 120000
    )
      throw new TrainingError(
        422,
        'INVALID_SUBMISSION',
        '请填写成果内容，单次内容不能超过120000字符。',
      );
    validateQuestionAnswers(output, input.submittedContent);
    if (output.interaction === 'ai-code') codeEvidenceSchema.parse(input.submittedContent['验收记录']);
    if (isSimulationCase(output.interaction)) simulationSchemas[output.interaction].parse(input.submittedContent[simulationParts[output.interaction]]);
    const managedQuestions = Boolean(output.questions?.length || output.interaction);
    if (input.supersedesEvidenceId) {
      const old = await this.getEvidence(input.supersedesEvidenceId, actor);
      if (
        old.submission &&
        canonical(old.submission.submittedContent) === canonical(input.submittedContent) &&
        (managedQuestions ||
          canonical(old.submission.sourceRecordRefs) === canonical(input.sourceRecordRefs))
      )
        conflict('内容尚未修改，请重试原成果，无需新增修订。');
    }
    const recordKind = actor.learnerKey.startsWith('demo:') ? 'demo' : 'learning';
    if (managedQuestions)
      input = { ...input, sourceRecordRefs: [questionRecordRef(input.evidenceId)] };
    const row = this.deps.dao.reserveEvidence(input, actor.learnerKey, recordKind);
    if (managedQuestions)
      await saveQuestionOriginal(this.deps.runtime, row, input.submittedContent);
    await this.validateNativeRefs(input, actor);
    const visible = studentPlan(plan);
    const checkIds = new Set(output.checkRefs);
    const snapshot: TeachingPlan = {
      ...visible,
      outputs: [output],
      activities: visible.activities.filter((item) => item.outputGroupId === output.id),
      checks: visible.checks.filter((check) => checkIds.has(check.id)),
      competencies: visible.competencies.filter((item) =>
        item.checkIds.some((id) => checkIds.has(id)),
      ),
      orderedActivityRefs: visible.orderedActivityRefs.filter((id) =>
        output.activityRefs.includes(id),
      ),
      sources: visible.sources.filter((source) =>
        visible.checks.some(
          (check) => checkIds.has(check.id) && check.sourceRefs.includes(source.sourceId),
        ),
      ),
    };
    const submission: Submission = {
      ...input,
      type: 'submission',
      payloadVersion: 1,
      recordKind,
      origin: 'live_submission',
      contextSnapshot: snapshot,
      submittedAt: new Date(row.created_at).toISOString(),
    };
    await ensureTrainingSession(this.deps.runtime, row);
    await appendTrainingFact(this.deps.runtime, row, row.submission_record_id, submission);
    return this.getEvidence(row.evidence_id, actor);
  }
  initialAssessment(submission: Submission): Assessment {
    const plan = submission.contextSnapshot;
    const output = plan.outputs[0];
    const complete = output.requiredParts.every((key) => {
      const value = submission.submittedContent[key];
      return typeof value === 'string'
        ? value.trim().length > 0
        : value !== undefined && value !== null;
    });
    const checkResults: Assessment['checkResults'] = plan.checks.map((check) => {
      const code = check.evaluator === 'rule' && check.ruleId === 'code-functional-v1'
        ? codeFunctionalResult(codeEvidenceSchema.parse(submission.submittedContent['验收记录'])) : null;
      const simulation = check.evaluator === 'rule' && isSimulationCase(output.interaction) && check.ruleId === `${output.interaction}-simulation-v1`
        ? simulationRule(output.interaction, submission.submittedContent[simulationParts[output.interaction]]) : null;
      const choice =
        check.evaluator === 'rule'
          ? evaluateChoiceRule(check.ruleId ?? '', output, submission.submittedContent)
          : null;
      return {
        checkId: check.id,
        checkRevision: check.revision,
        method: check.evaluator,
        status:
          simulation?.status ?? code?.status ?? choice?.status ??
          (check.evaluator === 'rule' && check.ruleId === 'submission-complete'
            ? complete
              ? 'passed'
              : 'failed'
            : 'unknown'),
        basis:
          simulation?.basis ?? code?.basis ?? choice?.basis ??
          (check.evaluator === 'rule' && check.ruleId === 'submission-complete'
            ? complete
              ? '本次提交包含规定内容；完整性不代表开放回答已经达标。'
              : '本次提交缺少规定内容。'
            : '当前开放回答尚未按标准完成评阅，保留待确认。'),
      };
    });
    return {
      type: 'assessment',
      payloadVersion: 1,
      evidenceId: submission.evidenceId,
      evaluationId: `initial:${submission.evidenceId}`,
      assessmentRevision: 1,
      checkResults,
      competencyResults: plan.competencies.map((item) => {
        const required = item.checkIds.filter(
          (id) => plan.checks.find((check) => check.id === id)?.required,
        );
        const statuses = required.map(
          (id) => checkResults.find((result) => result.checkId === id)?.status ?? 'unknown',
        );
        return {
          competencyId: item.id,
          status: statuses.includes('failed')
            ? 'needs_work'
            : statuses.length > 0 && statuses.every((status) => status === 'passed')
              ? 'achieved'
              : 'pending',
        };
      }),
      basisRefs: plan.sources.map((source) => source.sourceId),
      createdAt: submission.submittedAt,
    };
  }
  async getEvidence(id: string, actor: TrainingActor) {
    const row = this.deps.dao.evidence(id) ?? notFound();
    this.authorizeEvidence(row, actor);
    const session = await this.deps.runtime.getSession(row.runtime_session_id);
    if (
      session &&
      (session.learnerKey !== row.learner_key ||
        session.stageId !== row.stage_id ||
        session.kind !== 'trainingEvidence')
    )
      conflict();
    const records = session ? await this.deps.runtime.listRecords(row.runtime_session_id) : [];
    const rawSubmission = records.find((item) => item.id === row.submission_record_id);
    const submission = rawSubmission ? submissionSchema.parse(rawSubmission.payload) : null;
    let assessment: Assessment | null = null;
    let explanation: ReturnType<typeof explanationSchema.parse> | null = null;
    const processing: Processing = {
      saved: submission ? 'server' : 'none',
      assessment: 'not_started',
      explanation: 'not_requested',
      index: 'pending',
    };
    if (submission) {
      if (
        submission.evidenceId !== id ||
        submission.taskId !== row.task_id ||
        submission.planRevision !== row.plan_revision ||
        submission.nativeAttemptId !== row.native_attempt_id
      )
        conflict('原始提交与索引不一致。');
      const existing = records
        .map((item) => ({ record: item, parsed: trainingPayloadSchema.safeParse(item.payload) }))
        .filter(
          (item) =>
            item.parsed.success &&
            item.parsed.data.type === 'assessment' &&
            item.parsed.data.evidenceId === id,
        );
      assessment = existing.length
        ? (existing.at(-1)!.parsed.data as Assessment)
        : this.initialAssessment(submission);
      const assessmentId = existing.at(-1)?.record.id ?? `assessment:initial:${id}`;
      try {
        if (!existing.length)
          await appendTrainingFact(this.deps.runtime, row, assessmentId, assessment);
        processing.assessment = assessment.checkResults.some(
          (result) => result.status === 'unknown',
        )
          ? 'partial'
          : 'ready';
        const matchedExplanation = records
          .map((record) => explanationSchema.safeParse(record.payload))
          .findLast(
            (item) =>
              item.success &&
              item.data.evidenceId === id &&
              item.data.assessmentRecordId === assessmentId,
          );
        explanation = matchedExplanation?.success ? matchedExplanation.data : null;
        processing.explanation = explanation
          ? 'ready'
          : assessmentId.startsWith('assessment:agent:')
            ? 'pending'
            : 'not_requested';
      } catch (error) {
        if (error instanceof TrainingError) throw error;
        processing.assessment = 'failed';
        assessment = null;
      }
      // Runtime facts and the SQLite list projection can fail independently.
      try {
        processing.index = 'ready';
        this.deps.dao.updateProcessing(id, processing, assessment ? assessmentId : null);
      } catch (error) {
        if (error instanceof TrainingError) throw error;
        processing.index = 'failed';
      }
    }
    return {
      evidenceId: id,
      taskId: row.task_id,
      learnerKey: row.learner_key,
      recordKind: row.record_kind,
      planRevision: row.plan_revision,
      outputGroupId: row.output_group_id,
      processing,
      submission,
      assessment,
      explanation,
    };
  }
  listEvidence(
    taskId: string,
    actor: TrainingActor,
    options: {
      scope: 'self' | 'teacher';
      recordKind: 'demo' | 'learning';
      outputGroupId?: string;
      cursor?: string;
    },
  ) {
    this.deps.dao.task(taskId);
    if (options.scope === 'teacher') {
      teacher(actor);
      this.deps.dao.ownedTask(taskId, actor.ownerId);
    }
    const rows = this.deps.dao.listEvidence(taskId, {
      ...options,
      learnerKey: options.scope === 'teacher' ? undefined : actor.learnerKey,
    });
    const items = rows.slice(0, 50).map((row) => ({
      evidenceId: row.evidence_id,
      learnerKey: row.learner_key,
      outputGroupId: row.output_group_id,
      planRevision: row.plan_revision,
      recordKind: row.record_kind,
      createdAt: row.created_at,
      processing: JSON.parse(row.processing_json) as Processing,
      supersedesEvidenceId: row.supersedes_id,
    }));
    return {
      items,
      nextCursor: rows.length > 50 ? items.at(-1)!.evidenceId : null,
      savedCountInPage: items.filter((item) => item.processing.saved === 'server').length,
      pendingCountInPage: items.filter((item) => item.processing.saved !== 'server').length,
    };
  }
}

export async function getTrainingService(): Promise<TrainingService> {
  const dao = await getTrainingDao();
  if (!process.env.DATABASE_URL)
    throw new TrainingError(
      503,
      'TRAINING_RUNTIME_UNAVAILABLE',
      '共享成果需要当前环境的服务端运行存储。',
    );
  const provider = await getServerPersistenceProvider(process.env.DATABASE_URL);
  return new TrainingService({
    dao,
    runtime: provider.runtimeStore,
    validateActivities: async (plan, ownerId) => {
      for (const activity of plan.activities) {
        const meta = await readStageMeta(provider.pool, activity.stageId);
        if (!meta || meta.ownerId !== ownerId || meta.deletedAt)
          throw new TrainingError(
            422,
            'ACTIVITY_UNAVAILABLE',
            '关联课堂必须属于当前教师且可以读取。',
          );
        const scene = await provider.documentStore.getScene(activity.stageId, activity.sceneId);
        if (!scene) throw new TrainingError(422, 'ACTIVITY_UNAVAILABLE', '实训活动尚未就绪。');
      }
    },
    validateSources: async (plan, ownerId) => {
      for (const source of plan.sources) {
        const original = await readTrainingSourceText(provider.pool, source, ownerId);
        if (!source.excerpt.trim() || !original.includes(source.excerpt)) {
          throw new TrainingError(
            422,
            'SOURCE_EXCERPT_MISMATCH',
            '资料摘录必须来自当前选择的上传原文，请重新选择文件。',
          );
        }
      }
    },
    readSourceText: (source, ownerId) => readTrainingSourceText(provider.pool, source, ownerId),
  });
}
