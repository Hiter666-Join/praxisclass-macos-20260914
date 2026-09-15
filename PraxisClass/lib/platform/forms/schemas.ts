export type FeedbackFormType = 'learner_session' | 'teacher_prep' | 'teacher_post_class';

export type FeedbackFieldKind = 'rating' | 'integer' | 'text' | 'multiselect' | 'version';

export interface FeedbackField {
  key: string;
  kind: FeedbackFieldKind;
  required?: boolean;
  labelKey: string;
  maxLength?: number;
  options?: string[];
}

export interface FeedbackFormSchema {
  formType: FeedbackFormType;
  fields: FeedbackField[];
}

export type FeedbackValue = string | number | string[] | undefined;

export const DEFAULT_COURSE_VERSION = 'v1';

export const learnerSessionSchema: FeedbackFormSchema = {
  formType: 'learner_session',
  fields: [
    {
      key: 'understanding',
      kind: 'rating',
      required: true,
      labelKey: 'platform.forms.field.understanding',
    },
    {
      key: 'difficulty',
      kind: 'rating',
      required: true,
      labelKey: 'platform.forms.field.difficulty',
    },
    {
      key: 'interaction_satisfaction',
      kind: 'rating',
      required: true,
      labelKey: 'platform.forms.field.interactionSatisfaction',
    },
    {
      key: 'blocker_text',
      kind: 'text',
      labelKey: 'platform.forms.field.blockerText',
      maxLength: 300,
    },
    {
      key: 'wanted_content_types',
      kind: 'multiselect',
      labelKey: 'platform.forms.field.wantedContentTypes',
      options: [
        'platform.forms.option.animation',
        'platform.forms.option.codePractice',
        'platform.forms.option.diagram',
        'platform.forms.option.quiz',
        'platform.forms.option.caseStudy',
        'platform.forms.option.dialogue',
      ],
    },
  ],
};

export const teacherPrepSchema: FeedbackFormSchema = {
  formType: 'teacher_prep',
  fields: [
    {
      key: 'generation_quality',
      kind: 'rating',
      required: true,
      labelKey: 'platform.forms.field.generationQuality',
    },
    {
      key: 'usability',
      kind: 'rating',
      required: true,
      labelKey: 'platform.forms.field.usability',
    },
    {
      key: 'edit_minutes',
      kind: 'integer',
      required: true,
      labelKey: 'platform.forms.field.editMinutes',
    },
    {
      key: 'classroom_fit',
      kind: 'rating',
      required: true,
      labelKey: 'platform.forms.field.classroomFit',
    },
    {
      key: 'course_version',
      kind: 'version',
      required: true,
      labelKey: 'platform.forms.field.courseVersion',
      maxLength: 32,
    },
    {
      key: 'improve_text',
      kind: 'text',
      labelKey: 'platform.forms.field.improveText',
      maxLength: 300,
    },
  ],
};

export const teacherPostClassSchema: FeedbackFormSchema = {
  formType: 'teacher_post_class',
  fields: [
    {
      key: 'engagement_observed',
      kind: 'rating',
      labelKey: 'platform.forms.field.engagementObserved',
    },
    {
      key: 'comprehension_observed',
      kind: 'rating',
      labelKey: 'platform.forms.field.comprehensionObserved',
    },
    { key: 'pace_fit', kind: 'rating', labelKey: 'platform.forms.field.paceFit' },
    {
      key: 'common_blockers',
      kind: 'text',
      labelKey: 'platform.forms.field.commonBlockers',
      maxLength: 300,
    },
    {
      key: 'course_version',
      kind: 'version',
      required: true,
      labelKey: 'platform.forms.field.courseVersion',
      maxLength: 32,
    },
  ],
};

export const FEEDBACK_SCHEMAS: Record<FeedbackFormType, FeedbackFormSchema> = {
  learner_session: learnerSessionSchema,
  teacher_prep: teacherPrepSchema,
  teacher_post_class: teacherPostClassSchema,
};

export function splitFeedbackValues(
  schema: FeedbackFormSchema,
  values: Record<string, FeedbackValue>,
): {
  ratings: Record<string, number>;
  text: Record<string, string | string[]>;
  course_version: string;
} {
  const ratings: Record<string, number> = {};
  const text: Record<string, string | string[]> = {};
  let courseVersion = DEFAULT_COURSE_VERSION;

  for (const field of schema.fields) {
    const value = values[field.key];
    switch (field.kind) {
      case 'rating': {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) ratings[field.key] = numeric;
        break;
      }
      case 'integer': {
        const numeric = typeof value === 'number' ? value : Number(value);
        // `edit_minutes` is unbounded, while the API caps `ratings` at 1..5 and
        // the aggregator reads it out of `text_json`; it travels as text.
        if (Number.isFinite(numeric) && numeric >= 0) text[field.key] = String(numeric);
        break;
      }
      case 'text': {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (trimmed) text[field.key] = trimmed;
        break;
      }
      case 'multiselect': {
        if (Array.isArray(value) && value.length > 0) text[field.key] = value;
        break;
      }
      case 'version': {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (trimmed) courseVersion = trimmed;
        break;
      }
    }
  }

  return { ratings, text, course_version: courseVersion };
}
