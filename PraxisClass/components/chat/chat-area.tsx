'use client';

import {
  useImperativeHandle,
  forwardRef,
  useRef,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from 'react';
import type { SessionType } from '@/lib/types/chat';
import type { DiscussionRequest } from '@/components/roundtable';
import type { Action } from '@/lib/types/action';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { buildLectureNotes } from '@/lib/chat/lecture-notes';
import { PanelRightClose, BookOpen, MessageSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useChatSessions,
  MANUAL_STOP_END_OPTIONS,
  type EndSessionOptions,
  type SessionCleanupPayload,
  type ChatMessageSendOptions,
} from './use-chat-sessions';
import { SessionList } from './session-list';
import { LectureNotesView } from './lecture-notes-view';

interface ChatAreaProps {
  className?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  activeBubbleId?: string | null;
  onActiveBubble?: (messageId: string | null) => void;
  onLiveSpeech?: (text: string | null, agentId?: string | null) => void;
  onSpeechProgress?: (ratio: number | null) => void;
  onThinking?: (state: { stage: string; agentId?: string } | null) => void;
  onCueUser?: (fromAgentId?: string, prompt?: string) => void;
  onLiveSessionError?: () => void;
  onSoftCloseSession?: (payload: SessionCleanupPayload) => void;
  onSoftClosingChange?: (softClosing: boolean, deadline?: number) => void;
  onStopSession?: (payload: SessionCleanupPayload) => void;
  onSegmentSealed?: (
    messageId: string,
    partId: string,
    fullText: string,
    agentId: string | null,
  ) => void;
  /** When provided and returns true, StreamBuffer holds on the current text item after reveal. */
  shouldHoldAfterReveal?: () => { holding: boolean; segmentDone: number } | boolean;
  currentSceneId?: string | null;
  currentActionIndex?: number | null;
  canJumpToAction?: (sceneId: string, actionIndex: number) => boolean;
  onJumpToAction?: (sceneId: string, actionIndex: number) => void;
}

export interface ChatAreaRef {
  createSession: (type: SessionType, title: string) => Promise<string>;
  endSession: (sessionId: string, options?: EndSessionOptions) => Promise<void>;
  endActiveSession: (options?: EndSessionOptions) => Promise<void>;
  stopActiveSession: () => Promise<void>;
  continueActiveSoftClosingSession: () => boolean;
  softPauseActiveSession: () => Promise<void>;
  resumeActiveSession: () => Promise<void>;
  sendMessage: (content: string, options?: ChatMessageSendOptions) => Promise<void>;
  startDiscussion: (request: DiscussionRequest) => Promise<void>;
  startLecture: (sceneId: string) => Promise<string>;
  addLectureMessage: (sessionId: string, action: Action, actionIndex: number) => void;
  getIsStreaming: () => boolean;
  getActiveSessionType: () => string | null;
  getLectureMessageId: (sessionId: string) => string | null;
  pauseBuffer: (sessionId: string) => void;
  resumeBuffer: (sessionId: string) => void;
  pauseActiveLiveBuffer: () => boolean;
  resumeActiveLiveBuffer: () => void;
  switchToTab: (tab: 'lecture' | 'chat') => void;
}

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

export const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(
  (
    {
      className,
      width = DEFAULT_WIDTH,
      onWidthChange,
      collapsed = false,
      onCollapseChange,
      activeBubbleId,
      onActiveBubble,
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onLiveSessionError,
      onSoftCloseSession,
      onSoftClosingChange,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
      currentSceneId,
      currentActionIndex,
      canJumpToAction,
      onJumpToAction,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const scenes = useStageStore((s) => s.scenes);
    const {
      sessions,
      activeSessionType,
      expandedSessionIds,
      isStreaming,
      createSession,
      endSession,
      endActiveSession,
      continueSoftClosingSession,
      confirmSoftClosingSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      toggleSessionExpand,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
    } = useChatSessions({
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onActiveBubble,
      onLiveSessionError,
      onSoftCloseSession,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
    });

    const [activeTab, setActiveTab] = useState<'lecture' | 'chat'>('lecture');
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Derive lecture notes directly from scenes — updates reactively as scenes stream in.
    const lectureNotes = useMemo(() => buildLectureNotes(scenes), [scenes]);
    const sceneTypes = useMemo(
      () => Object.fromEntries(scenes.map((scene) => [scene.id, scene.type])),
      [scenes],
    );

    // Filter out lecture sessions for the Chat tab
    const chatSessions = useMemo(() => sessions.filter((s) => s.type !== 'lecture'), [sessions]);

    // Whether there's an active discussion/QA session (for amber dot on Chat tab)
    const hasActiveChatSession = useMemo(
      () => chatSessions.some((s) => s.status === 'active'),
      [chatSessions],
    );

    const softClosingChatSession = useMemo(
      () => chatSessions.find((s) => s.status === 'soft-closing'),
      [chatSessions],
    );

    useEffect(() => {
      onSoftClosingChange?.(
        Boolean(softClosingChatSession),
        softClosingChatSession?.softCloseDeadline,
      );
    }, [softClosingChatSession, onSoftClosingChange]);

    // Wrap endSession for QA/Discussion: also notify parent for engine cleanup
    const handleEndSession = useCallback(
      async (sessionId: string) => {
        const session = chatSessions.find((candidate) => candidate.id === sessionId);
        if (session?.status === 'soft-closing') {
          const payload = await confirmSoftClosingSession(sessionId);
          if (payload) onStopSession?.(payload);
          return;
        }
        await endSession(sessionId, MANUAL_STOP_END_OPTIONS);
        onStopSession?.({ sessionId, source: 'manual_stop' });
      },
      [chatSessions, confirmSoftClosingSession, endSession, onStopSession],
    );

    const handleStopActiveSession = useCallback(async () => {
      const active = chatSessions.find(
        (session) => session.status === 'active' || session.status === 'soft-closing',
      );
      if (active) await handleEndSession(active.id);
    }, [chatSessions, handleEndSession]);

    const handleContinueActiveSoftClosingSession = useCallback((): boolean => {
      const softClosing = chatSessions.find((session) => session.status === 'soft-closing');
      return softClosing ? continueSoftClosingSession(softClosing.id) : false;
    }, [chatSessions, continueSoftClosingSession]);

    const switchToTab = useCallback((tab: 'lecture' | 'chat') => {
      setActiveTab(tab);
    }, []);

    useImperativeHandle(ref, () => ({
      createSession,
      endSession,
      endActiveSession,
      stopActiveSession: handleStopActiveSession,
      continueActiveSoftClosingSession: handleContinueActiveSoftClosingSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      getIsStreaming: () => isStreaming,
      getActiveSessionType: () => activeSessionType,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
      switchToTab,
    }));

    // Drag-to-resize
    const handleDragStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (me: MouseEvent) => {
          const delta = startX - me.clientX;
          const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
          onWidthChange?.(newWidth);
        };

        const handleMouseUp = () => {
          isDraggingRef.current = false;
          setIsDragging(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [width, onWidthChange],
    );

    const displayWidth = collapsed ? 0 : width;

    return (
      <div
        style={{
          width: displayWidth,
        }}
        className={cn(
          'bg-card border-l border-border flex flex-col shrink-0 z-20 relative overflow-visible max-lg:max-w-[85vw] transition-[width] duration-200 motion-reduce:transition-none',
          isDragging && 'transition-none',
          className,
        )}
      >
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 bottom-0 hidden lg:block w-1.5 cursor-col-resize z-50 group hover:bg-primary/20 active:bg-primary/30 transition-colors"
          >
            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
          </div>
        )}

        <div className={cn('flex flex-col w-full h-full overflow-hidden', collapsed && 'hidden')}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'lecture' | 'chat')}
            className="flex flex-col h-full gap-0"
          >
            {/* Panel heading + segmented control (mirrors the learning-path sidebar head) */}
            <div
              data-classroom-record-head
              className="shrink-0 border-b border-border/70 px-3 pb-2.5"
            >
              <div className="flex h-14 items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {t('classroomRecord.title')}
                </h2>
                {onCollapseChange && (
                  <button
                    onClick={() => onCollapseChange(true)}
                    className="size-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('platform.design.closeNotes')}
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                )}
              </div>
              <TabsList className="h-9 w-full rounded-lg p-0.5">
                <TabsTrigger value="lecture" className="gap-1.5 text-xs">
                  <BookOpen className="size-3.5" />
                  {t('classroomRecord.lectureTab')}
                  <span className="rounded-full bg-muted-foreground/12 px-1.5 py-px text-[10px] font-medium tabular-nums">
                    {lectureNotes.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1.5 text-xs">
                  <MessageSquare className="size-3.5" />
                  {t('classroomRecord.chatTab')}
                  <span className="rounded-full bg-muted-foreground/12 px-1.5 py-px text-[10px] font-medium tabular-nums">
                    {chatSessions.length}
                  </span>
                  {/* Amber pulse dot when there's an active chat session and user is on Notes tab */}
                  {hasActiveChatSession && activeTab === 'lecture' && (
                    <span className="absolute top-0.5 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Notes Tab */}
            <TabsContent value="lecture" className="flex-1 overflow-hidden flex flex-col">
              <LectureNotesView
                notes={lectureNotes}
                sceneTypes={sceneTypes}
                currentSceneId={currentSceneId}
                currentActionIndex={currentActionIndex}
                canJumpToAction={canJumpToAction}
                onJumpToAction={onJumpToAction}
              />
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 scrollbar-hide">
                {chatSessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <div className="size-12 bg-muted rounded-xl flex items-center justify-center mb-4 text-muted-foreground">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {t('chat.noConversations')}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground mt-2">
                      {t('chat.startConversation')}
                    </p>
                  </div>
                ) : (
                  <>
                    <SessionList
                      sessions={chatSessions}
                      expandedSessionIds={expandedSessionIds}
                      isStreaming={isStreaming}
                      activeBubbleId={activeBubbleId}
                      onToggleExpand={toggleSessionExpand}
                      onEndSession={handleEndSession}
                      onContinueSession={continueSoftClosingSession}
                    />
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  },
);

ChatArea.displayName = 'ChatArea';
