import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { builtinEnvironments } from 'vitest/runtime';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { BrowserRuntimeStore } from '@praxis/storage';
import type { SqliteDatabase } from '@/lib/platform/db/client';
import { PLATFORM_SCHEMA } from '@/lib/platform/db/schema';
import { TrainingDao } from '@/lib/platform/training/dao';
import { TrainingService, type TrainingActor } from '@/lib/platform/training/service';
import { type TeachingPlan, type EvidenceInput } from '@/lib/platform/training/contracts';
import { APP_RUNTIME_PAYLOAD_VALIDATORS } from '@/lib/runtime/payload-validators';
import { MAIN_SOURCE_FILES, mainTeachingPlan } from '@/lib/training/main-case';
import { readTrainingConversation, saveAgentReview, resumePreparedReview } from '@/lib/platform/training/agent';
import { appendImmutableRuntimeFact, ensureTrainingSession } from '@/lib/training/runtime';

const teacher: TrainingActor = { ownerId: 'teacher', learnerKey: 'demo:teacher', role: 'teacher' };
const student: TrainingActor = { ownerId: 'student', learnerKey: 'anon:student', role: 'student' };
const plan: TeachingPlan = {
  schemaVersion: 1,
  title: 'P0新提交验证',
  professionalGroup: '软件技术',
  occupation: '计算机程序设计员',
  jobTask: '解释请求与响应',
  learnerProfile: '仅供教师的学情',
  learningGoals: ['接口理解'],
  sources: [
    {
      sourceId: 'private',
      kind: 'upload',
      title: '教师参考',
      materialRef: 'material',
      locator: '',
      excerpt: 'teacher-only-answer',
      basisType: 'teaching',
      studentVisible: false,
    },
  ],
  competencies: [{ id: 'http', name: '接口理解', description: '说明接口', checkIds: ['meaning'] }],
  checks: [
    {
      id: 'complete',
      revision: 1,
      criterion: '包含说明',
      required: true,
      appliesWhen: 'always',
      evaluator: 'rule',
      ruleId: 'submission-complete',
      sourceRefs: [],
    },
    {
      id: 'meaning',
      revision: 1,
      criterion: '按接口约定说明关系',
      required: true,
      appliesWhen: 'always',
      evaluator: 'human',
      sourceRefs: ['private'],
    },
  ],
  outputs: [
    {
      id: 'A',
      title: '接口交互说明',
      requiredParts: ['说明'],
      activityRefs: ['scene'],
      checkRefs: ['complete', 'meaning'],
    },
  ],
  activities: [
    {
      stageId: 'stage',
      sceneId: 'scene',
      purpose: '验证',
      outputGroupId: 'A',
      checkRefs: ['complete', 'meaning'],
      contentRevision: '1',
      required: true,
    },
  ],
  supportNotes: '先阅读接口约定',
  orderedActivityRefs: ['scene'],
  changeReason: '首次应用',
  basedOnEvidenceIds: [],
};

describe('P0 shared teaching evidence', () => {
  let db: SqliteDatabase;
  let dao: TrainingDao;
  let runtime: BrowserRuntimeStore;
  let service: TrainingService;
  let taskId: string;
  let input: EvidenceInput;
  beforeEach(async () => {
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    const moduleName = 'node:sqlite';
    const sqlite = (await import(moduleName)) as {
      DatabaseSync: new (file: string) => SqliteDatabase;
    };
    db = new sqlite.DatabaseSync(':memory:');
    db.exec(PLATFORM_SCHEMA);
    dao = new TrainingDao(db);
    runtime = new BrowserRuntimeStore({
      indexedDB: new IDBFactory(),
      payloadValidators: APP_RUNTIME_PAYLOAD_VALIDATORS,
    });
    service = new TrainingService({
      dao,
      runtime,
      validateActivities: async () => {},
      validateSources: async () => {},
    });
    taskId = service.createTask(teacher, {
      requestId: 'create-1',
      content: structuredClone(plan),
    }).id;
    await service.applyTask(taskId, teacher, {
      requestId: 'apply-1',
      expectedDraftSeq: 0,
      expectedActiveRevision: 0,
    });
    input = {
      evidenceId: 'evidence-1',
      taskId,
      planRevision: 1,
      outputGroupId: 'A',
      stageId: 'stage',
      sceneId: 'scene',
      nativeAttemptId: 'attempt-1',
      sourceRecordRefs: [],
      submittedContent: { 说明: '这是当前学生亲自输入的请求与响应说明。' },
    };
  });
  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('saves one new original and reads the identical text as student and owning teacher', async () => {
    const saved = await service.saveEvidence(input, student);
    expect(saved.processing).toMatchObject({
      saved: 'server',
      index: 'ready',
      assessment: 'partial',
    });
    const reopened = await service.getEvidence(input.evidenceId, student);
    const reviewed = await service.getEvidence(input.evidenceId, teacher);
    expect(reopened.submission?.submittedContent).toEqual(input.submittedContent);
    expect(reviewed.submission).toEqual(reopened.submission);
    expect(reviewed.assessment?.competencyResults).toEqual([
      { competencyId: 'http', status: 'pending' },
    ]);
    expect(JSON.stringify(reopened)).not.toContain('teacher-only-answer');
    expect(JSON.stringify(reopened)).not.toContain('仅供教师的学情');
  });
  it('deduplicates concurrent retries and rejects reused IDs with changed content', async () => {
    await Promise.all([
      service.saveEvidence(input, student),
      service.saveEvidence(structuredClone(input), student),
    ]);
    const row = dao.evidence(input.evidenceId)!;
    expect(await runtime.listRecords(row.runtime_session_id)).toHaveLength(2);
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' })
        .savedCountInPage,
    ).toBe(1);
    await expect(
      service.saveEvidence({ ...input, submittedContent: { 说明: '偷偷覆盖' } }, student),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.saveEvidence({ ...input, evidenceId: 'different-id' }, student),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('retains old facts and requires a real change for a revision', async () => {
    await service.saveEvidence(input, student);
    const revision = {
      ...input,
      evidenceId: 'evidence-2',
      nativeAttemptId: 'attempt-2',
      supersedesEvidenceId: input.evidenceId,
    };
    await expect(service.saveEvidence(revision, student)).rejects.toMatchObject({ status: 409 });
    await service.saveEvidence(
      { ...revision, submittedContent: { 说明: '修改后的请求与响应说明。' } },
      student,
    );
    expect(
      (await service.getEvidence(input.evidenceId, teacher)).submission?.submittedContent,
    ).toEqual(input.submittedContent);
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' })
        .savedCountInPage,
    ).toBe(2);
  });
  it('blocks other students, foreign teachers and student plan edits', async () => {
    await service.saveEvidence(input, student);
    await expect(
      service.getEvidence(input.evidenceId, { ...student, learnerKey: 'anon:other' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.getEvidence(input.evidenceId, { ...teacher, ownerId: 'foreign' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(() =>
      service.listEvidence(taskId, student, { scope: 'teacher', recordKind: 'learning' }),
    ).toThrow();
    expect(() =>
      service.saveDraft(taskId, student, {
        requestId: 'bad',
        expectedDraftSeq: 0,
        baseRevision: 1,
        content: plan,
      }),
    ).toThrow();
    expect(service.getTask(taskId, student)).not.toHaveProperty('draft');
  });
  it('recovers a saved submission after the index update fails', async () => {
    const update = vi.spyOn(dao, 'updateProcessing').mockImplementation(() => {
      throw new Error('simulated sqlite unavailable');
    });
    const interrupted = await service.saveEvidence(input, student);
    expect(interrupted.processing).toMatchObject({ saved: 'server', assessment: 'partial', index: 'failed' });
    expect(interrupted.assessment?.checkResults[0].status).toBe('passed');
    expect(interrupted.submission?.submittedContent).toEqual(input.submittedContent);
    expect(JSON.parse(dao.evidence(input.evidenceId)!.processing_json).saved).toBe('none');
    update.mockRestore();
    const recovered = await service.getEvidence(input.evidenceId, student);
    expect(recovered.processing).toMatchObject({ saved: 'server', assessment: 'partial', index: 'ready' });
    expect(recovered.assessment).toEqual(interrupted.assessment);
    expect((await service.saveEvidence(input, student)).submission?.submittedContent).toEqual(
      input.submittedContent,
    );
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' })
        .savedCountInPage,
    ).toBe(1);
  });
  it('retries the original submission when the index reservation itself was unavailable', async () => {
    const reserve = vi.spyOn(dao, 'reserveEvidence').mockImplementationOnce(() => { throw new Error('index reservation unavailable'); });
    await expect(service.saveEvidence(input, student)).rejects.toThrow('index reservation unavailable');
    expect(dao.evidence(input.evidenceId)).toBeUndefined();
    reserve.mockRestore();
    const recovered = await service.saveEvidence(input, student);
    expect(recovered.processing).toMatchObject({ saved: 'server', index: 'ready' });
    await service.saveEvidence(input, student);
    expect(service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' }).savedCountInPage).toBe(1);
    expect(await runtime.listRecords(dao.evidence(input.evidenceId)!.runtime_session_id)).toHaveLength(2);
  });
  it('reads selected source originals within the published visibility and task owner boundary', async () => {
    const read = vi.fn(async () => 'current uploaded original');
    service.deps.readSourceText = read;
    await expect(service.readSource(taskId, 'private', student)).rejects.toMatchObject({
      status: 404,
    });
    expect(read).not.toHaveBeenCalled();
    expect((await service.readSource(taskId, 'private', teacher)).text).toBe(
      'current uploaded original',
    );
    await expect(
      service.readSource(taskId, 'private', { ...teacher, ownerId: 'foreign' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(read).toHaveBeenCalledTimes(1);
  });
  async function mainTask() {
    const sources = MAIN_SOURCE_FILES.map((source) => ({
      sourceId: source.sourceId,
      basisType: source.basisType,
      title: source.filename,
      kind: 'upload' as const,
      materialRef: source.sourceId,
      locator: source.filename,
      excerpt: source.sourceId,
      studentVisible: true,
    }));
    const content = mainTeachingPlan('main-stage-a', 'main-stage-b', sources);
    const task = service.createTask(teacher, { requestId: 'main-create', content });
    await service.applyTask(task.id, teacher, {
      requestId: 'main-apply',
      expectedDraftSeq: 0,
      expectedActiveRevision: 0,
    });
    return {
      task,
      content,
      input: {
        ...input,
        taskId: task.id,
        stageId: 'main-stage-a',
        sceneId: 'main-stage-a-activity',
        submittedContent: {
          'A-C1': ['A1-O1'],
          'A-C2': ['A2-O2', 'A2-O1'],
          'A-C3': ['A3-O1', 'A3-O2', 'A3-O4'],
        },
      },
    };
  }
  it('records current structured choices as a native quiz original and grades without an AI score', async () => {
    const main = await mainTask();
    const saved = await service.saveEvidence(main.input, student);
    expect(saved.assessment?.competencyResults).toEqual([
      { competencyId: 'http', status: 'achieved' },
    ]);
    const [ref] = saved.submission!.sourceRecordRefs;
    expect((await runtime.getSession(ref.sessionId))?.kind).toBe('quizAttempt');
    const native = (await runtime.listRecords(ref.sessionId)).find(
      (record) => record.id === ref.recordId,
    );
    expect((native?.payload as { answers: unknown }).answers).toEqual(main.input.submittedContent);
    await expect(service.validateNativeRefs({
      ...main.input, sourceRecordRefs: [ref], submittedContent: { 'A-C1': ['A1-O2'] },
    }, student)).rejects.toMatchObject({ status: 409 });
    await service.saveEvidence(main.input, student);
    expect(await runtime.listRecords(ref.sessionId)).toHaveLength(1);
    await expect(
      service.saveEvidence(
        { ...main.input, submittedContent: { ...main.input.submittedContent, 'A-C1': ['A1-O2'] } },
        student,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await service.getEvidence(main.input.evidenceId, teacher)).submission?.submittedContent,
    ).toEqual(main.input.submittedContent);
  });
  it('distinguishes incomplete answers from a complete but incorrect submission', async () => {
    const main = await mainTask();
    await expect(
      service.saveEvidence({ ...main.input, submittedContent: { 'A-C1': ['A1-O1'] } }, student),
    ).rejects.toMatchObject({ status: 422 });
    expect(dao.evidence(main.input.evidenceId)).toBeUndefined();
    const wrong = await service.saveEvidence(
      { ...main.input, submittedContent: { ...main.input.submittedContent, 'A-C1': ['A1-O2'] } },
      student,
    );
    expect(wrong.processing.saved).toBe('server');
    expect(wrong.assessment?.competencyResults[0].status).toBe('needs_work');
  });
  it('keeps B open answers pending while preserving its independently verified flow choice', async () => {
    const main = await mainTask();
    const output = main.content.outputs[1];
    const submittedContent = Object.fromEntries(
      output.requiredParts.map((part) => [
        part,
        part === 'B-C1' ? ['P2', 'P1'] : '这是当前学生的说明，需要按原文评阅。',
      ]),
    );
    const saved = await service.saveEvidence(
      {
        ...main.input,
        outputGroupId: 'B',
        stageId: 'main-stage-b',
        sceneId: 'main-stage-b-activity',
        submittedContent,
      },
      student,
    );
    expect(saved.processing).toMatchObject({ saved: 'server', assessment: 'partial' });
    expect(saved.assessment?.checkResults[0].status).toBe('passed');
    expect(
      saved.assessment?.checkResults.slice(1).every((check) => check.status === 'unknown'),
    ).toBe(true);
    expect(saved.assessment?.competencyResults.every((item) => item.status === 'pending')).toBe(
      true,
    );
  });
  it('refuses an old rule when its question wording or options were changed', async () => {
    const main = await mainTask();
    main.content.outputs[0].questions![0] = {
      ...main.content.outputs[0].questions![0],
      question: 'a different question',
    };
    service.saveDraft(main.task.id, teacher, {
      requestId: 'modified-question',
      expectedDraftSeq: 0,
      baseRevision: 1,
      content: main.content,
    });
    await expect(
      service.applyTask(main.task.id, teacher, {
        requestId: 'modified-apply',
        expectedDraftSeq: 1,
        expectedActiveRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  async function openAnswerEvidence() {
    const main = await mainTask();
    const output = main.content.outputs[1];
    const saved = await service.saveEvidence({
      ...main.input, outputGroupId: 'B', stageId: 'main-stage-b', sceneId: 'main-stage-b-activity',
      submittedContent: Object.fromEntries(output.requiredParts.map((part) => [part, part === 'B-C1' ? ['P3'] : '当前学生的解释原文'])),
    }, student);
    const review = {
      results: main.content.checks.filter((check) => check.evaluator === 'ai').map((check) => ({ checkId: check.id, status: 'passed', basis: '逐项引用学生当前原文和选定资料进行评阅。' })),
      sourceIds: ['D1'], explanation: '依据本次原文说明下一步；规则判断保持独立。',
    };
    return { saved, review };
  }
  it('preserves failed fixed rules and original input after an AI review, and rejects unread sources', async () => {
    const { saved, review } = await openAnswerEvidence();
    await expect(saveAgentReview(service, student, saved.evidenceId, 'review-1', review, new Set())).rejects.toMatchObject({ status: 422 });
    await saveAgentReview(service, student, saved.evidenceId, 'review-1', review, new Set(['D1']));
    const reopened = await service.getEvidence(saved.evidenceId, teacher);
    expect(reopened.assessment?.checkResults[0]).toEqual(saved.assessment?.checkResults[0]);
    expect(reopened.assessment?.checkResults[0].status).toBe('failed');
    expect(reopened.assessment?.checkResults.slice(1).every((result) => result.status === 'passed')).toBe(true);
    expect(reopened.submission).toEqual(saved.submission);
    expect(reopened.processing.explanation).toBe('ready');
    await expect(saveAgentReview(service, { ...student, learnerKey: 'other-student' }, saved.evidenceId, 'review-2', review, new Set(['D1']))).rejects.toMatchObject({ status: 404 });
  });
  it('recovers a missing explanation without duplicating the saved assessment', async () => {
    const { saved, review } = await openAnswerEvidence();
    const append = runtime.appendRecord.bind(runtime);
    const spy = vi.spyOn(runtime, 'appendRecord').mockImplementation(async (record, options) => {
      if (record.id.startsWith('explanation:')) throw new Error('explanation interrupted');
      return append(record, options);
    });
    await expect(saveAgentReview(service, student, saved.evidenceId, 'review-1', review, new Set(['D1']))).rejects.toThrow();
    const partial = await service.getEvidence(saved.evidenceId, student);
    expect(partial.processing).toMatchObject({ saved: 'server', assessment: 'ready', explanation: 'pending' });
    spy.mockRestore();
    await saveAgentReview(service, student, saved.evidenceId, 'review-1', review, new Set(['D1']));
    await saveAgentReview(service, student, saved.evidenceId, 'review-1', review, new Set(['D1']));
    expect((await service.getEvidence(saved.evidenceId, student)).processing.explanation).toBe('ready');
    expect(await runtime.listRecords(dao.evidence(saved.evidenceId)!.runtime_session_id)).toHaveLength(4);
  });
  it('rejects changed conclusions, sources or explanation under one saved review identity', async () => {
    const { saved, review } = await openAnswerEvidence();
    await saveAgentReview(service, student, saved.evidenceId, 'immutable-review', review, new Set(['D1', 'D2']));
    const original = await service.getEvidence(saved.evidenceId, teacher);
    await expect(saveAgentReview(service, student, saved.evidenceId, 'immutable-review', { ...review, results: review.results.map((item) => ({ ...item, status: 'failed' })) }, new Set(['D1']))).rejects.toMatchObject({ status: 409 });
    await expect(saveAgentReview(service, student, saved.evidenceId, 'immutable-review', { ...review, sourceIds: ['D2'] }, new Set(['D2']))).rejects.toMatchObject({ status: 409 });
    await expect(saveAgentReview(service, student, saved.evidenceId, 'immutable-review', { ...review, explanation: '相反的解释' }, new Set(['D1']))).rejects.toMatchObject({ status: 409 });
    const reopened = await service.getEvidence(saved.evidenceId, teacher);
    expect(reopened.assessment).toEqual(original.assessment);
    expect(reopened.explanation).toEqual(original.explanation);
  });
  it.each(['assessment', 'explanation'])('resumes the prepared model result after %s persistence fails', async (step) => {
    const { saved, review } = await openAnswerEvidence();
    const context = { taskId: saved.taskId, evidenceId: saved.evidenceId, planRevision: saved.planRevision, requestId: 'prepared-review', intent: 'assess' as const };
    const scope = { runtime_session_id: 'training-chat:prepared', stage_id: 'main-stage-b', scene_id: 'main-stage-b-activity', learner_key: student.learnerKey, created_at: Date.now() };
    const sourceRefs = [{ sourceId: 'D1', title: '本次产品说明', locator: 'D1' }];
    await ensureTrainingSession(runtime, scope, 'chat');
    const append = runtime.appendRecord.bind(runtime);
    const failure = vi.spyOn(runtime, 'appendRecord').mockImplementation(async (record, options) => {
      if (record.id.startsWith(step + ':agent:')) throw new Error(step + ' interrupted');
      return append(record, options);
    });
    await expect(saveAgentReview(service, student, saved.evidenceId, context.requestId, review, new Set(['D1']),
      (validated) => appendImmutableRuntimeFact(runtime, scope, 'training-review:prepared-review', {
        role: 'assistant', content: '本次已核对的评阅，供保存中断后恢复。',
        trainingReview: { taskId: context.taskId, evidenceId: saved.evidenceId, planRevision: saved.planRevision, review: validated, sourceRefs },
      }, new Date().toISOString()))).rejects.toThrow('interrupted');
    const partial = await service.getEvidence(saved.evidenceId, student);
    expect(partial.submission).toEqual(saved.submission);
    expect(partial.assessment?.checkResults[0]).toEqual(saved.assessment?.checkResults[0]);
    if (step === 'assessment') expect(partial.assessment).toEqual(saved.assessment);
    else expect(partial.processing.explanation).toBe('pending');
    failure.mockRestore();
    await expect(resumePreparedReview(service, { ...student, learnerKey: 'other' }, context, scope)).rejects.toMatchObject({ status: 404 });
    await expect(resumePreparedReview(service, student, { ...context, evidenceId: 'different' }, scope)).rejects.toMatchObject({ status: 409 });
    const reply = await resumePreparedReview(service, student, context, scope);
    expect(reply).toMatchObject({ content: review.explanation, sourceRefs, assessmentSaved: true });
    expect(await resumePreparedReview(service, student, context, scope)).toEqual(reply);
    const recovered = await service.getEvidence(saved.evidenceId, teacher);
    expect(recovered.processing).toMatchObject({ saved: 'server', explanation: 'ready' });
    expect(recovered.assessment?.checkResults[0]).toEqual(saved.assessment?.checkResults[0]);
    expect(await runtime.listRecords(dao.evidence(saved.evidenceId)!.runtime_session_id)).toHaveLength(4);
    expect(await runtime.listRecords(scope.runtime_session_id)).toHaveLength(2);
  });
  it('does not expose teacher preparation conversations during demo role switching', async () => {
    await runtime.createSession({ id: 'training-chat:conversation', kind: 'chat', stageId: 'stage', learnerKey: `teacher:${teacher.ownerId}`, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await expect(readTrainingConversation(service, taskId, { ...student, learnerKey: teacher.learnerKey }, 'conversation')).rejects.toMatchObject({ status: 404 });
  });
  it('only discovers student tasks through the applied course association', () => {
    const draft = {
      ...plan,
      activities: [{ ...plan.activities[0], stageId: 'private-draft-stage' }],
    };
    service.saveDraft(taskId, teacher, {
      requestId: 'draft-association',
      expectedDraftSeq: 0,
      baseRevision: 1,
      content: draft,
    });
    expect(dao.listTasks(undefined, 'private-draft-stage')).toHaveLength(0);
    expect(dao.listTasks(undefined, 'stage').map((task) => task.id)).toEqual([taskId]);
    expect(dao.listTasks(teacher.ownerId, 'private-draft-stage').map((task) => task.id)).toEqual([
      taskId,
    ]);
  });
  it('does not count an index reservation without its original submission', async () => {
    dao.reserveEvidence(input, student.learnerKey, 'learning');
    const pending = await service.getEvidence(input.evidenceId, student);
    expect(pending.submission).toBeNull();
    expect(pending.processing.saved).toBe('none');
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' })
        .savedCountInPage,
    ).toBe(0);
    await service.saveEvidence(input, student);
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' })
        .savedCountInPage,
    ).toBe(1);
  });
  it('recovers when append succeeded but its response was lost', async () => {
    const realAppend = runtime.appendRecord.bind(runtime);
    vi.spyOn(runtime, 'appendRecord').mockImplementationOnce(async (record, options) => {
      await realAppend(record, options);
      throw new Error('response lost');
    });
    expect((await service.saveEvidence(input, student)).processing.saved).toBe('server');
    expect(
      await runtime.listRecords(dao.evidence(input.evidenceId)!.runtime_session_id),
    ).toHaveLength(2);
  });
  it('keeps submission saved if assessment fails and recovers only the missing step', async () => {
    const realAppend = runtime.appendRecord.bind(runtime);
    const spy = vi.spyOn(runtime, 'appendRecord').mockImplementation(async (record, options) => {
      if (record.id.startsWith('assessment:')) throw new Error('assessment unavailable');
      return realAppend(record, options);
    });
    const saved = await service.saveEvidence(input, student);
    expect(saved.processing).toMatchObject({ saved: 'server', assessment: 'failed' });
    spy.mockRestore();
    expect((await service.getEvidence(input.evidenceId, teacher)).processing.assessment).toBe(
      'partial',
    );
    expect(
      await runtime.listRecords(dao.evidence(input.evidenceId)!.runtime_session_id),
    ).toHaveLength(2);
  });
  it('keeps applied plans immutable and old submissions tied to their original version', async () => {
    await service.saveEvidence(input, student);
    const next = {
      ...plan,
      supportNotes: '新版本支持说明',
      changeReason: '依据本次提交调整',
      basedOnEvidenceIds: [input.evidenceId],
    };
    service.saveDraft(taskId, teacher, {
      requestId: 'draft-1',
      expectedDraftSeq: 0,
      baseRevision: 1,
      content: next,
    });
    await service.applyTask(taskId, teacher, {
      requestId: 'apply-2',
      expectedDraftSeq: 1,
      expectedActiveRevision: 1,
    });
    expect(service.getTask(taskId, student).content?.supportNotes).toBe(next.supportNotes);
    expect(
      (await service.getEvidence(input.evidenceId, student)).submission?.contextSnapshot
        .supportNotes,
    ).toBe(plan.supportNotes);
    expect(
      (
        await service.applyTask(taskId, teacher, {
          requestId: 'apply-1',
          expectedDraftSeq: 0,
          expectedActiveRevision: 0,
        })
      ).revision,
    ).toBe(1);
    await expect(
      service.applyTask(taskId, teacher, {
        requestId: 'apply-1',
        expectedDraftSeq: 1,
        expectedActiveRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('replays draft receipts and detects concurrent edits and altered retry content', () => {
    const first = { requestId: 'draft-1', expectedDraftSeq: 0, baseRevision: 1, content: plan };
    expect(service.saveDraft(taskId, teacher, first).draftSeq).toBe(1);
    service.saveDraft(taskId, teacher, { ...first, requestId: 'draft-2', expectedDraftSeq: 1 });
    expect(service.saveDraft(taskId, teacher, first).draftSeq).toBe(1);
    expect(() =>
      service.saveDraft(taskId, teacher, { ...first, content: { ...plan, title: 'changed' } }),
    ).toThrow();
    expect(() =>
      service.saveDraft(taskId, teacher, { ...first, requestId: 'draft-stale' }),
    ).toThrow();
  });
  it('rejects unresolved references without switching the active plan', async () => {
    const broken = { ...plan, outputs: [{ ...plan.outputs[0], activityRefs: ['missing'] }] };
    service.saveDraft(taskId, teacher, {
      requestId: 'draft-broken',
      expectedDraftSeq: 0,
      baseRevision: 1,
      content: broken,
    });
    await expect(
      service.applyTask(taskId, teacher, {
        requestId: 'apply-broken',
        expectedDraftSeq: 1,
        expectedActiveRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(dao.task(taskId).active_revision).toBe(1);
    expect(() => dao.revision(taskId, 2)).toThrow();
  });
  it('separates new rehearsal records and never imports another learner native record', async () => {
    await service.saveEvidence(input, { ...student, learnerKey: 'demo:student' });
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'learning' }).items,
    ).toHaveLength(0);
    expect(
      service.listEvidence(taskId, teacher, { scope: 'teacher', recordKind: 'demo' })
        .savedCountInPage,
    ).toBe(1);
    await expect(
      service.saveEvidence(
        {
          ...input,
          evidenceId: 'evidence-other',
          sourceRecordRefs: [{ sessionId: 'foreign', recordId: 'submission' }],
        },
        student,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// Local DOM simulation only: no browser, running service, or external model is accessed.
describe('training Agent request recovery across page reloads', () => {
  const mocks = { learner: 'student-a', apiKey: 'test-only-key-before', fetch: vi.fn() };
  let domEnvironment: { teardown: (global: typeof globalThis) => unknown };
  let createRoot: typeof import('react-dom/client').createRoot;
  let Panel: typeof import('@/components/training/agent-panel').TrainingAgentPanel;
  let root: Root | undefined;
  const props = { taskId: 'task', revision: 2, role: 'student' as const, evidenceId: 'evidence', intent: 'assess' as const };
  const pendingKey = 'praxis:training-chat:student:student-a:task:2::evidence:assess:pending';
  const requests = () => mocks.fetch.mock.calls.filter((call) => call[2]);
  const response = (requestId: string) => ({ requestId, content: '已恢复原评阅。', sourceRefs: [], assessmentSaved: true });
  beforeAll(async () => {
    domEnvironment = await builtinEnvironments.jsdom.setup(globalThis, { jsdom: { url: 'http://unit.test' } });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.doMock('@/lib/platform/training/client', () => ({
      trainingLearnerKey: async (role: string) => role === 'teacher' ? 'teacher-owner' : mocks.learner,
      trainingFetch: mocks.fetch,
    }));
    vi.doMock('@/lib/settings/service-snapshot', () => ({
      currentServiceSettings: () => ({ llm: { apiKey: mocks.apiKey } }),
    }));
    ({ createRoot } = await import('react-dom/client'));
    ({ TrainingAgentPanel: Panel } = await import('@/components/training/agent-panel'));
  }, 30000);
  beforeEach(() => {
    localStorage.clear();
    mocks.learner = 'student-a';
    mocks.apiKey = 'test-only-key-before';
    mocks.fetch.mockReset();
  });
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = undefined;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    vi.doUnmock('@/lib/platform/training/client');
    vi.doUnmock('@/lib/settings/service-snapshot');
    vi.unstubAllGlobals();
    await domEnvironment?.teardown(globalThis);
  });
  async function mount(role: 'teacher' | 'student' = 'student') {
    if (root) act(() => root!.unmount());
    document.body.replaceChildren();
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(createElement(Panel, { ...props, role })));
  }
  async function click() {
    const button = document.querySelector('button')!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
  }
  it('reuses the request and conversation after an interrupted review, using current settings only', async () => {
    let fail = true;
    let savedReply: ReturnType<typeof response> | undefined;
    mocks.fetch.mockImplementation(async (_path: string, _role: string, body?: { requestId: string }) => {
      if (!body) return { replies: savedReply ? [savedReply] : [] };
      if (fail) throw new Error('评阅保存中断');
      savedReply = response(body.requestId);
      return savedReply;
    });
    await mount();
    await click();
    const first = requests()[0][2];
    expect(document.body.textContent).toContain('重试本次评阅');
    expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ id: first.requestId });
    expect(localStorage.getItem(pendingKey)).not.toContain('test-only-key');
    mocks.apiKey = 'test-only-key-after';
    await mount();
    expect(document.body.textContent).toContain('重试本次评阅');
    fail = false;
    await click();
    const recovered = requests()[1][2];
    expect(recovered.requestId).toBe(first.requestId);
    expect(recovered.conversationId).toBe(first.conversationId);
    expect(recovered.serviceSettings.llm.apiKey).toBe('test-only-key-after');
    expect(localStorage.getItem(pendingKey)).toBeNull();
    await mount();
    expect(document.body.textContent).toContain('已恢复原评阅。');
    expect(document.body.textContent).not.toContain('重试本次评阅');
    expect(requests()).toHaveLength(2);
  });
  it('keeps pending review identity separate for teachers and different learners', async () => {
    mocks.fetch.mockImplementation(async (_path: string, _role: string, body?: unknown) => {
      if (!body) return { replies: [] };
      throw new Error('本次评阅中断');
    });
    await mount();
    await click();
    const first = requests()[0][2];
    await mount('teacher');
    expect(document.body.textContent).not.toContain('重试本次评阅');
    await click();
    const teacherRequest = requests()[1][2];
    expect(teacherRequest.requestId).not.toBe(first.requestId);
    expect(teacherRequest.conversationId).not.toBe(first.conversationId);
    mocks.learner = 'student-b';
    await mount();
    expect(document.body.textContent).not.toContain('重试本次评阅');
    await click();
    const other = requests()[2][2];
    expect(other.requestId).not.toBe(first.requestId);
    expect(other.conversationId).not.toBe(first.conversationId);
    mocks.learner = 'student-a';
    await mount();
    expect(document.body.textContent).toContain('重试本次评阅');
    expect(JSON.parse(localStorage.getItem(pendingKey)!)).toMatchObject({ id: first.requestId });
  });
  it('does not start a request if its recovery identity cannot be saved', async () => {
    mocks.fetch.mockResolvedValue({ replies: [] });
    await mount();
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('浏览器存储空间不足');
    });
    await click();
    expect(requests()).toHaveLength(0);
    expect(document.body.textContent).toContain('浏览器存储空间不足');
    storage.mockRestore();
    mocks.fetch.mockImplementation(async (_path: string, _role: string, body?: { requestId: string }) =>
      body ? response(body.requestId) : { replies: [] },
    );
    await click();
    expect(requests()).toHaveLength(1);
    expect(document.body.textContent).toContain('已恢复原评阅。');
  });
});
