'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Pause,
  Play,
  Repeat,
  Loader2,
  Volume2,
  Quote,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AudioIndicatorState } from './audio-indicator';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useI18n } from '@/lib/hooks/use-i18n';
import { toast } from 'sonner';
import { useSettingsStore, PLAYBACK_SPEEDS } from '@/lib/store/settings';
import { ProactiveCard } from '@/components/chat/proactive-card';
import { PresentationSpeechOverlay } from '@/components/roundtable/presentation-speech-overlay';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { DEFAULT_TEACHER_AVATAR, DEFAULT_USER_AVATAR } from '@/components/roundtable/constants';
import type { DiscussionAction } from '@/lib/types/action';
import type { EngineMode, PlaybackView } from '@/lib/playback';
import type { Participant } from '@/lib/types/roundtable';

export interface DiscussionRequest {
  topic: string;
  prompt?: string;
  agentId?: string; // Agent ID to initiate discussion (default: 'default-1')
}

interface RoundtableProps {
  readonly mode?: 'playback' | 'autonomous';
  readonly initialParticipants?: Participant[];
  readonly playbackView?: PlaybackView; // Centralised derived state from Stage
  readonly currentSpeech?: string | null; // Live SSE speech (from StreamBuffer — discussion/QA)
  readonly lectureSpeech?: string | null; // Active lecture speech (from PlaybackEngine, full text)
  readonly idleText?: string | null; // Static idle text (first speech action)
  readonly playbackCompleted?: boolean; // True when engine finished all actions (show restart icon)
  readonly discussionRequest?: DiscussionAction | null;
  readonly engineMode?: EngineMode;
  readonly isStreaming?: boolean;
  readonly sessionType?: 'qa' | 'discussion';
  readonly speakingAgentId?: string | null;
  readonly audioIndicatorState?: AudioIndicatorState;
  readonly audioAgentId?: string | null;
  readonly speechProgress?: number | null; // StreamBuffer reveal progress (0–1) for auto-scroll
  readonly showEndFlash?: boolean;
  readonly endFlashSessionType?: 'qa' | 'discussion';
  readonly thinkingState?: { stage: string; agentId?: string } | null;
  readonly isCueUser?: boolean;
  /** Session entered the soft-closing grace window (client-side, ~15s). */
  readonly isSoftClosing?: boolean;
  readonly softCloseDeadline?: number;
  readonly isTopicPending?: boolean;
  readonly onMessageSend?: (message: string) => void;
  readonly onDiscussionStart?: (request: DiscussionAction) => void;
  readonly onDiscussionSkip?: () => void;
  readonly onStopDiscussion?: () => void;
  readonly onContinueDiscussion?: () => void;
  readonly onInputActivate?: () => void;
  readonly onUserInputActivity?: (
    kind: 'text_input' | 'composition_start' | 'recording_start',
  ) => void;

  readonly onResumeTopic?: () => void;
  readonly onPlayPause?: () => void;
  readonly isDiscussionPaused?: boolean;
  readonly onDiscussionPause?: () => void;
  readonly onDiscussionResume?: () => void;
  readonly totalActions?: number;
  readonly currentActionIndex?: number;
  // Toolbar props (merged from CanvasArea)
  readonly currentSceneIndex?: number;
  readonly scenesCount?: number;
  readonly whiteboardOpen?: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide?: () => void;
  readonly onNextSlide?: () => void;
  readonly onWhiteboardClose?: () => void;
  readonly isPresenting?: boolean;
  readonly controlsVisible?: boolean;
  readonly onTogglePresentation?: () => void;
  readonly onPresentationInteractionChange?: (active: boolean) => void;
  /** Ref to the fullscreen container — passed to ProactiveCard so its portal
   *  renders inside the top-layer during presentation mode. */
  readonly fullscreenContainerRef?: React.RefObject<HTMLDivElement | null>;
  readonly showElementReference?: boolean;
  readonly canPickSlideElement?: boolean;
  readonly elementPickActive?: boolean;
  readonly onToggleElementPick?: () => void;
  readonly elementReferencePill?: {
    sceneLabel: string;
    elementType: string;
    displaySummary: string;
  };
  readonly onClearElementReference?: () => void;
}

// This must stay in sync with the non-presentation textarea's max-h-[100px] class.
const NON_PRESENTATION_INPUT_MAX_HEIGHT_PX = 100;

const VOICE_WAVE_BARS = [
  { peak: 18, duration: 0.55 },
  { peak: 24, duration: 0.72 },
  { peak: 15, duration: 0.63 },
  { peak: 22, duration: 0.68 },
  { peak: 27, duration: 0.78 },
  { peak: 19, duration: 0.61 },
  { peak: 26, duration: 0.74 },
  { peak: 17, duration: 0.58 },
  { peak: 23, duration: 0.7 },
  { peak: 16, duration: 0.57 },
  { peak: 21, duration: 0.66 },
  { peak: 14, duration: 0.53 },
] as const;

function VoiceWaveformBars({ barClassName }: { readonly barClassName: string }) {
  return VOICE_WAVE_BARS.map((bar, i) => (
    <motion.div
      key={i}
      animate={{
        height: [4, bar.peak, 4],
        opacity: [0.3, 1, 0.3],
      }}
      transition={{
        repeat: Infinity,
        duration: bar.duration,
        delay: i * 0.05,
        ease: 'easeInOut',
      }}
      className={cn('w-1 rounded-full', barClassName)}
    />
  ));
}

export function Roundtable({
  mode: _mode = 'autonomous',
  initialParticipants = [],
  playbackView,
  currentSpeech,
  lectureSpeech,
  idleText,
  playbackCompleted,
  discussionRequest,
  engineMode = 'idle',
  isStreaming,
  sessionType,
  speakingAgentId,
  audioIndicatorState,
  audioAgentId,
  speechProgress: _speechProgress,
  showEndFlash,
  endFlashSessionType = 'discussion',
  thinkingState,
  isCueUser,
  isSoftClosing,
  softCloseDeadline,
  isTopicPending,
  onMessageSend,
  onDiscussionStart,
  onDiscussionSkip,
  onStopDiscussion,
  onContinueDiscussion,
  onInputActivate,
  onUserInputActivity,

  onResumeTopic,
  onPlayPause,
  isDiscussionPaused,
  totalActions,
  currentActionIndex,
  onDiscussionPause,
  onDiscussionResume,
  currentSceneIndex = 0,
  scenesCount = 1,
  whiteboardOpen = false,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onWhiteboardClose,
  isPresenting,
  controlsVisible,
  onTogglePresentation,
  onPresentationInteractionChange,
  fullscreenContainerRef,
  showElementReference,
  canPickSlideElement,
  elementPickActive,
  onToggleElementPick,
  elementReferencePill,
  onClearElementReference,
}: RoundtableProps) {
  const { t } = useI18n();
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const asrEnabled = useSettingsStore((state) => state.asrEnabled);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);
  const autoPlayLecture = useSettingsStore((s) => s.autoPlayLecture);
  const setAutoPlayLecture = useSettingsStore((s) => s.setAutoPlayLecture);
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useSettingsStore((s) => s.setPlaybackSpeed);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const nonPresentationInputRef = useRef<HTMLTextAreaElement>(null);
  const agentScrollRef = useRef<HTMLDivElement>(null);
  const bubbleScrollRef = useRef<HTMLDivElement>(null);
  const teacherAvatarRef = useRef<HTMLDivElement>(null);
  const studentAvatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const userMessageClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPresenting) return;
    const textarea = nonPresentationInputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      NON_PRESENTATION_INPUT_MAX_HEIGHT_PX,
    )}px`;
  }, [inputValue, isInputOpen, isPresenting]);

  // End flash visible state (Issue 3)
  const [endFlashVisible, setEndFlashVisible] = useState(false);

  // Send cooldown: lock input from "message sent" until "agent bubble appears"
  const [isSendCooldown, setIsSendCooldown] = useState(false);
  const isSendCooldownRef = useRef(false);

  const teacherParticipant = initialParticipants.find((p) => p.role === 'teacher');
  const studentParticipants = initialParticipants.filter(
    (p) => p.role !== 'teacher' && p.role !== 'user',
  );

  // Stable ref object for the current discussion agent's avatar
  const discussionAnchorRef = useRef<HTMLDivElement>(null);
  const presentationActionAnchorRef = useRef<HTMLDivElement>(null);
  const presentationAgentAvatarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!discussionRequest) {
      discussionAnchorRef.current = null;
      return;
    }
    if (discussionRequest.agentId === teacherParticipant?.id) {
      discussionAnchorRef.current = teacherAvatarRef.current;
    } else {
      discussionAnchorRef.current =
        studentAvatarRefs.current.get(discussionRequest.agentId || '') || null;
    }
  }, [discussionRequest, teacherParticipant?.id]);

  // Derived state from Stage's computePlaybackView (centralised derivation)
  const isInLiveFlow =
    playbackView?.isInLiveFlow ??
    !!(speakingAgentId || thinkingState || isStreaming || sessionType);

  // Role-aware source text: userMessage overlay on top of playbackView
  const sourceText = userMessage
    ? userMessage
    : (playbackView?.sourceText ??
      (currentSpeech
        ? currentSpeech
        : isInLiveFlow
          ? ''
          : lectureSpeech || (playbackCompleted ? '' : idleText) || ''));
  const hasAgentFeedback = Boolean(playbackView?.sourceText || thinkingState);
  const prevHasAgentFeedbackRef = useRef(hasAgentFeedback);

  const clearUserMessageClearTimer = useCallback(() => {
    if (userMessageClearTimerRef.current) {
      clearTimeout(userMessageClearTimerRef.current);
      userMessageClearTimerRef.current = null;
    }
  }, []);

  const scheduleUserMessageClear = useCallback(() => {
    clearUserMessageClearTimer();
    userMessageClearTimerRef.current = setTimeout(() => {
      setUserMessage(null);
      userMessageClearTimerRef.current = null;
    }, 3000);
  }, [clearUserMessageClearTimer]);

  const showLocalUserMessage = useCallback(
    (text: string) => {
      setUserMessage(text);
      // Mark as "already seen feedback" so that the immediate thinkingState
      // transition (false→true) after user sends won't trigger the early-clear
      // effect and swallow the user bubble.
      prevHasAgentFeedbackRef.current = true;
      scheduleUserMessageClear();
    },
    [scheduleUserMessageClear],
  );

  // Auto-scroll bubble: keep latest streaming text visible during live/discussion flow
  useEffect(() => {
    if (!isInLiveFlow) return;
    const el = bubbleScrollRef.current;
    if (!el) return;
    const scrollableHeight = el.scrollHeight - el.clientHeight;
    if (scrollableHeight <= 0) return;
    el.scrollTo({ top: scrollableHeight, behavior: 'smooth' });
  }, [sourceText, isInLiveFlow]);

  // Clear user message early when agent starts responding
  useEffect(() => {
    const feedbackStarted = hasAgentFeedback && !prevHasAgentFeedbackRef.current;
    if (userMessage && feedbackStarted) {
      clearUserMessageClearTimer();
      setUserMessage(null);
    }
    prevHasAgentFeedbackRef.current = hasAgentFeedback;
  }, [clearUserMessageClearTimer, hasAgentFeedback, userMessage]);

  useEffect(() => () => clearUserMessageClearTimer(), [clearUserMessageClearTimer]);

  // End flash effect (Issue 3)
  useEffect(() => {
    if (showEndFlash) {
      setEndFlashVisible(true);
      const timer = setTimeout(() => setEndFlashVisible(false), 1800);
      return () => clearTimeout(timer);
    } else {
      setEndFlashVisible(false);
    }
  }, [showEndFlash]);

  // Clear send cooldown when agent bubble appears
  useEffect(() => {
    if (isSendCooldown && speakingAgentId) {
      setIsSendCooldown(false);
      isSendCooldownRef.current = false;
    }
  }, [isSendCooldown, speakingAgentId]);

  // Safety net: clear cooldown when streaming transitions from active → ended
  // (not when isStreaming was already false — that would clear cooldown immediately)
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && isSendCooldown) {
      setIsSendCooldown(false);
      isSendCooldownRef.current = false;
    }
    prevStreamingRef.current = !!isStreaming;
  }, [isStreaming, isSendCooldown]);

  // Separate participants by role (teacherParticipant & studentParticipants declared earlier for effect)
  const userParticipant = initialParticipants.find((p) => p.role === 'user');

  const teacherAvatar = teacherParticipant?.avatar || DEFAULT_TEACHER_AVATAR;
  const teacherName = teacherParticipant?.name || t('roundtable.teacher');
  const userAvatar = userParticipant?.avatar || DEFAULT_USER_AVATAR;

  // Audio recording
  const { isRecording, isProcessing, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder({
      onTranscription: (text) => {
        if (!text.trim()) {
          toast.info(t('roundtable.noSpeechDetected'));
          setIsVoiceOpen(false);
          return;
        }
        // Block if in send cooldown (e.g. text was sent while voice was processing)
        if (isSendCooldownRef.current) {
          setIsVoiceOpen(false);
          return;
        }
        showLocalUserMessage(text);
        onMessageSend?.(text);
        setIsSendCooldown(true);
        isSendCooldownRef.current = true;
        setIsVoiceOpen(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsVoiceOpen(false);
      },
    });

  const handleSendMessage = () => {
    if (!inputValue.trim() || isSendCooldown) return;

    showLocalUserMessage(inputValue);
    onMessageSend?.(inputValue);
    setIsSendCooldown(true);
    isSendCooldownRef.current = true;
    setInputValue('');
    setIsInputOpen(false);
  };

  const handleToggleInput = () => {
    if (isSendCooldown) return;
    if (!isInputOpen) {
      onInputActivate?.();
    }
    setIsInputOpen(!isInputOpen);
    // Cancel any in-flight ASR to prevent ghost auto-sends
    if (isVoiceOpen || isProcessing) {
      cancelRecording();
      setIsVoiceOpen(false);
    }
  };

  const handleToggleVoice = () => {
    if (isVoiceOpen) {
      if (isRecording) {
        stopRecording();
      }
      setIsVoiceOpen(false);
    } else {
      if (isSendCooldown || isProcessing) return;
      onInputActivate?.();
      onUserInputActivity?.('recording_start');
      setIsVoiceOpen(true);
      setIsInputOpen(false);
      startRecording();
    }
  };

  const handleContinueSoftClosing = () => {
    onContinueDiscussion?.();
    setIsVoiceOpen(false);
    setIsInputOpen(true);
  };

  // Keyboard shortcuts for roundtable interaction (#255)
  // T = toggle text input, V = toggle voice input, Escape = dismiss panels,
  // Space = discussion pause/resume (during live flow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape should always work, even when typing in an input
      if (e.key === 'Escape') {
        if (isInputOpen || isVoiceOpen) {
          e.preventDefault();
          e.stopPropagation(); // Prevent fullscreen exit when panels are open
          setIsInputOpen(false);
          setIsVoiceOpen(false);
          if (isRecording || isProcessing) cancelRecording();
        }
        return;
      }

      // Skip other shortcuts when user is typing in an input, textarea, or contentEditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          // Only handle during live flow (QA/Discussion)
          if (!isInLiveFlow) return;
          e.preventDefault(); // Prevent page scroll
          if (isDiscussionPaused) {
            onDiscussionResume?.();
          } else if (!thinkingState && currentSpeech) {
            // Same guard as bubble click: don't pause during thinking or before text arrives
            onDiscussionPause?.();
          }
          break;

        case 't':
        case 'T':
          e.preventDefault();
          handleToggleInput();
          break;

        case 'v':
        case 'V':
          e.preventDefault();
          if (asrEnabled) handleToggleVoice();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isInLiveFlow,
    isDiscussionPaused,
    thinkingState,
    currentSpeech,
    onDiscussionPause,
    onDiscussionResume,
    asrEnabled,
    isInputOpen,
    isVoiceOpen,
    isRecording,
    isProcessing,
  ]);

  const isPresentationInteractionActive = isInputOpen || isVoiceOpen || isRecording || isProcessing;

  useEffect(() => {
    onPresentationInteractionChange?.(isPresentationInteractionActive);

    return () => {
      if (isPresentationInteractionActive) {
        onPresentationInteractionChange?.(false);
      }
    };
  }, [isPresentationInteractionActive, onPresentationInteractionChange]);

  // Determine active speaking state and bubble ownership
  // Check if current speaker is a student agent (not teacher)
  const speakingStudent = speakingAgentId
    ? studentParticipants.find((s) => s.id === speakingAgentId)
    : null;

  // Bubble loading: speakingAgentId is set (agent_start fired) but text hasn't arrived yet
  const isBubbleLoading = !!(speakingAgentId && !currentSpeech && !userMessage);
  // Student agent specifically loading (for agent-style bubble)
  const isAgentLoading = !!(speakingStudent && !currentSpeech && !userMessage);

  const activeRole: 'teacher' | 'user' | 'agent' | null = userMessage
    ? 'user'
    : (playbackView?.activeRole ??
      (currentSpeech && speakingStudent
        ? 'agent'
        : currentSpeech
          ? 'teacher'
          : isAgentLoading
            ? 'agent'
            : isBubbleLoading
              ? 'teacher'
              : isCueUser
                ? null
                : lectureSpeech
                  ? 'teacher'
                  : null));

  const bubbleRole: 'teacher' | 'user' | 'agent' | null = userMessage
    ? 'user'
    : (playbackView?.bubbleRole ??
      (currentSpeech && speakingStudent
        ? 'agent'
        : currentSpeech
          ? 'teacher'
          : isAgentLoading
            ? 'agent'
            : isBubbleLoading
              ? 'teacher'
              : isInLiveFlow
                ? null
                : isCueUser
                  ? null
                  : lectureSpeech || idleText
                    ? 'teacher'
                    : null));

  const bubbleName =
    bubbleRole === 'agent'
      ? speakingStudent?.name || t('settings.agentRoles.student')
      : bubbleRole === 'teacher'
        ? teacherName
        : bubbleRole === 'user'
          ? t('roundtable.you')
          : '';

  // Stable key based on speaker identity, NOT text content (prevents re-mount flicker)
  const bubbleKey =
    bubbleRole === 'user'
      ? 'user'
      : bubbleRole === 'agent'
        ? `agent-${speakingAgentId}`
        : bubbleRole === 'teacher'
          ? 'teacher'
          : 'idle';

  // Enriched playbackView that includes userMessage overlay for bubbleRole/sourceText
  const enrichedPlaybackView: PlaybackView = playbackView
    ? { ...playbackView, bubbleRole, sourceText, activeRole: activeRole ?? playbackView.activeRole }
    : {
        phase: 'idle' as const,
        sourceText,
        bubbleRole,
        activeRole,
        buttonState: 'none' as const,
        isInLiveFlow: false,
        isTopicActive: false,
      };

  // Show stop button whenever there's an active QA/discussion session or live mode.
  // sessionType is only cleared in doSessionCleanup, so this stays stable through
  // brief loading gaps (e.g. between user message and agent SSE response).
  const showStopButton =
    engineMode === 'live' || sessionType === 'qa' || sessionType === 'discussion';

  const handleCycleSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed as (typeof PLAYBACK_SPEEDS)[number]);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed, setPlaybackSpeed]);

  // Intentionally non-reactive: agent metadata is treated as immutable during a classroom session.
  const agentRegistry = useAgentRegistry.getState();
  const getAgentConfig = (id: string) => agentRegistry.getAgent(id);

  const presentationDiscussionParticipant = discussionRequest
    ? discussionRequest.agentId === teacherParticipant?.id
      ? teacherParticipant || null
      : studentParticipants.find((student) => student.id === discussionRequest.agentId) || null
    : null;
  const presentationDiscussionAgentConfig = discussionRequest
    ? getAgentConfig(discussionRequest.agentId || '')
    : null;

  const handlePresentationBubbleClick = useCallback(() => {
    if (isTopicPending) {
      onResumeTopic?.();
      return;
    }
    if (isInLiveFlow) {
      if (isDiscussionPaused) {
        onDiscussionResume?.();
      } else if (!thinkingState && currentSpeech) {
        onDiscussionPause?.();
      }
      return;
    }
    onPlayPause?.();
  }, [
    isTopicPending,
    isInLiveFlow,
    isDiscussionPaused,
    thinkingState,
    currentSpeech,
    onResumeTopic,
    onDiscussionResume,
    onDiscussionPause,
    onPlayPause,
  ]);
  const showPresentationDock =
    !!controlsVisible ||
    !!discussionRequest ||
    isCueUser ||
    isInputOpen ||
    isVoiceOpen ||
    isRecording ||
    isProcessing;
  const toolbar = (
    <CanvasToolbar
      className="shrink-0 min-h-12 px-3 border-b border-border/70 sm:px-4"
      currentSceneIndex={currentSceneIndex}
      scenesCount={scenesCount}
      engineState={
        engineMode === 'playing' || engineMode === 'live'
          ? 'playing'
          : engineMode === 'paused'
            ? 'paused'
            : 'idle'
      }
      isLiveSession={isStreaming || isTopicPending || engineMode === 'live'}
      isSoftClosing={isSoftClosing}
      softCloseDeadline={softCloseDeadline}
      whiteboardOpen={whiteboardOpen}
      sidebarCollapsed={sidebarCollapsed}
      chatCollapsed={chatCollapsed}
      onToggleSidebar={onToggleSidebar}
      onToggleChat={onToggleChat}
      onPrevSlide={onPrevSlide ?? (() => {})}
      onNextSlide={onNextSlide ?? (() => {})}
      onPlayPause={onPlayPause ?? (() => {})}
      onWhiteboardClose={onWhiteboardClose ?? (() => {})}
      isPresenting={isPresenting}
      onTogglePresentation={onTogglePresentation}
      showStopDiscussion={showStopButton}
      onStopDiscussion={onStopDiscussion}
      onContinueDiscussion={handleContinueSoftClosing}
      ttsEnabled={ttsEnabled}
      ttsMuted={ttsMuted}
      ttsVolume={ttsVolume}
      onToggleMute={() => ttsEnabled && setTTSMuted(!ttsMuted)}
      onVolumeChange={(v) => setTTSVolume(v)}
      autoPlayLecture={autoPlayLecture}
      onToggleAutoPlay={() => setAutoPlayLecture(!autoPlayLecture)}
      playbackSpeed={playbackSpeed}
      onCycleSpeed={handleCycleSpeed}
      showElementReference={showElementReference}
      canPickSlideElement={canPickSlideElement}
      elementPickActive={elementPickActive}
      onToggleElementPick={onToggleElementPick}
    />
  );
  const referencePill = elementReferencePill ? (
    <div
      data-testid="slide-element-reference-pill"
      className="pointer-events-auto flex max-w-[min(520px,calc(100vw-3rem))] items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur"
      onClick={(event) => event.stopPropagation()}
    >
      <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="shrink-0 font-semibold text-primary">
        {elementReferencePill.sceneLabel} · {elementReferencePill.elementType} ·
      </span>
      <span className="min-w-0 truncate text-muted-foreground">
        {elementReferencePill.displaySummary}
      </span>
      <button
        type="button"
        onClick={onClearElementReference}
        className="-mr-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t('chat.elementReference.clear')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  if (isPresenting) {
    return (
      <div className="h-0 w-full relative z-10 overflow-visible">
        {/* Speech overlay — fills the full stage area via absolute positioning */}
        <PresentationSpeechOverlay
          playbackView={enrichedPlaybackView}
          participants={initialParticipants}
          speakingAgentId={speakingAgentId ?? null}
          isTopicPending={!!isTopicPending}
          side="left"
          onBubbleClick={handlePresentationBubbleClick}
          audioIndicatorState={audioIndicatorState ?? 'idle'}
          buttonState={enrichedPlaybackView?.buttonState}
          isPaused={isDiscussionPaused || engineMode === 'paused'}
        />

        {/* Click-outside backdrop to dismiss input/voice */}
        {(isInputOpen || isVoiceOpen) && (
          <div
            className="fixed top-0 left-0 right-0 bottom-14 z-[45] pointer-events-auto"
            onClick={() => {
              setIsInputOpen(false);
              setIsVoiceOpen(false);
              cancelRecording();
            }}
          />
        )}

        {/* ── Toolbar — pinned to bottom of screen ── */}
        <div
          className={cn(
            'fixed bottom-0 left-0 z-[40] pointer-events-none flex items-center justify-center transition-all duration-300',
            controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
          style={{ right: chatCollapsed === false ? (chatAreaWidth ?? 320) : 0 }}
        >
          <div className="mb-3 px-2 py-1 rounded-full bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-gray-200/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] pointer-events-auto">
            {toolbar}
          </div>
        </div>

        {/* ── End flash notification ── */}
        <AnimatePresence>
          {endFlashVisible && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [10, 0, 0, 6],
                scale: [0.9, 1, 1, 0.95],
              }}
              transition={{
                duration: 1.8,
                times: [0, 0.15, 0.7, 1],
                ease: 'easeOut',
              }}
              className="fixed bottom-20 -translate-x-1/2 z-[50] bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-700 dark:text-white px-3.5 py-1.5 rounded-full text-xs font-medium pointer-events-none"
              style={{
                left: `calc((100vw - ${chatCollapsed === false ? (chatAreaWidth ?? 320) : 0}px) / 2)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block mr-1.5" />
              {endFlashSessionType === 'discussion'
                ? t('roundtable.discussionEnded')
                : t('roundtable.qaEnded')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Center stack: input / voice / thinking — anchored above toolbar ── */}
        <div
          className="fixed bottom-14 left-0 z-[50] flex flex-col items-center justify-center gap-3 pointer-events-none transition-[right] duration-300"
          style={{ right: chatCollapsed === false ? (chatAreaWidth ?? 320) : 0 }}
        >
          {referencePill}
          {/* Input panel */}
          <AnimatePresence>
            {isInputOpen && (
              <motion.div
                key="presentation-input-stage"
                initial={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
                className="w-[min(480px,calc(100vw-3rem))] pointer-events-auto"
              >
                <div className="flex items-center gap-3 bg-white/70 dark:bg-black/60 backdrop-blur-xl rounded-full px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-gray-200/60 dark:border-white/10">
                  <div className="flex-1 min-w-0 flex items-center">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onBeforeInput={() => onUserInputActivity?.('text_input')}
                      onCompositionStart={() => onUserInputActivity?.('composition_start')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={t('roundtable.inputPlaceholder')}
                      autoFocus
                      rows={1}
                      className="w-full resize-none bg-transparent border-none focus:ring-0 focus:outline-none outline-none shadow-none ring-0 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-400 py-0 leading-[40px] max-h-[80px]"
                      style={{ fieldSizing: 'content' } as Record<string, string>}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendCooldown}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0',
                      isSendCooldown
                        ? 'bg-gray-500/50 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/90 shadow-md',
                    )}
                  >
                    {isSendCooldown ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice panel */}
          <AnimatePresence>
            {isVoiceOpen && (
              <motion.div
                key="presentation-voice-stage"
                initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(4px)' }}
                className="pointer-events-auto"
              >
                <div className="flex items-center gap-4 bg-white/70 dark:bg-black/60 backdrop-blur-xl rounded-full px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-gray-200/60 dark:border-white/10">
                  {/* Waveform bars */}
                  <div className="flex items-center gap-0.5 h-8">
                    <VoiceWaveformBars barClassName="bg-primary" />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                    {isProcessing ? t('roundtable.processing') : t('roundtable.listening')}
                  </span>
                  {/* Mic button */}
                  <button
                    type="button"
                    aria-label={
                      isRecording ? t('roundtable.stopRecording') : t('roundtable.startRecording')
                    }
                    className="relative group cursor-pointer bg-transparent border-none p-0"
                    onClick={handleToggleVoice}
                  >
                    <div className="relative w-12 h-12 rounded-full bg-primary shadow-md flex items-center justify-center group-hover:scale-105 transition-transform duration-300 border border-white/20">
                      <Mic className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-primary opacity-40 animate-[ping_2s_ease-in-out_infinite]" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* "Your turn" cue prompt — clickable, opens input panel */}
          <AnimatePresence>
            {isCueUser && !bubbleRole && !thinkingState && !isInputOpen && !isVoiceOpen && (
              <motion.div
                key="presentation-cue-user"
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ duration: 0.22, ease: [0.21, 1, 0.36, 1] }}
                className="pointer-events-auto"
              >
                <button
                  onClick={() => (asrEnabled ? handleToggleVoice() : handleToggleInput())}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 dark:bg-black/50 backdrop-blur-xl border border-amber-400/50 dark:border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.2),0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_0_16px_rgba(245,158,11,0.25),0_8px_32px_rgba(0,0,0,0.4)] text-amber-600 dark:text-amber-400 text-sm font-semibold tracking-wide hover:bg-gray-100/80 dark:hover:bg-black/60 hover:border-amber-500/70 dark:hover:border-amber-400/70 hover:shadow-[0_0_24px_rgba(245,158,11,0.25)] dark:hover:shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all active:scale-95 animate-pulse"
                >
                  {asrEnabled ? <Mic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  {t('roundtable.yourTurn')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Director thinking indicator */}
          <AnimatePresence>
            {thinkingState?.stage === 'director' && !currentSpeech && !userMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-black/50 backdrop-blur-xl rounded-full border border-gray-200/60 dark:border-white/10"
              >
                <div className="flex gap-1">
                  {[0, 0.2, 0.4].map((delay) => (
                    <motion.div
                      key={delay}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay }}
                      className="w-1.5 h-1.5 rounded-full bg-primary"
                    />
                  ))}
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  {t('roundtable.thinking')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right-side stack: bubble + dock — flex column, no hardcoded px ── */}
        <div
          className="fixed bottom-5 z-[48] flex flex-col items-end gap-3 pointer-events-none transition-[right] duration-300"
          style={{ right: chatCollapsed ? 20 : 20 + (chatAreaWidth ?? 320) }}
        >
          {/* Right-side speech bubble (flows above dock via flex) */}
          <PresentationSpeechOverlay
            playbackView={enrichedPlaybackView}
            participants={initialParticipants}
            speakingAgentId={speakingAgentId ?? null}
            isTopicPending={!!isTopicPending}
            userAvatar={userAvatar}
            side="right"
            onBubbleClick={handlePresentationBubbleClick}
            audioIndicatorState={audioIndicatorState ?? 'idle'}
            buttonState={enrichedPlaybackView?.buttonState}
            isPaused={isDiscussionPaused || engineMode === 'paused'}
          />

          {/* Dock */}
          <AnimatePresence>
            {showPresentationDock && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="pointer-events-auto"
              >
                <div
                  ref={presentationActionAnchorRef}
                  className="flex items-center gap-2.5 rounded-full bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-gray-200/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] px-2.5 py-2"
                >
                  {/* Speaking / discussion-requesting agent avatar — shows when
                      a student agent is actively speaking OR a discussion request
                      is pending (so the user can see who's asking before joining) */}
                  <AnimatePresence>
                    {((activeRole === 'agent' && speakingStudent) ||
                      presentationDiscussionParticipant) && (
                      <motion.div
                        ref={presentationAgentAvatarRef}
                        key={`dock-agent-${(speakingStudent || presentationDiscussionParticipant)?.id}`}
                        initial={{ opacity: 0, scale: 0.8, width: 0 }}
                        animate={{ opacity: 1, scale: 1, width: 'auto' }}
                        exit={{ opacity: 0, scale: 0.8, width: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="shrink-0 overflow-hidden"
                      >
                        <div className="relative w-10 h-10 rounded-full flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.3)] transition-all duration-300" />
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden relative z-10 text-lg">
                            <AvatarDisplay
                              src={
                                (speakingStudent || presentationDiscussionParticipant)?.avatar ||
                                '/avatars/user.png'
                              }
                              alt={
                                (speakingStudent || presentationDiscussionParticipant)?.name || ''
                              }
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {isSendCooldown ? (
                    <div className="flex items-center justify-center w-8 h-8">
                      <div className="flex items-center gap-[3px]">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -3, 0], opacity: [0.35, 0.9, 0.35] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.9,
                              delay: i * 0.12,
                              ease: 'easeInOut',
                            }}
                            className="w-[3px] h-[3px] rounded-full bg-primary"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        aria-label={
                          asrEnabled
                            ? t('roundtable.voiceInput')
                            : t('roundtable.voiceInputDisabled')
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (asrEnabled) handleToggleVoice();
                        }}
                        disabled={!asrEnabled}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95',
                          !asrEnabled
                            ? 'text-gray-500 cursor-not-allowed'
                            : isVoiceOpen
                              ? 'bg-primary text-primary-foreground'
                              : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/10',
                        )}
                      >
                        {asrEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>
                      <button
                        aria-label={t('roundtable.textInput')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleInput();
                        }}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95',
                          isInputOpen
                            ? 'bg-primary text-primary-foreground'
                            : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/10',
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    aria-label={t('roundtable.you')}
                    className="relative group cursor-pointer shrink-0 bg-transparent border-none p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInput();
                    }}
                  >
                    <div
                      className={cn(
                        'relative w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center',
                        activeRole === 'user' || isInputOpen || isCueUser
                          ? 'scale-105'
                          : 'opacity-70 group-hover:opacity-100 group-hover:scale-100',
                      )}
                    >
                      <div
                        className={cn(
                          'absolute inset-0 rounded-full border-2 transition-all duration-300',
                          isCueUser
                            ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse'
                            : activeRole === 'user' || isInputOpen
                              ? 'border-primary'
                              : 'border-border group-hover:border-primary/50',
                        )}
                      />
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden relative z-10 text-lg">
                        <AvatarDisplay src={userAvatar} alt={t('roundtable.you')} />
                      </div>
                    </div>
                  </button>
                </div>

                <AnimatePresence>
                  {discussionRequest && (
                    <ProactiveCard
                      action={discussionRequest}
                      mode={engineMode === 'paused' ? 'paused' : 'playback'}
                      anchorRef={presentationAgentAvatarRef}
                      portalContainer={fullscreenContainerRef?.current}
                      align="left"
                      agentName={
                        presentationDiscussionParticipant?.name ||
                        presentationDiscussionAgentConfig?.name
                      }
                      agentAvatar={
                        presentationDiscussionParticipant?.avatar ||
                        presentationDiscussionAgentConfig?.avatar
                      }
                      agentColor={presentationDiscussionAgentConfig?.color}
                      onSkip={() => onDiscussionSkip?.()}
                      onListen={() => onDiscussionStart?.(discussionRequest)}
                      onTogglePause={() => onPlayPause?.()}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Podium (non-presentation) ────────────────────────────────────────────
  // Row 1: the playback toolbar plus a participant stack (teacher, agents,
  // you). Row 2: the speaker identity, the subtitle stage and the ask capsule.
  const podiumRole = bubbleRole ?? activeRole;
  const podiumAvatar =
    podiumRole === 'user'
      ? userAvatar
      : podiumRole === 'agent'
        ? speakingStudent?.avatar || userAvatar
        : teacherAvatar;
  const podiumName =
    podiumRole === 'user'
      ? t('roundtable.you')
      : podiumRole === 'agent'
        ? speakingStudent?.name || bubbleName || ''
        : teacherName;
  const chromeHidden = isPresenting && !controlsVisible;
  const showIdlePrompt =
    !bubbleRole && !thinkingState && !isCueUser && !isInputOpen && !isVoiceOpen && !isTopicPending;
  const showLectureProgress =
    bubbleRole === 'teacher' &&
    !isInLiveFlow &&
    !isTopicPending &&
    typeof totalActions === 'number' &&
    totalActions > 0 &&
    typeof currentActionIndex === 'number';

  const renderAvatarCard = (
    name: string,
    avatar: string,
    roleLabel: string,
    color: string | undefined,
    description: string | undefined,
  ) => (
    <HoverCardContent side="top" align="end" className="w-64 max-h-[300px] overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        <div className="size-8 shrink-0 overflow-hidden rounded-full bg-muted">
          <img src={avatar} alt={name} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          {roleLabel && (
            <span
              className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] leading-tight text-white"
              style={{ backgroundColor: color || 'var(--primary)' }}
            >
              {roleLabel}
            </span>
          )}
        </div>
      </div>
      {description && (
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </HoverCardContent>
  );

  return (
    <div
      data-classroom-roundtable
      className={cn(
        'relative z-10 flex h-[324px] w-full flex-col overflow-hidden rounded-2xl transition-colors duration-200 sm:h-[208px]',
        chromeHidden
          ? 'border-t border-transparent bg-transparent backdrop-blur-none'
          : 'border border-border/70 bg-card shadow-sm',
      )}
    >
      {/* ── Row 1: toolbar + participants ── */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border/70 pr-2 transition-opacity duration-300 sm:pr-3',
          chromeHidden && 'pointer-events-none opacity-0',
        )}
      >
        <div className="min-w-0 flex-1">{toolbar}</div>

        <div
          data-classroom-participants
          className="flex shrink-0 items-center gap-2 border-l border-border/70 pl-2"
        >
          <div
            ref={agentScrollRef}
            className="scrollbar-hide flex items-center overflow-x-auto overflow-y-hidden"
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.currentTarget.scrollLeft += e.deltaY;
                e.preventDefault();
              }
            }}
          >
            <div className="flex w-max items-center -space-x-1.5 py-1.5 pr-1">
              {/* Teacher */}
              <div ref={teacherAvatarRef} className="group relative shrink-0">
                <HoverCard openDelay={300} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div
                      className={cn(
                        'relative size-8 cursor-pointer rounded-full ring-2 ring-card transition-all duration-300',
                        activeRole === 'teacher' ? 'z-[2] scale-110' : 'opacity-80 hover:opacity-100',
                      )}
                      title={teacherName}
                    >
                      <div
                        className={cn(
                          'absolute -inset-0.5 rounded-full border-2 transition-colors duration-300',
                          activeRole === 'teacher'
                            ? 'border-primary shadow-[0_0_8px_var(--ring)]'
                            : 'border-transparent group-hover:border-border',
                        )}
                      />
                      <div className="relative z-10 size-8 overflow-hidden rounded-full bg-muted">
                        <img
                          src={teacherAvatar}
                          alt={teacherName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {activeRole === 'teacher' && (
                        <span className="absolute -right-0.5 -top-0.5 z-20 flex size-3 items-center justify-center rounded-full border-2 border-card bg-emerald-500">
                          <span className="size-1 animate-pulse rounded-full bg-white" />
                        </span>
                      )}
                    </div>
                  </HoverCardTrigger>
                  {(() => {
                    const teacherConfig = getAgentConfig(teacherParticipant?.id || '');
                    return renderAvatarCard(
                      teacherName,
                      teacherAvatar,
                      t('settings.agentRoles.teacher'),
                      teacherConfig?.color,
                      teacherConfig?.persona,
                    );
                  })()}
                </HoverCard>

                {/* ProactiveCard from teacher avatar */}
                <AnimatePresence>
                  {discussionRequest && discussionRequest.agentId === teacherParticipant?.id && (
                    <ProactiveCard
                      action={discussionRequest}
                      mode={engineMode === 'paused' ? 'paused' : 'playback'}
                      anchorRef={teacherAvatarRef}
                      align="left"
                      agentName={teacherName}
                      agentAvatar={teacherAvatar}
                      agentColor={getAgentConfig(teacherParticipant?.id || '')?.color}
                      onSkip={() => onDiscussionSkip?.()}
                      onListen={() => onDiscussionStart?.(discussionRequest)}
                      onTogglePause={() => onPlayPause?.()}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Companion agents */}
              {studentParticipants.map((student) => {
                const isSpeaking = speakingAgentId === student.id;
                const isThinkingAgent =
                  thinkingState?.stage === 'agent_loading' && thinkingState.agentId === student.id;
                const agentConfig = getAgentConfig(student.id);
                const roleLabelKey = agentConfig?.role as
                  | 'teacher'
                  | 'assistant'
                  | 'student'
                  | undefined;
                const roleLabelRaw = roleLabelKey ? t(`settings.agentRoles.${roleLabelKey}`) : '';
                const roleLabel =
                  roleLabelRaw && roleLabelRaw !== `settings.agentRoles.${roleLabelKey}`
                    ? roleLabelRaw
                    : '';
                const i18nDescription = t(`settings.agentDescriptions.${student.id}`);
                const description =
                  i18nDescription !== `settings.agentDescriptions.${student.id}`
                    ? i18nDescription
                    : agentConfig?.persona || '';
                const isDiscussionAgent =
                  !!discussionRequest && discussionRequest.agentId === student.id;
                return (
                  <div
                    key={student.id}
                    data-agent-id={student.id}
                    ref={(el) => {
                      if (el) studentAvatarRefs.current.set(student.id, el);
                      else studentAvatarRefs.current.delete(student.id);
                    }}
                    className={cn('group/student relative shrink-0', isSpeaking && 'z-[2]')}
                  >
                    {/* Breathing glow for the agent asking to discuss */}
                    {isDiscussionAgent && (
                      <motion.div
                        animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{ border: `2px solid ${agentConfig?.color || 'var(--primary)'}` }}
                      />
                    )}
                    <HoverCard openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div
                          className={cn(
                            'relative size-8 cursor-pointer rounded-full ring-2 ring-card transition-all duration-300',
                            isSpeaking
                              ? 'scale-110 opacity-100'
                              : 'opacity-60 grayscale-[0.2] hover:opacity-100 hover:grayscale-0',
                          )}
                          title={student.name}
                        >
                          <div
                            className={cn(
                              'absolute -inset-0.5 rounded-full border-2 transition-colors duration-300',
                              isSpeaking
                                ? 'border-primary shadow-[0_0_8px_var(--ring)]'
                                : 'border-transparent',
                            )}
                          />
                          <div className="relative z-10 size-8 overflow-hidden rounded-full bg-muted">
                            <img src={student.avatar} alt={student.name} className="h-full w-full" />
                          </div>
                          {isSpeaking && (
                            <span className="absolute -right-0.5 -top-0.5 z-20 flex size-3 items-center justify-center rounded-full border-2 border-card bg-emerald-500">
                              <span className="size-1 animate-pulse rounded-full bg-white" />
                            </span>
                          )}
                          {isThinkingAgent && (
                            <span className="absolute -inset-0.5 z-20 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          )}
                        </div>
                      </HoverCardTrigger>
                      {renderAvatarCard(
                        student.name,
                        student.avatar,
                        roleLabel,
                        agentConfig?.color,
                        description || undefined,
                      )}
                    </HoverCard>
                  </div>
                );
              })}

              {/* You */}
              <button
                type="button"
                aria-label={t('roundtable.you')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleInput();
                }}
                className={cn(
                  'group relative size-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 ring-2 ring-card transition-all duration-300',
                  activeRole === 'user' || isInputOpen || isCueUser
                    ? 'z-[2] scale-110'
                    : 'opacity-70 hover:opacity-100',
                )}
              >
                <span
                  className={cn(
                    'absolute -inset-0.5 rounded-full border-2 transition-colors duration-300',
                    isCueUser
                      ? 'animate-pulse border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.45)]'
                      : activeRole === 'user' || isInputOpen
                        ? 'border-primary shadow-[0_0_8px_var(--ring)]'
                        : 'border-transparent group-hover:border-border',
                  )}
                />
                <span className="relative z-10 block size-8 overflow-hidden rounded-full bg-muted text-base">
                  <AvatarDisplay src={userAvatar} alt={t('roundtable.you')} />
                </span>
              </button>
            </div>
          </div>

          {/* ProactiveCard for student/non-teacher agents — anchored to the stack */}
          <AnimatePresence>
            {discussionRequest &&
              discussionRequest.agentId !== teacherParticipant?.id &&
              (() => {
                const matchedStudent = studentParticipants.find(
                  (s) => s.id === discussionRequest.agentId,
                );
                const agentConfig = getAgentConfig(discussionRequest.agentId || '');
                return (
                  <ProactiveCard
                    action={discussionRequest}
                    mode={engineMode === 'paused' ? 'paused' : 'playback'}
                    anchorRef={discussionAnchorRef}
                    align="left"
                    agentName={matchedStudent?.name || agentConfig?.name}
                    agentAvatar={matchedStudent?.avatar || agentConfig?.avatar}
                    agentColor={agentConfig?.color}
                    onSkip={() => onDiscussionSkip?.()}
                    onListen={() => onDiscussionStart?.(discussionRequest)}
                    onTogglePause={() => onPlayPause?.()}
                  />
                );
              })()}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Row 2: speaker · subtitle stage · ask capsule ── */}
      <div
        data-classroom-interaction
        className="relative flex min-h-0 flex-1 items-stretch gap-3 px-3 pb-3 pt-2.5 sm:px-4"
      >
        {/* Speaker identity */}
        <div
          className={cn(
            'hidden w-14 shrink-0 flex-col items-center justify-center gap-1.5 transition-opacity duration-200 sm:flex',
            chromeHidden && 'pointer-events-none opacity-0',
          )}
        >
          <div
            className={cn(
              'relative size-11 rounded-full ring-2 transition-all duration-300',
              podiumRole === 'user'
                ? 'ring-primary'
                : podiumRole === 'agent'
                  ? 'ring-(--classroom-tone-lecture)'
                  : activeRole === 'teacher'
                    ? 'ring-primary'
                    : 'ring-border',
            )}
          >
            <div className="absolute inset-0.5 overflow-hidden rounded-full bg-muted text-lg">
              <AvatarDisplay src={podiumAvatar} alt={podiumName} />
            </div>
          </div>
          <span className="max-w-full truncate text-[11px] font-medium leading-4 text-muted-foreground">
            {podiumName}
          </span>
        </div>

        {/* Subtitle stage */}
        <div
          data-testid="roundtable-non-presentation-card"
          onClick={() => {
            if (isInputOpen || isVoiceOpen) {
              setIsInputOpen(false);
              setIsVoiceOpen(false);
              if (isRecording || isProcessing) cancelRecording();
            }
          }}
          className="group relative flex min-w-0 flex-1 cursor-default flex-col justify-center overflow-hidden rounded-xl bg-muted/25 px-3 py-2.5 sm:px-4"
        >
          {/* End flash banner */}
          <AnimatePresence>
            {endFlashVisible && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [-10, 0, 0, -6],
                  scale: [0.9, 1, 1, 0.95],
                }}
                transition={{ duration: 1.8, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
                className="pointer-events-none absolute left-1/2 top-1.5 z-50 -translate-x-1/2 rounded-full bg-foreground/85 px-3.5 py-1.5 text-xs font-medium text-background backdrop-blur-md"
              >
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-background/60" />
                {endFlashSessionType === 'discussion'
                  ? t('roundtable.discussionEnded')
                  : t('roundtable.qaEnded')}
              </motion.div>
            )}
          </AnimatePresence>

          {elementReferencePill && (
            <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2">{referencePill}</div>
          )}

          {/* Idle prompt */}
          {showIdlePrompt && (
            <div className="flex flex-col items-start justify-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-6 text-foreground">
                  {t('platform.design.tryFirst')}
                </p>
                <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
                  {t('platform.design.questionHint')}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-10 shrink-0 gap-2 bg-card"
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleInput();
                }}
              >
                <MessageSquare className="size-4" aria-hidden="true" />
                {t('platform.design.askQuestion')}
              </Button>
            </div>
          )}

          {/* Text input — takes over the stage */}
          <AnimatePresence>
            {isInputOpen && (
              <motion.div
                key="input-stage"
                data-testid="roundtable-non-presentation-input-stage"
                initial={{ opacity: 0, scale: 0.97, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.97, y: 10, filter: 'blur(4px)' }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-2 inset-y-1.5 z-20 flex items-end sm:inset-x-3"
              >
                <div
                  data-testid="roundtable-non-presentation-input-panel"
                  className="relative flex w-full min-w-0 items-end gap-2 rounded-xl border border-primary/40 bg-card p-2 shadow-lg"
                >
                  <div className="min-w-0 flex-1 py-1 pl-3">
                    <textarea
                      ref={nonPresentationInputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onBeforeInput={() => onUserInputActivity?.('text_input')}
                      onCompositionStart={() => onUserInputActivity?.('composition_start')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={t('roundtable.inputPlaceholder')}
                      aria-label={t('platform.design.questionHint')}
                      autoFocus
                      rows={1}
                      className="min-h-[40px] max-h-[100px] w-full resize-none overflow-y-auto border-none bg-transparent text-sm text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendCooldown || !inputValue.trim()}
                    aria-label={t('platform.design.sendQuestion')}
                    className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {isSendCooldown ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Voice recording */}
            {isVoiceOpen && (
              <motion.div
                key="voice-stage"
                initial={{ opacity: 0, scale: 0.95, x: 12, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.95, x: 12, filter: 'blur(4px)' }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-none absolute inset-y-0 right-3 z-30 flex items-center gap-4"
              >
                <div className="relative z-20 flex flex-col-reverse items-end gap-1">
                  <div className="flex h-8 items-center gap-0.5 rounded-xl border border-border/70 bg-card/90 px-2 py-1.5 shadow-sm backdrop-blur-md">
                    <VoiceWaveformBars barClassName="bg-primary" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mr-1 rounded-full border border-border/70 bg-card/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary shadow-sm backdrop-blur-sm"
                  >
                    {isProcessing ? t('roundtable.processing') : t('roundtable.listening')}
                  </motion.div>
                </div>

                <div
                  className="group pointer-events-auto relative cursor-pointer"
                  onClick={handleToggleVoice}
                >
                  <div className="relative z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-105">
                    <Mic className="size-6" />
                  </div>
                  <div className="absolute inset-0 z-10 animate-[ping_2s_ease-in-out_infinite] rounded-full border-2 border-primary opacity-40" />
                  <div className="absolute inset-0 z-10 animate-[ping_3s_ease-in-out_infinite_0.5s] rounded-full border border-primary opacity-20" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thinking */}
          <AnimatePresence>
            {thinkingState?.stage === 'director' && !currentSpeech && !userMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 shadow-sm backdrop-blur-md"
              >
                <div className="flex gap-1">
                  {[0, 0.2, 0.4].map((delay) => (
                    <motion.div
                      key={delay}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay }}
                      className="size-1.5 rounded-full bg-primary"
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('roundtable.thinking')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Your turn */}
          <AnimatePresence>
            {isCueUser && !bubbleRole && !thinkingState && !isInputOpen && !isVoiceOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.3, ease: [0.21, 1, 0.36, 1] }}
                className="absolute inset-0 z-20 flex flex-col items-start justify-center gap-3 px-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-6 text-foreground">
                    {t('roundtable.yourTurn')}
                  </p>
                  <p className="mt-0.5 hidden text-xs leading-5 text-muted-foreground sm:block">
                    {t('platform.design.questionHint')}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (asrEnabled) handleToggleVoice();
                    else handleToggleInput();
                  }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {asrEnabled ? (
                    <Mic className="size-4" aria-hidden="true" />
                  ) : (
                    <MessageSquare className="size-4" aria-hidden="true" />
                  )}
                  {asrEnabled ? t('platform.design.voiceQuestion') : t('platform.design.askQuestion')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtitle */}
          <AnimatePresence mode="wait">
            {bubbleRole && (
              <motion.div
                key={bubbleKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{
                  opacity: isInputOpen || isVoiceOpen ? 0.4 : 1,
                  y: 0,
                  filter: isInputOpen || isVoiceOpen ? 'blur(1px) grayscale(0.2)' : 'none',
                }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.21, 1, 0.36, 1] }}
                className="relative z-10 flex h-full min-h-0 w-full flex-col justify-center"
              >
                <div
                  data-speaker-role={bubbleRole}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (bubbleRole === 'user') return;
                    // Topic pending: click Play to resume
                    if (isTopicPending) {
                      onResumeTopic?.();
                      return;
                    }
                    // QA/Discussion: buffer-level pause/resume (freeze text reveal, SSE continues)
                    if (isInLiveFlow) {
                      if (isDiscussionPaused) {
                        onDiscussionResume?.();
                      } else if (!thinkingState && currentSpeech) {
                        // Don't allow pause during thinking or before text arrives
                        onDiscussionPause?.();
                      }
                      return;
                    }
                    // Lecture playback: toggle play/pause
                    onPlayPause?.();
                  }}
                  className={cn(
                    'group/bubble relative flex min-h-0 max-h-full w-full flex-col',
                    bubbleRole === 'user' ? 'items-end' : 'cursor-pointer items-start',
                  )}
                >
                  {/* Speaker line */}
                  <div className="mb-1 flex w-full items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                    <span
                      className={cn(
                        'truncate font-medium',
                        bubbleRole === 'user'
                          ? 'ml-auto text-primary'
                          : bubbleRole === 'agent'
                            ? 'text-(--classroom-tone-lecture)'
                            : 'text-foreground',
                      )}
                    >
                      {bubbleRole === 'user' ? t('roundtable.you') : bubbleName}
                    </span>
                    {bubbleRole !== 'user' &&
                      (() => {
                        const aiState =
                          speakingAgentId === audioAgentId ? (audioIndicatorState ?? 'idle') : 'idle';
                        if (aiState === 'generating')
                          return <Loader2 className="size-3 animate-spin text-amber-500" />;
                        if (aiState === 'playing')
                          return <Volume2 className="size-3 text-primary" />;
                        return null;
                      })()}
                    {isTopicPending && (
                      <span className="rounded-md bg-accent px-1.5 py-px text-[10px] font-medium text-accent-foreground">
                        {t('proactiveCard.pause')}
                      </span>
                    )}
                    {showLectureProgress && (
                      <span className="ml-auto shrink-0 tabular-nums">
                        {Math.min(currentActionIndex + 1, totalActions)} / {totalActions}
                      </span>
                    )}
                  </div>

                  <div
                    ref={bubbleScrollRef}
                    className={cn(
                      'scrollbar-hide min-h-0 w-full overflow-y-auto',
                      bubbleRole === 'user' ? 'text-right' : 'pr-10',
                    )}
                  >
                    {isBubbleLoading ? (
                      <div className="flex items-center gap-1 py-1">
                        {[0, 0.2, 0.4].map((delay) => (
                          <motion.div
                            key={delay}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1, delay }}
                            className={cn(
                              'size-1.5 rounded-full',
                              isAgentLoading ? 'bg-(--classroom-tone-lecture)' : 'bg-primary',
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <p
                        className={cn(
                          'whitespace-pre-wrap break-words text-[15px] leading-relaxed',
                          bubbleRole === 'user'
                            ? 'inline-block max-w-full rounded-xl rounded-tr-sm bg-accent px-3 py-1.5 text-left text-accent-foreground'
                            : 'text-foreground',
                        )}
                        suppressHydrationWarning
                      >
                        {sourceText}
                        {isTopicPending && (
                          <span className="ml-1 inline-block size-1.5 rounded-full bg-primary align-middle" />
                        )}
                      </p>
                    )}
                  </div>

                  {/* Playback state (hidden during loading — dots already indicate activity) */}
                  {bubbleRole !== 'user' &&
                    !isBubbleLoading &&
                    (() => {
                      const btnState = playbackView?.buttonState ?? 'none';
                      if (btnState === 'none') return null;
                      const shell =
                        'absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border/70 transition-colors duration-200 group-hover/bubble:text-primary';

                      if (btnState === 'play') {
                        return (
                          <div className={cn(shell, 'cursor-pointer')}>
                            <Play className="ml-0.5 size-3.5" />
                          </div>
                        );
                      }
                      if (btnState === 'restart') {
                        return (
                          <div className={cn(shell, 'cursor-pointer')}>
                            <Repeat className="size-3.5" />
                          </div>
                        );
                      }
                      // btnState === 'bars'
                      return (
                        <div className={shell}>
                          {isDiscussionPaused ? (
                            <Play className="ml-0.5 size-3.5 text-amber-500" />
                          ) : (
                            <>
                              <div className="flex h-3.5 w-3.5 items-end justify-center gap-0.5 group-hover/bubble:hidden">
                                {[
                                  ['20%', '100%', 0.6],
                                  ['40%', '100%', 0.4],
                                  ['20%', '80%', 0.5],
                                ].map(([from, to, duration], i) => (
                                  <motion.div
                                    key={i}
                                    animate={{ height: [from, to, from] as string[] }}
                                    transition={{ repeat: Infinity, duration: duration as number }}
                                    className={cn(
                                      'w-1 rounded-full',
                                      bubbleRole === 'agent'
                                        ? 'bg-(--classroom-tone-lecture)'
                                        : 'bg-primary',
                                    )}
                                  />
                                ))}
                              </div>
                              <Pause className="hidden size-3.5 text-primary group-hover/bubble:block" />
                            </>
                          )}
                        </div>
                      );
                    })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ask capsule */}
        <div
          className={cn(
            'flex shrink-0 flex-col items-center justify-center gap-1.5 transition-opacity duration-200',
            chromeHidden && 'pointer-events-none opacity-0',
          )}
        >
          {isSendCooldown ? (
            <div className="flex size-10 items-center justify-center">
              <div className="flex items-center gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -3, 0], opacity: [0.35, 0.9, 0.35] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.9,
                      delay: i * 0.12,
                      ease: 'easeInOut',
                    }}
                    className="size-1 rounded-full bg-primary"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (asrEnabled) handleToggleVoice();
                }}
                disabled={!asrEnabled}
                aria-label={t('platform.design.voiceQuestion')}
                title={asrEnabled ? t('roundtable.voiceInput') : t('roundtable.voiceInputDisabled')}
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-ring',
                  !asrEnabled
                    ? 'cursor-not-allowed border-border/70 bg-muted/60 text-muted-foreground/50'
                    : isVoiceOpen
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                      : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {asrEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleInput();
                }}
                aria-label={t('platform.design.askQuestion')}
                title={t('platform.design.askQuestion')}
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-ring',
                  isInputOpen
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                    : isCueUser
                      ? 'animate-pulse border-primary/60 bg-accent text-accent-foreground'
                      : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <MessageSquare className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
