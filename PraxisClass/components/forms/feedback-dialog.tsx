'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/hooks/use-i18n';

import { FeedbackForm, type FeedbackFormProps } from './feedback-form';

interface FeedbackDialogProps extends FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange, ...formProps }: FeedbackDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-xl sm:p-8">
        <DialogHeader>
          <DialogTitle>{t(`platform.forms.title.${formProps.schema.formType}`)}</DialogTitle>
          <DialogDescription>
            {formProps.title ?? t('platform.forms.dialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm
          {...formProps}
          onSubmitted={(id) => {
            formProps.onSubmitted?.(id);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
