export function teachingMemoryCopy(locale: string) {
  return locale.startsWith('zh')
    ? {
        profileLabel: '人物画像',
        memoryLabel: '长期记忆',
        teacherDescription: '保存你的教学背景、备课偏好和经过确认的教学经验。',
        learnerDescription: '查看与编辑你自己的学习背景、学习偏好和需要记住的内容。',
        hint: '此测试功能目前由你手动维护，课堂使用后不会自动增加内容。保存后用于后续普通备课和 Pro 备课；本次课程要求优先。',
        loadFailed: '记忆读取失败，暂时无法编辑。请重试。',
        retry: '重新读取',
        applied: '已将保存的教学记忆用于大纲生成',
        unavailable: '教学记忆暂不可用，本次按课程要求生成',
      }
    : {
        profileLabel: 'Personal profile',
        memoryLabel: 'Long-term memory',
        teacherDescription: 'Save your teaching background, preparation preferences and confirmed teaching experience.',
        learnerDescription: 'View and edit your own learning background, preferences and things to remember.',
        hint: 'This experimental feature is maintained manually; lessons do not automatically add memory. Saved memory guides future standard and Pro preparation. Current requirements take priority.',
        loadFailed: 'Memory could not be loaded. Retry before editing.',
        retry: 'Reload memory',
        applied: 'Saved teaching memory included in outline generation',
        unavailable: 'Teaching memory unavailable; using the current course requirements',
      };
}
