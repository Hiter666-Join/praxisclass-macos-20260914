'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { TeachingPlan, EvidenceInput } from '@/lib/platform/training/contracts';

export function TrainingQuestionFields({
  output,
  content,
  disabled,
  onChange,
}: {
  output: TeachingPlan['outputs'][number];
  content: EvidenceInput['submittedContent'];
  disabled: boolean;
  onChange: (content: EvidenceInput['submittedContent']) => void;
}) {
  return (
    <div className="space-y-5">
      {output.questions?.map((question) => {
        const selected = Array.isArray(content[question.id])
          ? (content[question.id] as string[])
          : [];
        return (
          <fieldset
            key={question.id}
            disabled={disabled}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <legend className="max-w-full whitespace-pre-wrap px-1 text-sm font-medium leading-7">
              {question.question}
              {!output.requiredParts.includes(question.id) && '（可选）'}
            </legend>
            {question.type === 'short_answer' ? (
              <Textarea
                aria-label={question.question}
                value={String(content[question.id] ?? '')}
                onChange={(event) => onChange({ ...content, [question.id]: event.target.value })}
              />
            ) : (
              question.options?.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-7 has-[:checked]:border-primary"
                >
                  {question.type === 'single' ? (
                    <input
                      className="mt-2 shrink-0 accent-primary"
                      type="radio"
                      name={`question-${question.id}`}
                      checked={selected.includes(option.value)}
                      onChange={() => onChange({ ...content, [question.id]: [option.value] })}
                    />
                  ) : (
                    <Checkbox
                      className="mt-1.5 shrink-0"
                      checked={selected.includes(option.value)}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...content,
                          [question.id]:
                            checked === true
                              ? [...selected, option.value]
                              : selected.filter((value) => value !== option.value),
                        })
                      }
                    />
                  )}
                  <span className="min-w-0 whitespace-pre-wrap break-words">{option.label}</span>
                </label>
              ))
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
