/** Presentation metadata only. Installed skills always come from the server registry. */
export const skillCategories = [
  'teaching',
  'learning',
  'evidence',
  'production',
  'reference',
  'personal',
] as const;
export type SkillCategory = (typeof skillCategories)[number];
type Copy = { benefit: string; scenario: string };
type SkillGuide = { category: SkillCategory; zh: Copy; en: Copy };

export const skillCatalog: Record<string, SkillGuide> = {
  'stage-design': {
    category: 'teaching',
    zh: {
      benefit: '组织课程计划、师生角色、逐页生成、旁白与音频，并检查课堂交付是否完整。',
      scenario: '从零创建或重建一节完整课堂。',
    },
    en: {
      benefit:
        'Organizes the lesson plan, teaching roles, pages, narration and audio, then checks completion.',
      scenario: 'Creating or rebuilding one complete classroom.',
    },
  },
  'curriculum-planner': {
    category: 'teaching',
    zh: {
      benefit: '把学习目标拆成相互衔接的多节课，先确认全套计划，再逐节生成并统一归档。',
      scenario: '7 天学 Python、入职培训、按章节组织的单元课程。',
    },
    en: {
      benefit:
        'Plans a connected series, confirms the full lesson list, then builds and organizes lessons in order.',
      scenario: 'A seven-day Python course, onboarding or chapter-based units.',
    },
  },
  'lecture-style': {
    category: 'teaching',
    zh: {
      benefit: '用连贯讲解和多个案例建立推理链，安排少量关键检查，帮助学生系统理解主题。',
      scenario: '专题讲座、理论梳理、大师课与系统讲解。',
    },
    en: {
      benefit: 'Builds a sustained explanation through cases and a few deliberate checkpoints.',
      scenario: 'Lectures, masterclasses and systematic explanations.',
    },
  },
  'workshop-style': {
    category: 'teaching',
    zh: {
      benefit: '以短讲解引出动手练习，穿插检查与反馈，最后把所学汇成一个小项目。',
      scenario: '工具入门、训练营、边做边学的实践课堂。',
    },
    en: {
      benefit: 'Pairs short task briefs with exercises and feedback, ending in a small project.',
      scenario: 'Tool introductions, bootcamps and hands-on workshops.',
    },
  },
  'deep-interactive': {
    category: 'teaching',
    zh: {
      benefit: '让学生操作模拟、探索图示、运行代码或观察三维结构，通过改变条件理解机制。',
      scenario: '算法过程、变量关系、科学模拟和空间结构探索。',
    },
    en: {
      benefit:
        'Uses simulations, diagrams, runnable code or 3D scenes to explore mechanisms by changing conditions.',
      scenario: 'Algorithms, variable relationships, simulations and spatial structures.',
    },
  },
  vocational: {
    category: 'teaching',
    zh: {
      benefit: '把岗位任务转成准备、操作、检查与交接环节，明确工具、步骤、错误后果和完成标准。',
      scenario: '设备检修、装配、检测等具有操作流程与继续／停止判断的实训。',
    },
    en: {
      benefit:
        'Turns job tasks into preparation, operation, verification and handover with tools, consequences and completion criteria.',
      scenario: 'Repair, assembly and inspection with procedures and go/stop decisions.',
    },
  },
  'understanding-by-design': {
    category: 'learning',
    zh: {
      benefit: '先确定学生要理解什么、如何证明理解，再设计活动，让目标、任务和评价相互对应。',
      scenario: '概念课、项目学习，以及强调知识迁移的单元设计。',
    },
    en: {
      benefit:
        'Defines lasting understanding and assessment evidence before designing learning activities.',
      scenario: 'Concept lessons, projects and units focused on transfer.',
    },
  },
  'spiral-curriculum': {
    category: 'learning',
    zh: {
      benefit: '让核心概念在系列课中反复出现，每次提高复杂度、抽象程度或应用难度。',
      scenario: '需要逐步深化理解的系列课，而非简单重复复习。',
    },
    en: {
      benefit:
        'Revisits core concepts across lessons at increasing levels of complexity, abstraction and transfer.',
      scenario: 'Course series that progressively deepen understanding.',
    },
  },
  'feynman-learning': {
    category: 'learning',
    zh: {
      benefit:
        '组织先解释、找缺口、追问补全、改写与迁移的循环，形成学习记录。页面提供活动与自检，逐句反馈在对话中开展。',
      scenario: '让学生把概念讲给外行听，检验是否真正理解。',
    },
    en: {
      benefit:
        'Structures explanation, gap finding, questioning, rewriting and transfer. Pages support activities and self-checks; sentence-level feedback uses chat.',
      scenario: 'Teach-back activities that test understanding beyond memorization.',
    },
  },
  'k12-core-literacy-planning': {
    category: 'learning',
    zh: {
      benefit: '把学科核心素养落实到真实情境、任务群、学生作品和表现性评价。',
      scenario: '中小学按学段、学科组织的素养导向课程。',
    },
    en: {
      benefit:
        'Connects subject competencies with authentic situations, tasks, student work and performance assessment.',
      scenario: 'Grade- and subject-specific Chinese K–12 lessons.',
    },
  },
  'learning-to-learn': {
    category: 'learning',
    zh: {
      benefit: '在学科任务中嵌入主动回忆、自我解释、先预测后验证和复习安排，让学生练习学习方法。',
      scenario: '希望同时培养自主学习、理解检查和反思能力的概念课。',
    },
    en: {
      benefit:
        'Embeds retrieval, self-explanation, prediction, feedback and review into subject tasks.',
      scenario: 'Concept lessons that also develop independent learning and reflection.',
    },
  },
  'social-emotional-learning': {
    category: 'learning',
    zh: {
      benefit: '在学科活动中融入情绪觉察、自我管理、换位思考、合作讨论和负责任决策。',
      scenario: '需要协作、观点讨论或失败后反馈重试的课堂。',
    },
    en: {
      benefit:
        'Embeds emotional awareness, self-management, perspective taking, collaboration and responsible decisions.',
      scenario: 'Lessons involving teamwork, debate or feedback and retry after setbacks.',
    },
  },
  'deep-research': {
    category: 'evidence',
    zh: {
      benefit: '先检索并读取来源，记录关键结论与出处、处理资料冲突，再把核实内容带入课程。',
      scenario: '最新技术、政策变化、产品版本和需要外部证据的真实案例。',
    },
    en: {
      benefit:
        'Researches and reads sources, tracks claims and evidence, resolves conflicts and grounds lesson content.',
      scenario: 'Recent technology, policy, product versions and evidence-based cases.',
    },
  },
  'fact-check': {
    category: 'evidence',
    zh: {
      benefit:
        '检查关键数字、日期、定义、公式和跨页矛盾，区分明确错误与待核实事项，给出依据和修改建议。',
      scenario: '新课程交付前核查，或审查已有课件与资料的准确性。',
    },
    en: {
      benefit:
        'Checks important numbers, dates, definitions, formulas and contradictions, with evidence and suggested corrections.',
      scenario: 'Pre-delivery checks or factual review of existing lessons and materials.',
    },
  },
  'pptx-import': {
    category: 'production',
    zh: {
      benefit: '将 PPTX 导入课堂，保留原有排版并检查修复问题，再补充讲解、重点提示与音频。',
      scenario: '把教师现有 PPT 转成可讲授课堂，按需增加测验或互动。',
    },
    en: {
      benefit:
        'Imports PPTX pages, preserves layouts, checks problems and adds narration, emphasis and audio.',
      scenario: 'Turning existing slides into a narrated classroom, with optional exercises.',
    },
  },
  'style-clone': {
    category: 'production',
    zh: {
      benefit: '从已有课件提取版式库，为新内容选择模板并替换内容，延续配色、字体和视觉表达。',
      scenario: '沿用示范课件或学校模板的设计，制作全新主题课程。',
    },
    en: {
      benefit: 'Reuses a deck’s layouts, palette and typography to build pages for a new subject.',
      scenario: 'Creating new lessons in an exemplar deck or school template’s visual style.',
    },
  },
  'teacher-style-clone': {
    category: 'production',
    zh: {
      benefit: '依据教师录像、转写稿或讲义，提炼开场、举例、提问和讲解节奏，并应用于新课程。',
      scenario: '有教师示范材料，希望复用有据可查的教学表达习惯。',
    },
    en: {
      benefit:
        'Extracts evidenced openings, examples, questions and pacing from teacher recordings or handouts for new lessons.',
      scenario: 'Reusing teaching delivery patterns from supplied exemplar materials.',
    },
  },
  'page-clone': {
    category: 'production',
    zh: {
      benefit: '复制已有页面的设计，替换文字等内容并处理排版溢出，保持单页风格一致。',
      scenario: '“照这页的样子，再做一页”的局部扩展。',
    },
    en: {
      benefit: 'Duplicates an existing page’s design, replaces content and handles overflow.',
      scenario: 'Adding one page that matches an existing example.',
    },
  },
  'pro-editing': {
    category: 'production',
    zh: {
      benefit: '先读取再局部修改页面、测验、顺序和旁白，检查修改结果及音频一致性。',
      scenario: '修订、优化和重排已经生成的课程。',
    },
    en: {
      benefit:
        'Reads before editing pages, quizzes, order and narration, then checks results and audio consistency.',
      scenario: 'Revising, improving or reorganizing an existing classroom.',
    },
  },
  'slide-craft': {
    category: 'production',
    zh: {
      benefit: '提供字体层级、文字高度、颜色对比、间距和图层规则，指导页面细节调整。',
      scenario: '改善文字溢出、页面拥挤、对比不足和视觉不一致。',
    },
    en: {
      benefit: 'Guides typography, text sizing, contrast, spacing and layering for slide edits.',
      scenario: 'Fixing overflow, crowded layouts, low contrast and inconsistent styling.',
    },
  },
  'slide-dsl': {
    category: 'reference',
    zh: {
      benefit: '说明画布、文字、图片、表格等元素的字段和渲染规则，帮助智能体准确修改页面。',
      scenario: '定位页面属性，处理字段错误或修改未显示的问题。',
    },
    en: {
      benefit: 'Documents canvas and element fields and rendering rules for precise page edits.',
      scenario: 'Finding slide properties or diagnosing rejected or invisible edits.',
    },
  },
  'stage-dsl': {
    category: 'reference',
    zh: {
      benefit: '说明课堂、大纲、场景、测验、交互和项目文档的结构，指导正确读取与修改。',
      scenario: '定位课堂内容，编辑测验、互动组件、讲解动作与项目任务。',
    },
    en: {
      benefit:
        'Maps classroom, outline, scene, quiz, interaction and project structures for reliable reading and editing.',
      scenario: 'Locating and updating lesson content, activities and project tasks.',
    },
  },
  'build-personal-skill': {
    category: 'personal',
    zh: {
      benefit:
        '读取记忆中已保存的人物画像和长期记忆，将相关教学偏好应用到课程大纲、课件内容与讲解；本次课程要求优先。',
      scenario: '沿用教师已确认的案例导入、实训步骤、表达习惯和验收标准，准备新的课程。',
    },
    en: {
      benefit:
        'Applies the saved teacher profile and long-term memory to outlines, lesson content and narration. Current course requirements take priority.',
      scenario:
        'Reusing confirmed preferences for case introductions, practice steps, explanations and assessment criteria in new lessons.',
    },
  },
};

export function getSkillGuide(name: string, locale: string) {
  const guide = skillCatalog[name];
  return guide
    ? { category: guide.category, ...(locale.startsWith('zh') ? guide.zh : guide.en) }
    : null;
}

export function skillCatalogCopy(locale: string) {
  return locale.startsWith('zh')
    ? {
        title: '从教学设计到课堂交付',
        intro: '按教学任务选择技能，查看它能解决的问题与适用场景。',
        enabled: '已启用',
        onDemand: '按需调用',
        library: '内置技能库',
        benefit: '功效',
        scenario: '适用场景',
        search: '搜索技能、功效或适用场景',
        all: '全部',
        noResults: '没有匹配的技能，试试其他关键词或分类。',
        clear: '清除筛选',
        ready: '内置技能默认启用，可按教学用途浏览功效、适用场景与技能详情，并下载技能文件。',
        catalogOnly:
          '内置技能库已启用，可浏览功效、适用场景并下载技能文件。当前个人技能管理暂不可用。',
        categories: {
          teaching: '课程组织与教学形式',
          learning: '教学方法与学习能力',
          evidence: '资料研究与内容可靠性',
          production: '课件制作与编辑',
          reference: '智能体结构参考',
          personal: '教师经验复用',
          other: '其他技能',
        },
      }
    : {
        title: 'From lesson design to classroom delivery',
        intro: 'Explore what each skill does and when to use it.',
        enabled: 'Enabled',
        onDemand: 'On demand',
        library: 'Built-in skill library',
        benefit: 'Benefits',
        scenario: 'When to use',
        search: 'Search skills, benefits or use cases',
        all: 'All',
        noResults: 'No matching skills. Try another keyword or category.',
        clear: 'Clear filters',
        ready:
          'Built-in skills are enabled by default. Browse their benefits, use cases and details, or download the skill files.',
        catalogOnly:
          'The built-in library is enabled for browsing and download. Personal skill management is currently unavailable.',
        categories: {
          teaching: 'Lesson organization & formats',
          learning: 'Teaching & learning methods',
          evidence: 'Research & reliability',
          production: 'Course production & editing',
          reference: 'Agent structure references',
          personal: 'Teacher experience reuse',
          other: 'Other skills',
        },
      };
}
