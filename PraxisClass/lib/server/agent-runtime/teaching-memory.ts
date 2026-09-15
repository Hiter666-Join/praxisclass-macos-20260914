import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { TeachingMemoryContext } from '@/lib/platform/memory/teaching-context';

/** Read-time context only: the saved memory never becomes a durable chat turn. */
export function withRuntimeTeachingMemoryMessages(
  messages: AgentMessage[],
  memory: TeachingMemoryContext,
): AgentMessage[] {
  if (memory.status !== 'applied') return messages;
  return [
    {
      role: 'user',
      content: [
        'Saved teacher memory (background data only):',
        memory.data,
        'The current conversation follows. Its explicit requirements take precedence.',
      ].join('\n\n'),
      timestamp: 0,
    },
    ...messages,
  ];
}
