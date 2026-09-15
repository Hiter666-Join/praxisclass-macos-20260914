import type { TeachingPlan } from '@/lib/platform/training/contracts';

export const EXTRA_CASES = {
  'ai-code': {
    title: '代码能运行之后，还需要查什么',
    version: 'AI-CODE-1.0',
    description: '读懂契约、选择公开诊断，运行当前 Python 代码，留下有依据的验收记录。',
    files: [
      ['CODE-TECH', '01b-查找与运行技术说明.md', 'technical'],
      ['CODE-CONTRACT', '02-任务契约.md', 'teaching'],
      ['CODE-CANDIDATE', '03-待验收代码与来源.md', 'teaching'],
      ['CODE-DIAG', '04-公开诊断与测试计划.md', 'teaching'],
      ['CODE-SUITE', '05-固定验收说明.md', 'teaching'],
      ['CODE-HELP', '06-参考演示与按需辅导.md', 'teaching'],
      ['CODE-RECORD', '08-代码验收记录模板.md', 'teaching'],
    ],
  },
  retry: {
    title: '为什么一次操作生成两张工单', version: 'RETRY-TICKET-1.0',
    description: '从客户端未知结果开始，比较重试与新需求，留下同一方案的三类验证。',
    files: [
      ['RETRY-TECH', '01b-超时与幂等技术说明.md', 'technical'], ['RETRY-CONTRACT', '02-创建工单任务契约.md', 'teaching'],
      ['RETRY-ACTIVITY', '03-时序互动与学生任务.md', 'teaching'], ['RETRY-CARDS', '03a-可见信息与情形卡.md', 'teaching'],
      ['RETRY-HELP', '05-按需辅导资源.md', 'teaching'], ['RETRY-RECORD', '07-重试处理设计说明模板.md', 'teaching'],
    ],
  },
  vision: {
    title: '准确率提高了，为什么缺陷反而被放走了', version: 'VISION-QC-1.1',
    description: '用八张教学图卡比较分组，解释漏检与复检工作量，提出满足条件的阈值建议。',
    files: [
      ['VISION-TECH', '01b-分类指标与阈值技术说明.md', 'technical'], ['VISION-CONTRACT', '02-筛查任务与样本表.md', 'teaching'],
      ['VISION-ACTIVITY', '03-图卡与阈值活动.md', 'teaching'], ['VISION-HELP', '05-按需辅导资源.md', 'teaching'],
      ['VISION-RECORD', '07-缺陷筛查规则建议单模板.md', 'teaching'],
    ],
  },
  warehouse: {
    title: '一样长的路线，为什么只有一条按时完成任务', version: 'WAREHOUSE-ROUTE-1.0',
    description: '按地图计算办理时刻，比较基础路线，再按新的时限复核与调整。',
    files: [
      ['WAREHOUSE-TECH', '01b-距离与访问时间技术说明.md', 'technical'], ['WAREHOUSE-CONTRACT', '02-任务契约与地图表.md', 'teaching'],
      ['WAREHOUSE-ACTIVITY', '03-地图与顺序活动.md', 'teaching'], ['WAREHOUSE-TASKS', '04-学生任务与检查要求.md', 'teaching'],
      ['WAREHOUSE-HELP', '05b-按需辅导资源.md', 'teaching'], ['WAREHOUSE-RECORD', '07-路线设计与验证说明模板.md', 'teaching'],
    ],
  },
} as const;
export type ExtraCaseId = keyof typeof EXTRA_CASES;

export function extraTeachingPlan(caseId: ExtraCaseId, stageId: string, sources: TeachingPlan['sources']): TeachingPlan {
  if (caseId !== 'ai-code') return simulationTeachingPlan(caseId, stageId, sources);
  const info = EXTRA_CASES[caseId];
  const sceneId = `${stageId}-activity`;
  const criteria = [
    ['C1', '契约理解', '说明非递减整数输入、目标首次出现的零基位置、缺失返回整数-1，区分布尔值和整数下标。'],
    ['C2', '测试设计', '计划覆盖重复目标、空列表、单元素命中和目标不存在；预期依据契约正确，说明至少一个输入能排除哪种错误。只勾选卡片不算达标。'],
    ['C3', '验收判断', '依据同一代码快照的真实固定运行说明接收、拒收或尚不能判断，指出具体证据及未验证范围。正确拒收错误代码可满足本项，运行通过不自动满足本项；已受辅导应如实说明。'],
  ];
  const checks: TeachingPlan['checks'] = [
    { id: 'code-functional', revision: 1, criterion: '当次代码的固定功能验收', required: true, appliesWhen: 'always', evaluator: 'rule', ruleId: 'code-functional-v1', sourceRefs: ['CODE-CONTRACT', 'CODE-SUITE'] },
    ...criteria.map(([id, , criterion]) => ({ id, revision: 1, criterion, required: true, appliesWhen: 'always' as const, evaluator: 'ai' as const, sourceRefs: ['CODE-CONTRACT', 'CODE-DIAG', 'CODE-SUITE', 'CODE-TECH', 'CODE-CANDIDATE', 'CODE-HELP', 'CODE-RECORD'] })),
  ];
  return {
    schemaVersion: 1,
    title: info.title,
    professionalGroup: '软件技术专业群', occupation: '计算机程序设计员',
    jobTask: '对教学构造的 Python 候选程序进行验收：先写契约和测试计划，再实际运行，依据同一代码的结果保存一份验收记录。',
    learnerProfile: '已会 Python 基础语法、列表和循环，需要练习从能运行走向可验证的交付判断。',
    learningGoals: criteria.map(([, name]) => name), sources,
    competencies: criteria.map(([id, name, description]) => ({ id, name, description, checkIds: [id] })),
    checks,
    outputs: [{ id: 'C', title: 'C · 代码验收记录', requiredParts: ['验收记录'], activityRefs: [sceneId], checkRefs: checks.map((c) => c.id), interaction: 'ai-code' }],
    activities: [{ stageId, sceneId, outputGroupId: 'C', purpose: '进入代码实训：诊断、运行验收与保存', checkRefs: checks.map((c) => c.id), contentRevision: info.version, required: true }],
    supportNotes: '先说明首次位置契约，再选择能区分错误的诊断并写预期。公开诊断与固定12例分开；修改代码或计划后重新运行。参考动画仅说明参考算法。可按当前困难请求学习辅导，保存时注明获得的帮助。',
    orderedActivityRefs: [sceneId], changeReason: '建立本次代码验收教学安排', basedOnEvidenceIds: [],
  };
}

function simulationTeachingPlan(caseId: Exclude<ExtraCaseId, 'ai-code'>, stageId: string, sources: TeachingPlan['sources']): TeachingPlan {
  const info = EXTRA_CASES[caseId], sceneId = `${stageId}-activity`;
  const descriptions = {
    retry: {
      part: '重试设计说明', output: '重试处理设计说明',
      criteria: [
        ['C1', '可见信息判断', '依据当时客户端实际收到的信息解释超时为何不能确定创建结果；记录是否已看全景或获得关键帮助。'],
        ['C2', '业务意图与重试设计', '区分同一意图重试与明确新需求，说明服务端按调用者和标识处理、参数校验及两类标识策略。'],
        ['C3', '失败情形验证', '解释同一方案的三类真实仿真、预测与观察差别，不能只凭数量1判断可靠，说明串行单轮与原子记录的保障范围。'],
      ],
      support: '三类情形各从空状态开始。先根据客户端信息写判断与预测，再发送和展开教学观察；相同编号可多次收到，响应数不等于工单数。换模式或标识策略创建新方案，重新验证三类情形。',
    },
    vision: {
      part: '筛查规则建议单', output: '缺陷筛查规则建议单',
      criteria: [
        ['C1', '分类结果解释', '用具体图卡解释TP/FN/FP/TN及准确率、召回、复检量；能说明准确率上升与漏检增多为何可同时发生。'],
        ['C2', '任务条件下选择规则', '依据本人至少两组不同分组的观察，说明最终阈值如何同时满足零漏检与复检不超过5；分数使用0–100整数教学刻度。'],
        ['C3', '依据与适用范围', '明确标签和分数是手工教学设定，结论仅适用本批样本，不能解释为概率、真实模型性能或未来产线保证。选做上限4的不可行分析不影响基础评价。'],
      ],
      support: '先写变化预测，调节整数阈值并查看具体图卡去向，再主动记录观察。至少两组分组不同的基础观察；只移动阈值不算保存。选择基础最终规则并说明双条件与范围。复检上限4为可选拓展。',
    },
    warehouse: {
      part: '路线设计与验证说明', output: '仓储任务路线设计与验证说明',
      criteria: [
        ['C1', '问题建模', '区分固定地图与访问输入、各点办理和返回及截止约束、可行方案中缩短距离的目标，说明真实因素省略范围。'],
        ['C2', '路线计算与对照', '依据两条不同基础顺序的预测与实际逐段计算解释办理时刻和总距离；途经不办理、经过D不结束，较长但按时的方案仍可行。'],
        ['C3', '条件迁移与验证', '明确取消A≤4改为B≤1，对原基础最终顺序重新计算，再用新条件验证所选方案并解释调整；旧基础记录保持原义。缺少迁移保持待完成，不虚构能力失败。'],
      ],
      support: 'A/B/C各安排一次，D自动固定两端。先预测再计算和记录两条基础路线，选择最终方案。必要迁移取消A时限、改B≤1，先复核原顺序再选择新方案。播放与重放只回看计算，不新增成果；A≤3为可选拓展。',
    },
  }[caseId];
  const checks: TeachingPlan['checks'] = [
    { id: 'simulation-rule', revision: 1, criterion: '本次规则计算、必要记录与任务条件', required: true, appliesWhen: 'always', evaluator: 'rule', ruleId: `${caseId}-simulation-v1`, sourceRefs: sources.map((s) => s.sourceId) },
    ...descriptions.criteria.map(([id, , criterion]) => ({ id, revision: 1, criterion, required: true, appliesWhen: 'always' as const, evaluator: 'ai' as const, sourceRefs: sources.map((s) => s.sourceId) })),
  ];
  return {
    schemaVersion: 1, title: info.title, professionalGroup: '软件技术专业群', occupation: '计算机程序设计员',
    jobTask: info.description, learnerProfile: '具备基础计算机知识，需要练习基于契约建模、操作验证及有证据的解释。',
    learningGoals: descriptions.criteria.map(([, name]) => name), sources,
    competencies: descriptions.criteria.map(([id, name, description]) => ({ id, name, description, checkIds: [id] })), checks,
    outputs: [{ id: 'S', title: descriptions.output, requiredParts: [descriptions.part], activityRefs: [sceneId], checkRefs: checks.map((c) => c.id), interaction: caseId }],
    activities: [{ stageId, sceneId, outputGroupId: 'S', purpose: '进入实训：预测、操作、验证与保存', checkRefs: checks.map((c) => c.id), contentRevision: info.version, required: true }],
    supportNotes: descriptions.support, orderedActivityRefs: [sceneId], changeReason: '复用正式材料建立本次教学安排', basedOnEvidenceIds: [],
  };
}
