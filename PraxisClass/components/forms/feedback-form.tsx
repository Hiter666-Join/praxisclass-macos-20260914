'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  DEFAULT_COURSE_VERSION,
  splitFeedbackValues,
  type FeedbackFormSchema,
  type FeedbackValue,
} from '@/lib/platform/forms/schemas';

import { RatingRow } from './rating-row';
import { SelectField } from '@/components/ui/select';
import { recordKindForLearner } from '@/lib/platform/record-context';

export interface FeedbackFormProps {
  schema: FeedbackFormSchema;
  courseId: string;
  courseVersion?: string;
  stageId?: string;
  title?: string;
  subjectId: string;
  onSubmitted?: (id: string) => void;
}

function initialValues(schema: FeedbackFormSchema, courseVersion: string) {
  const values: Record<string, FeedbackValue> = {};
  for (const field of schema.fields) {
    if (field.kind === 'version') values[field.key] = courseVersion;
    else if (field.kind === 'multiselect') values[field.key] = [];
    else if (field.kind === 'text' || field.kind === 'integer') values[field.key] = '';
  }
  return values;
}

export function FeedbackForm({
  schema,
  courseId,
  courseVersion,
  stageId,
  title,
  subjectId,
  onSubmitted,
}: FeedbackFormProps) {
  const { t } = useI18n();
  const baseVersion = courseVersion?.trim() || DEFAULT_COURSE_VERSION;
  const [values, setValues] = useState<Record<string, FeedbackValue>>(() =>
    initialValues(schema, baseVersion),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recordKind, setRecordKind] = useState<'learning' | 'demo'>(() =>
    recordKindForLearner(subjectId),
  );
  const [submissionId] = useState(() => crypto.randomUUID());

  const setValue = (key: string, value: FeedbackValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const field of schema.fields) {
      const value = values[field.key];
      if (field.kind === 'rating') {
        if (field.required && typeof value !== 'number') {
          next[field.key] = t('platform.forms.error.required');
        }
      } else if (field.kind === 'integer') {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) {
          if (field.required) next[field.key] = t('platform.forms.error.required');
        } else {
          const numeric = Number(raw);
          if (!Number.isInteger(numeric) || numeric < 0) {
            next[field.key] = t('platform.forms.error.integer');
          }
        }
      } else if (field.kind === 'text' || field.kind === 'version') {
        const raw = typeof value === 'string' ? value : '';
        if (field.required && !raw.trim()) next[field.key] = t('platform.forms.error.required');
        else if (field.maxLength && raw.length > field.maxLength) {
          next[field.key] = t('platform.forms.error.maxLength', { max: field.maxLength });
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setSubmitError('');
    if (!validate()) return;
    const split = splitFeedbackValues(schema, values);
    const effectiveVersion = split.course_version || baseVersion;
    setSubmitting(true);
    try {
      const response = await fetch('/api/platform/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: schema.formType,
          subject_id: subjectId,
          record_kind:
            schema.formType === 'learner_session' ? recordKindForLearner(subjectId) : recordKind,
          course_id: courseId,
          // Learner forms have no version field; let the server resolve the stage label.
          ...(schema.fields.some((field) => field.kind === 'version') || courseVersion
            ? { course_version: effectiveVersion }
            : {}),
          ratings: split.ratings,
          text: split.text,
          idempotency_key: `${schema.formType}:${submissionId}`,
          ...(stageId ? { stage_id: stageId } : {}),
          ...(title ? { title } : {}),
        }),
      });
      if (!response.ok) {
        setSubmitError(t('platform.forms.error.submitFailed'));
        return;
      }
      const body = (await response.json()) as { id?: string };
      toast.success(t('platform.forms.submitted'));
      onSubmitted?.(body.id ?? '');
    } catch {
      setSubmitError(t('platform.forms.error.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FieldGroup className="gap-6">
      {schema.formType !== 'learner_session' && (
        <SelectField
          value={recordKind}
          onValueChange={(value) => setRecordKind(value as 'learning' | 'demo')}
          aria-label={t('studentLearning.recordKind')}
          options={[
            { value: 'learning', label: t('studentLearning.actualFeedback') },
            { value: 'demo', label: t('studentLearning.demo') },
          ]}
        />
      )}
      {schema.fields.map((field) => {
        const label = t(field.labelKey);
        const error = errors[field.key];
        if (field.kind === 'rating') {
          return (
            <Field key={field.key} data-invalid={!!error}>
              <RatingRow
                label={label}
                required={field.required}
                invalid={!!error}
                value={
                  typeof values[field.key] === 'number' ? (values[field.key] as number) : undefined
                }
                onChange={(next) => setValue(field.key, next)}
              />
              <FieldError>{error}</FieldError>
            </Field>
          );
        }
        if (field.kind === 'multiselect') {
          const selected = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
          return (
            <Field key={field.key}>
              <FieldLabel>{label}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(field.options ?? []).map((option) => {
                  const active = selected.includes(option);
                  return (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      className="min-h-10 whitespace-normal text-left leading-5"
                      aria-pressed={active}
                      variant={active ? 'default' : 'outline'}
                      onClick={() =>
                        setValue(
                          field.key,
                          active ? selected.filter((o) => o !== option) : [...selected, option],
                        )
                      }
                    >
                      {t(option)}
                    </Button>
                  );
                })}
              </div>
            </Field>
          );
        }
        if (field.kind === 'text') {
          const raw = typeof values[field.key] === 'string' ? (values[field.key] as string) : '';
          return (
            <Field key={field.key} data-invalid={!!error}>
              <FieldLabel htmlFor={`feedback-${field.key}`}>{label}</FieldLabel>
              <Textarea
                id={`feedback-${field.key}`}
                rows={3}
                className="min-h-28 leading-7"
                aria-invalid={!!error}
                value={raw}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
              {field.maxLength && (
                <FieldDescription>{`${raw.length}/${field.maxLength}`}</FieldDescription>
              )}
              <FieldError>{error}</FieldError>
            </Field>
          );
        }
        const raw = typeof values[field.key] === 'string' ? (values[field.key] as string) : '';
        return (
          <Field key={field.key} data-invalid={!!error}>
            <FieldLabel htmlFor={`feedback-${field.key}`}>
              {label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </FieldLabel>
            <Input
              id={`feedback-${field.key}`}
              inputMode={field.kind === 'integer' ? 'numeric' : 'text'}
              className="h-11"
              aria-invalid={!!error}
              value={raw}
              maxLength={field.maxLength}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
            <FieldError>{error}</FieldError>
          </Field>
        );
      })}

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      <Button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className="h-11 w-full"
      >
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {t('platform.forms.submit')}
      </Button>
    </FieldGroup>
  );
}
