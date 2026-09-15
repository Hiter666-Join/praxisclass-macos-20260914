'use client';

import { useEffect, useId, useState } from 'react';
import { SelectField } from '@/components/ui/select';
import { documentApi, type DocumentSummary } from './document-api';

export function KnowledgeCaseSelector({
  value,
  onChange,
  disabled = false,
  allowAll = true,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowAll?: boolean;
}) {
  const id = useId();
  const [cases, setCases] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    documentApi<{ documents: DocumentSummary[] }>()
      .then((result) => {
        if (active)
          setCases([
            ...new Set(
              result.documents
                .filter(
                  (doc) => doc.publishedRevision === doc.revision && doc.status !== 'deleting',
                )
                .map((doc) => doc.caseName),
            ),
          ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="shrink-0 text-sm font-medium leading-6 text-foreground">
        案例知识库
      </label>
      <SelectField
        id={id}
        aria-label="选择案例知识库"
        className="sm:w-64"
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        options={[
          { value: '', label: allowAll ? '全部知识' : '暂不关联' },
          ...[...new Set([...cases, ...(value ? [value] : [])])].map((name) => ({
            value: name,
            label: name,
          })),
        ]}
      />
    </div>
  );
}
