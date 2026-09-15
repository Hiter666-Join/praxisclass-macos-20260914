import type { TeachingPlan } from '@/lib/platform/training/contracts';

type Questions = NonNullable<TeachingPlan['outputs'][number]['questions']>;
export const MAIN_QUESTIONS_A: Questions = [
  {
    id: 'A-C1',
    type: 'single',
    question:
      'A-C1：以下请求均采用 POST /api/product-qa 和 application/json。哪一个请求体符合接口契约？',
    options: [
      {
        value: 'A1-O1',
        label:
          '{"productId":"TICKET-DEMO","productVersion":"2.0","question":"我是管理员，怎样导出指定日期范围内的工单？"}',
      },
      {
        value: 'A1-O2',
        label:
          '{"productId":"TICKET-DEMO","productVersion":"2.0","answer":"我是管理员，怎样导出指定日期范围内的工单？"}',
      },
      {
        value: 'A1-O3',
        label:
          '{"productId":"TICKET-DEMO","question":"我是管理员，怎样导出指定日期范围内的工单？"}',
      },
      {
        value: 'A1-O4',
        label: '{"productId":"TICKET-DEMO","productVersion":"2.0","question":"   "}',
      },
    ],
  },
  {
    id: 'A-C2',
    type: 'multiple',
    question: 'A-C2：选择正确的数据对应关系。',
    options: [
      { value: 'A2-O1', label: '页面输入的问题，写入请求体的 question 字段。' },
      { value: 'A2-O2', label: '请求体的 question，对应后端接收对象中的同名问题字段。' },
      { value: 'A2-O3', label: '后端响应中的 answer，应作为本次请求尚未发送时的页面问题输入。' },
      { value: 'A2-O4', label: '只要请求里出现 sources，就说明用户已经收到服务器回答。' },
    ],
  },
  {
    id: 'A-C3',
    type: 'multiple',
    question:
      'A-C3：HTTP 200，响应为 {"status":"insufficient_evidence","answer":"当前资料无法确认这项功能，需要补充相关说明。","sources":[]}。哪些解释成立？',
    options: [
      { value: 'A3-O1', label: 'answer 可用于显示本次回答或处理说明。' },
      { value: 'A3-O2', label: 'sources 用于显示实际引用的资料；空数组不能当作已经给出了依据。' },
      { value: 'A3-O3', label: '只要 HTTP 状态为 200，就证明当前产品问题已有充分依据。' },
      {
        value: 'A3-O4',
        label: 'insufficient_evidence 表示本次请求已处理，但指定资料不足以确认问题。',
      },
    ],
  },
];
export const MAIN_QUESTIONS_B: Questions = [
  {
    id: 'B-C1',
    type: 'multiple',
    question: 'B-C1：哪些问答处理流程可以成立？',
    options: [
      {
        value: 'P1',
        label:
          '核对条件 → 按适用范围筛资料 → 检索候选 → 核对支撑关系 → 回答或不足／澄清 → 显示对应来源 → 验证三类情境',
      },
      {
        value: 'P2',
        label:
          '核对条件 → 检索候选 → 核对适用性及支撑关系 → 回答或不足／澄清 → 显示对应来源 → 验证三类情境',
      },
      { value: 'P3', label: '检索 → 取相似度最高的一段 → 直接当作当前版本答案并引用' },
      { value: 'P4', label: '检索 → 有资料就回答，没有资料就补写产品功能 → 返回来源列表' },
    ],
  },
  {
    id: 'B-flow-reason',
    type: 'short_answer',
    question: '用一句话说明：怎样确认候选资料能够支持准备给出的结论？',
  },
  ...[
    { id: 'B-1', prompt: 'TICKET-DEMO 2.0，管理员：怎样导出本月工单？' },
    {
      id: 'B-2',
      prompt:
        'TICKET-DEMO 2.0，管理员：有人引用 D2 §4.1 说明“2.0 也只能导出当前页”。这个引用能否支持结论？',
    },
    { id: 'B-3', prompt: 'TICKET-DEMO 2.0，管理员：是否支持每天定时导出并自动通过邮件发送？' },
  ].flatMap(({ id, prompt }) => [
    {
      id: `${id}-conclusion`,
      type: 'short_answer' as const,
      question: `${id} 处理结论：${prompt}`,
    },
    {
      id: `${id}-source`,
      type: 'short_answer' as const,
      question: `${id} 所用文档编号与段落，或注明无足够依据`,
    },
    { id: `${id}-reason`, type: 'short_answer' as const, question: `${id} 简短理由` },
  ]),
  {
    id: 'B-T',
    type: 'short_answer',
    question: '可选迁移：2.0 用户忘记密码，能否使用 D3 §2.1？给出结论、依据和理由。',
  },
];

export const MAIN_SOURCE_FILES = [
  {
    sourceId: 'TECH-HTTP',
    filename: '02-HTTP与Spring技术说明.md',
    basisType: 'technical' as const,
  },
  {
    sourceId: 'TECH-RAG',
    filename: '03-SpringAI资料问答技术说明.md',
    basisType: 'technical' as const,
  },
  { sourceId: 'TASK-MAIN', filename: '04-项目任务书与学情.md', basisType: 'teaching' as const },
  { sourceId: 'CONTRACT-MAIN', filename: '05-接口约定.md', basisType: 'teaching' as const },
  { sourceId: 'D1', filename: '06a-产品2.0导出说明.md', basisType: 'teaching' as const },
  { sourceId: 'D2', filename: '06b-产品1.0导出说明.md', basisType: 'teaching' as const },
  { sourceId: 'D3', filename: '06c-跨版本通用账号说明.md', basisType: 'teaching' as const },
  { sourceId: 'Q-MAIN', filename: '08-学生验证任务.md', basisType: 'teaching' as const },
];

export function mainTeachingPlan(
  stageA: string,
  stageB: string,
  sources: TeachingPlan['sources'],
): TeachingPlan {
  const aChecks = ['A-C1', 'A-C2', 'A-C3'];
  const bChecks = ['B-C1', 'B-flow-reason', 'B-1', 'B-2', 'B-3'];
  const sceneA = `${stageA}-activity`,
    sceneB = `${stageB}-activity`;
  return {
    schemaVersion: 1,
    title: '从一次请求到一个可信回答',
    professionalGroup: '软件技术',
    occupation: '计算机程序设计员（4-04-05-01）',
    jobTask:
      '教学合成任务：为 TICKET-DEMO 2.0 设计产品资料问答入口，交付接口交互说明与有依据的问答处理方案。',
    learnerProfile: '学过基础 Java，尚未系统学习 HTTP 请求与响应；由教师按本班情况调整。',
    learningGoals: [
      '解释请求、后端对象与响应的对应关系',
      '拆解资料问答处理任务',
      '核对资料的适用条件和支撑关系',
    ],
    sources,
    competencies: [
      { id: 'http', name: '接口理解', description: '仅对应本题接口契约', checkIds: aChecks },
      {
        id: 'decompose',
        name: '任务拆解',
        description: '流程选择与核验说明',
        checkIds: ['B-C1', 'B-flow-reason'],
      },
      {
        id: 'evidence',
        name: '证据判断',
        description: '三类指定产品问题',
        checkIds: ['B-1', 'B-2', 'B-3'],
      },
    ],
    checks: [
      ...aChecks.map((id, index) => ({
        id,
        revision: 1,
        criterion: [
          '请求符合教学接口契约',
          '问题与回答的数据方向正确',
          '区分响应字段、HTTP 状态与资料依据',
        ][index],
        required: true,
        appliesWhen: 'always' as const,
        evaluator: 'rule' as const,
        ruleId: `main-a-c${index + 1}-v1`,
        sourceRefs: ['CONTRACT-MAIN', 'TECH-HTTP'],
      })),
      {
        id: 'B-C1',
        revision: 1,
        criterion: '认可两种可成立流程，并排除未经核验或编造产品功能的方案',
        required: true,
        appliesWhen: 'always',
        evaluator: 'rule',
        ruleId: 'main-b-flow-v1',
        sourceRefs: ['TECH-RAG', 'TASK-MAIN'],
      },
      {
        id: 'B-flow-reason',
        revision: 1,
        criterion: '核验说明涉及适用条件与原文能支持的范围，允许等价表达',
        required: true,
        appliesWhen: 'always',
        evaluator: 'ai',
        sourceRefs: ['TECH-RAG'],
      },
      {
        id: 'B-1',
        revision: 1,
        criterion: '依据适用的产品段落回答 2.0 管理员导出本月工单，结论不超出原文',
        required: true,
        appliesWhen: 'always',
        evaluator: 'ai',
        sourceRefs: ['D1'],
      },
      {
        id: 'B-2',
        revision: 1,
        criterion: '判断引用是否适用于所问版本，并给出有依据的处理意见',
        required: true,
        appliesWhen: 'always',
        evaluator: 'ai',
        sourceRefs: ['D1', 'D2'],
      },
      {
        id: 'B-3',
        revision: 1,
        criterion: '对资料未说明的功能保留无法确认，指出需要补充的相关资料',
        required: true,
        appliesWhen: 'always',
        evaluator: 'ai',
        sourceRefs: ['D1', 'D2', 'D3'],
      },
    ],
    outputs: [
      {
        id: 'A',
        title: 'A · 接口交互说明',
        requiredParts: aChecks,
        activityRefs: [sceneA],
        checkRefs: aChecks,
        questions: structuredClone(MAIN_QUESTIONS_A),
      },
      {
        id: 'B',
        title: 'B · 有依据的问答处理方案',
        requiredParts: MAIN_QUESTIONS_B.filter((q) => q.id !== 'B-T').map((q) => q.id),
        activityRefs: [sceneB],
        checkRefs: bChecks,
        questions: structuredClone(MAIN_QUESTIONS_B),
      },
    ],
    activities: [
      {
        stageId: stageA,
        sceneId: sceneA,
        purpose: '请求响应图解与字段对应练习，随后完成 A 验证',
        outputGroupId: 'A',
        checkRefs: aChecks,
        contentRevision: 'MAIN-TICKET-1.0',
        required: true,
      },
      {
        stageId: stageB,
        sceneId: sceneB,
        purpose: '资料适用性图解与练习，随后完成 B 验证',
        outputGroupId: 'B',
        checkRefs: bChecks,
        contentRevision: 'MAIN-TICKET-1.0',
        required: true,
      },
    ],
    supportNotes:
      '接口不理解：追踪同一段问题在页面、question 与后端对象的位置。任务不会拆：先列出输入、资料核验、输出与验证。证据判断不清：分别核对产品、版本、角色和原文支撑范围。可直接提问，也可要求只提示下一步。',
    orderedActivityRefs: [sceneA, sceneB],
    changeReason: '使用已核对的 MAIN-TICKET-1.0 资料准备两段实训',
    basedOnEvidenceIds: [],
  };
}
