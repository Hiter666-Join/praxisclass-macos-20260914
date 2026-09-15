import { z } from 'zod';
import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { isTeacherRequest } from '@/lib/platform/auth/require-teacher';
import { authenticatePersistenceHeaders } from '@/lib/persistence/server-auth';
import {
  createTaskSchema,
  saveDraftSchema,
  applyTaskSchema,
  evidenceInputSchema,
  trainingId,
} from './contracts';
import { TrainingError } from './errors';
import { getTrainingService, type TrainingActor } from './service';
import {
  mainCaseMaterials,
  initializeMainCase,
  mainInitializationSchema,
} from './main-initializer';
import { trainingAgentInputSchema } from '@/lib/training/agent-contracts';
import { readTrainingConversation, runTrainingAgent } from './agent';
import { extraCaseIdSchema, extraInitializationSchema, extraCaseMaterials, initializeExtraCase } from './extra-initializer';
import { knowledgeCaseSchema, trainingKnowledgeMaterials } from './knowledge';

export async function trainingRequest(request: Request): Promise<Response> {
  return withRequestOwnerId(request, async (ownerId, headers) => {
    try {
      const role = request.headers.get('x-praxis-role');
      if (role !== 'teacher' && role !== 'student')
        throw new TrainingError(401, 'ROLE_REQUIRED', '请从教师或学生入口继续。');
      if (role === 'teacher' && !(await isTeacherRequest(request)))
        throw new TrainingError(401, 'TEACHER_REQUIRED', '请先进入教师工作台。');
      const principal = authenticatePersistenceHeaders(request.headers);
      if (!principal?.learnerKey)
        throw new TrainingError(401, 'LEARNER_REQUIRED', '当前实训身份尚未就绪，请重新打开课堂。');
      trainingId.parse(principal.learnerKey);
      const actor: TrainingActor = { ownerId, learnerKey: principal.learnerKey, role };
      const url = new URL(request.url);
      const parts = url.pathname
        .replace(/^\/api\/platform\/training\/?/, '')
        .split('/')
        .filter(Boolean);
      const service = await getTrainingService();
      const body = async () => {
        const raw = await request.text();
        if (raw.length > 300000)
          throw new TrainingError(422, 'INPUT_TOO_LARGE', '本次内容过长，请减少无关资料。');
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          throw new TrainingError(422, 'INVALID_BODY', '提交内容无法解析。');
        }
      };
      let result: unknown;
      if (parts[0] === 'cases' && parts.length === 3 && parts[2] === 'knowledge' && request.method === 'GET')
        result = await trainingKnowledgeMaterials(knowledgeCaseSchema.parse(parts[1]), actor);
      else if (parts.join('/') === 'cases/main-ticket/materials' && request.method === 'GET')
        result = await mainCaseMaterials(actor);
      else if (parts.join('/') === 'cases/main-ticket/initialize' && request.method === 'POST')
        result = await initializeMainCase(
          service,
          actor,
          mainInitializationSchema.parse(await body()),
        );
      else if (parts[0] === 'cases' && parts.length === 3 && parts[2] === 'materials' && request.method === 'GET')
        result = await extraCaseMaterials(extraCaseIdSchema.parse(parts[1]), actor);
      else if (parts[0] === 'cases' && parts.length === 3 && parts[2] === 'initialize' && request.method === 'POST')
        result = await initializeExtraCase(service, actor, extraCaseIdSchema.parse(parts[1]), extraInitializationSchema.parse(await body()));
      else if (parts[0] === 'tasks' && parts.length === 1 && request.method === 'POST')
        result = service.createTask(actor, createTaskSchema.parse(await body()));
      else if (parts[0] === 'tasks' && parts.length === 1 && request.method === 'GET')
        result = {
          tasks: service.listTasks(
            actor,
            url.searchParams.has('stageId')
              ? trainingId.parse(url.searchParams.get('stageId'))
              : undefined,
          ),
        };
      else if (parts[0] === 'tasks' && parts.length === 2 && request.method === 'GET')
        result = service.getTask(
          trainingId.parse(parts[1]),
          actor,
          url.searchParams.has('revision')
            ? z.coerce.number().int().positive().parse(url.searchParams.get('revision'))
            : undefined,
        );
      else if (
        parts[0] === 'tasks' &&
        parts[2] === 'agent' &&
        parts.length === 3 &&
        request.method === 'POST'
      )
        result = await runTrainingAgent(
          service,
          trainingId.parse(parts[1]),
          actor,
          trainingAgentInputSchema.parse(await body()),
        );
      else if (
        parts[0] === 'tasks' &&
        parts[2] === 'agent' &&
        parts.length === 3 &&
        request.method === 'GET'
      )
        result = await readTrainingConversation(
          service,
          trainingId.parse(parts[1]),
          actor,
          z.uuid().parse(url.searchParams.get('conversationId')),
        );
      else if (
        parts[0] === 'tasks' &&
        parts[2] === 'sources' &&
        parts.length === 4 &&
        request.method === 'GET'
      )
        result = await service.readSource(
          trainingId.parse(parts[1]),
          trainingId.parse(parts[3]),
          actor,
          url.searchParams.has('revision')
            ? z.coerce.number().int().positive().parse(url.searchParams.get('revision'))
            : undefined,
        );
      else if (
        parts[0] === 'tasks' &&
        parts[2] === 'draft' &&
        parts.length === 3 &&
        request.method === 'PUT'
      )
        result = service.saveDraft(
          trainingId.parse(parts[1]),
          actor,
          saveDraftSchema.parse(await body()),
        );
      else if (
        parts[0] === 'tasks' &&
        parts[2] === 'apply' &&
        parts.length === 3 &&
        request.method === 'POST'
      )
        result = await service.applyTask(
          trainingId.parse(parts[1]),
          actor,
          applyTaskSchema.parse(await body()),
        );
      else if (
        parts[0] === 'tasks' &&
        parts[2] === 'evidence' &&
        parts.length === 3 &&
        request.method === 'GET'
      )
        result = service.listEvidence(trainingId.parse(parts[1]), actor, {
          scope: z.enum(['self', 'teacher']).parse(url.searchParams.get('scope') ?? 'self'),
          recordKind: z
            .enum(['demo', 'learning'])
            .parse(
              url.searchParams.get('recordKind') ??
                (actor.learnerKey.startsWith('demo:') ? 'demo' : 'learning'),
            ),
          outputGroupId: url.searchParams.has('outputGroupId')
            ? trainingId.parse(url.searchParams.get('outputGroupId'))
            : undefined,
          cursor: url.searchParams.has('cursor')
            ? trainingId.parse(url.searchParams.get('cursor'))
            : undefined,
        });
      else if (parts[0] === 'evidence' && parts.length === 1 && request.method === 'POST')
        result = await service.saveEvidence(evidenceInputSchema.parse(await body()), actor);
      else if (parts[0] === 'evidence' && parts.length === 2 && request.method === 'GET')
        result = await service.getEvidence(trainingId.parse(parts[1]), actor);
      else throw new TrainingError(404, 'TRAINING_ROUTE_NOT_FOUND', '此实训操作不存在。');
      return Response.json(result, { headers });
    } catch (error) {
      const issue =
        error instanceof TrainingError
          ? error
          : error instanceof z.ZodError
            ? new TrainingError(
                422,
                'INVALID_INPUT',
                '请检查实训输入。',
                error.issues.map((item) => ({ path: item.path.join('.'), message: item.message })),
              )
            : new TrainingError(
                503,
                'TRAINING_UNAVAILABLE',
                '共享记录服务暂不可用。请保留当前输入并重试或重新读取成果。',
              );
      return Response.json(
        {
          code: issue.code,
          message: issue.message,
          retryable: issue.status === 503,
          fieldErrors: issue.fieldErrors,
        },
        { status: issue.status, headers },
      );
    }
  });
}
