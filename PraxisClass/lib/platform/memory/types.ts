export type MemoryScope = 'teacher' | 'learner';

export interface MemoryDoc {
  profile: string;
  memory: string;
  updatedAt: number | null;
}

export interface MemoryEventInput {
  eventType:
    | 'struggle'
    | 'hint_used'
    | 'task_completed'
    | 'tier_change'
    | 'prep_created'
    | 'template_used';
  summary: string;
  payload?: Record<string, unknown>;
}
