'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';

const SCALE = [1, 2, 3, 4, 5] as const;

interface RatingRowProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  required?: boolean;
  invalid?: boolean;
}

export function RatingRow({ label, value, onChange, required, invalid }: RatingRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const current = value ?? 0;
    const next = Math.min(5, Math.max(1, current + delta));
    onChange(next);
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next - 1]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={label}
        aria-required={required}
        aria-invalid={invalid}
        className="flex gap-1"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            move(value === undefined ? 1 : -1);
          }
        }}
      >
        {SCALE.map((score) => (
          <Button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            tabIndex={value === score || (value === undefined && score === 1) ? 0 : -1}
            size="icon-sm"
            className="size-11 rounded-xl"
            variant={value === score ? 'default' : 'outline'}
            onClick={() => onChange(score)}
          >
            {score}
          </Button>
        ))}
      </div>
    </div>
  );
}
