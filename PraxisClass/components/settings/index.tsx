'use client';

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select';
import {
  X,
  Trash2,
  Box,
  Settings,
  CheckCircle2,
  XCircle,
  FileText,
  Image as ImageIcon,
  Film,
  Search,
  Volume2,
  Mic,
  Plus,
  CreditCard,
  Sparkles,
  Brain,
  Library,
  CalendarClock,
  ExternalLink,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { ServiceActivation } from './service-activation';
import { SERVICE_SECTIONS, type ServiceSection } from '@/lib/settings/service-activation';
import { toast } from 'sonner';
import { type ProviderId } from '@/lib/ai/providers';
import { PROVIDERS, MONO_LOGO_PROVIDERS } from '@/lib/ai/providers';
import { cn } from '@/lib/utils';
import { createCustomProviderSettings, getProviderTypeLabel, modelInfoFromId } from './utils';
import { ProviderList } from './provider-list';
import { ProviderConfigPanel } from './provider-config-panel';
import { PDFSettings } from './pdf-settings';
import { PDF_PROVIDERS } from '@/lib/pdf/constants';
import type { PDFProviderId } from '@/lib/pdf/types';
import { ImageSettings } from './image-settings';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import type { ImageProviderId } from '@/lib/media/types';
import { VideoSettings } from './video-settings';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import type { VideoProviderId } from '@/lib/media/types';
import { TTSSettings } from './tts-settings';
import { TTS_PROVIDERS } from '@/lib/audio/constants';
import type { TTSProviderId } from '@/lib/audio/types';
import { ASRSettings } from './asr-settings';
import { ASR_PROVIDERS } from '@/lib/audio/constants';
import type { ASRProviderId } from '@/lib/audio/types';
import { WebSearchSettings } from './web-search-settings';
import { WEB_SEARCH_PROVIDERS, getWebSearchProviderDisplayName } from '@/lib/web-search/constants';
import type { WebSearchProviderId } from '@/lib/web-search/types';
import { GeneralSettings } from './general-settings';
import { SkillSettings } from './skill-settings';
import { TokenPlanSettings } from './token-plan-settings';
import { MemorySettings } from './memory-settings';
import { KnowledgeSettings } from './knowledge-settings';
import { ScheduleSettings } from './schedule-settings';
import { LinksSettings } from './links-settings';
import { ModelEditDialog } from './model-edit-dialog';
import { AddProviderDialog, type NewProviderData } from './add-provider-dialog';
import { AddAudioProviderDialog, type NewAudioProviderData } from './add-audio-provider-dialog';
import { isCustomTTSProvider, isCustomASRProvider } from '@/lib/audio/types';
import { resolveASRProviderName, resolveTTSProviderName } from '@/lib/audio/provider-display';
import type { SettingsSection, EditingModel } from '@/lib/types/settings';

// ─── Provider List Column (reusable) ───
function ProviderListColumn<T extends string>({
  providers,
  configs,
  selectedId,
  onSelect,
  width,
  t,
  onAdd,
}: {
  providers: Array<{ id: T; name: string; icon?: string }>;
  configs: Record<string, { isServerConfigured?: boolean }>;
  selectedId: T;
  onSelect: (id: T) => void;
  width: number;
  t: (key: string) => string;
  onAdd?: () => void;
}) {
  return (
    <div
      className="workspace-settings-providers flex w-full shrink-0 flex-col bg-card lg:w-[var(--provider-list-width)]"
      style={{ '--provider-list-width': `${width}px` } as CSSProperties}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3 lg:hidden">
        <SelectField
          value={selectedId}
          onValueChange={(value) => onSelect(value as T)}
          aria-label={t('settings.providers')}
          className="flex-1"
          options={providers.map((provider) => ({
            value: provider.id,
            label: `${provider.name}${configs[provider.id]?.isServerConfigured ? ` · ${t('settings.serverConfigured')}` : ''}`,
          }))}
        />
        {onAdd && (
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={onAdd}
            aria-label={t('settings.addProviderButton')}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      <div className="hidden min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3 lg:block">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            aria-pressed={selectedId === provider.id}
            title={provider.name}
            onClick={() => onSelect(provider.id)}
            className={cn(
              'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selectedId === provider.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
            )}
          >
            {provider.icon ? (
              <img
                src={provider.icon}
                alt={provider.name}
                className={cn(
                  'size-5 shrink-0 rounded',
                  MONO_LOGO_PROVIDERS.has(provider.id) && 'dark:invert',
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Box className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{provider.name}</span>
              {configs[provider.id]?.isServerConfigured && (
                <span className="block text-xs leading-5 text-muted-foreground">
                  {t('settings.serverConfigured')}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {onAdd && (
        <div className="hidden border-t p-3 lg:block">
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            {t('settings.addProviderButton')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Helper: get TTS/ASR provider display name ───
// The id→i18n-key tables live in lib/audio/provider-display so the generation
// toolbar resolves provider names the same way this dialog does.
function getTTSProviderName(providerId: TTSProviderId, t: (key: string) => string): string {
  if (isCustomTTSProvider(providerId)) {
    const cfg = useSettingsStore.getState().ttsProvidersConfig[providerId];
    return cfg?.customName || providerId;
  }
  return resolveTTSProviderName(providerId, t);
}

function getASRProviderName(providerId: ASRProviderId, t: (key: string) => string): string {
  if (isCustomASRProvider(providerId)) {
    const cfg = useSettingsStore.getState().asrProvidersConfig[providerId];
    return cfg?.customName || providerId;
  }
  return resolveASRProviderName(providerId, t);
}

// ─── Image/Video provider name helpers ───
const IMAGE_PROVIDER_NAMES: Record<ImageProviderId, string> = {
  seedream: 'providerSeedream',
  'openai-image': 'providerOpenAIImage',
  'qwen-image': 'providerQwenImage',
  'nano-banana': 'providerNanoBanana',
  'minimax-image': 'providerMiniMaxImage',
  'grok-image': 'providerGrokImage',
  'comfyui-image': 'providerComfyUIImage',
};

const IMAGE_PROVIDER_ICONS: Record<ImageProviderId, string> = {
  seedream: '/logos/doubao.svg',
  'openai-image': '/logos/openai.svg',
  'qwen-image': '/logos/bailian.svg',
  'nano-banana': '/logos/gemini.svg',
  'minimax-image': '/logos/minimax.svg',
  'grok-image': '/logos/grok.svg',
  'comfyui-image': '/logos/comfyui.svg',
};

const VIDEO_PROVIDER_NAMES: Record<VideoProviderId, string> = {
  seedance: 'providerSeedance',
  kling: 'providerKling',
  veo: 'providerVeo',
  'minimax-video': 'providerMiniMaxVideo',
  'grok-video': 'providerGrokVideo',
  happyhorse: 'providerHappyHorse',
};

const VIDEO_PROVIDER_ICONS: Record<VideoProviderId, string> = {
  seedance: '/logos/doubao.svg',
  kling: '/logos/kling.svg',
  veo: '/logos/gemini.svg',
  'minimax-video': '/logos/minimax.svg',
  'grok-video': '/logos/grok.svg',
  happyhorse: '/logos/qwen.svg',
};

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
}

export function SettingsDialog({ open, onOpenChange, initialSection }: SettingsDialogProps) {
  const { t } = useI18n();

  // Get settings from store
  const providerId = useSettingsStore((state) => state.providerId);
  const _modelId = useSettingsStore((state) => state.modelId);
  const providersConfig = useSettingsStore((state) => state.providersConfig);
  const pdfProviderId = useSettingsStore((state) => state.pdfProviderId);
  const pdfProvidersConfig = useSettingsStore((state) => state.pdfProvidersConfig);
  const webSearchProviderId = useSettingsStore((state) => state.webSearchProviderId);
  const webSearchProvidersConfig = useSettingsStore((state) => state.webSearchProvidersConfig);
  const imageProviderId = useSettingsStore((state) => state.imageProviderId);
  const imageProvidersConfig = useSettingsStore((state) => state.imageProvidersConfig);
  const videoProviderId = useSettingsStore((state) => state.videoProviderId);
  const videoProvidersConfig = useSettingsStore((state) => state.videoProvidersConfig);
  const ttsProviderId = useSettingsStore((state) => state.ttsProviderId);
  const ttsProvidersConfig = useSettingsStore((state) => state.ttsProvidersConfig);
  const asrProviderId = useSettingsStore((state) => state.asrProviderId);
  const asrProvidersConfig = useSettingsStore((state) => state.asrProvidersConfig);
  const platformMode = useSettingsStore((state) => state.mode);
  const isTeacherMode = platformMode === 'teacher';

  // Store actions
  const setProviderConfig = useSettingsStore((state) => state.setProviderConfig);
  const setProvidersConfig = useSettingsStore((state) => state.setProvidersConfig);
  const setTTSProvider = useSettingsStore((state) => state.setTTSProvider);
  const setASRProvider = useSettingsStore((state) => state.setASRProvider);

  // Navigation
  const [activeSection, setActiveSection] = useState<SettingsSection>('providers');
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(providerId);
  const [selectedPdfProviderId, setSelectedPdfProviderId] = useState<PDFProviderId>(pdfProviderId);
  const [selectedWebSearchProviderId, setSelectedWebSearchProviderId] =
    useState<WebSearchProviderId>(webSearchProviderId);
  const [selectedImageProviderId, setSelectedImageProviderId] =
    useState<ImageProviderId>(() => IMAGE_PROVIDERS[imageProviderId]?.id ?? 'seedream');
  const [selectedVideoProviderId, setSelectedVideoProviderId] =
    useState<VideoProviderId>(videoProviderId);
  // Persistence hydrates after mount. Re-open on the configured provider instead
  // of keeping the empty pane selected during the first render.
  useEffect(() => {
    if (!open) return;
    const current = useSettingsStore.getState();
    /* eslint-disable react-hooks/set-state-in-effect -- Select the current service when opening settings. */
    setSelectedProviderId(current.providerId);
    setSelectedPdfProviderId(current.pdfProviderId);
    setSelectedWebSearchProviderId(current.webSearchProviderId);
    setSelectedImageProviderId(current.imageProviderId);
    setSelectedVideoProviderId(current.videoProviderId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);
  // Navigate to initialSection when dialog opens
  useEffect(() => {
    if (open && initialSection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync section from prop when dialog opens
      setActiveSection(initialSection);
    }
  }, [open, initialSection]);

  // Leave teacher-only sections when the platform mode is not teacher
  useEffect(() => {
    if (!isTeacherMode && (activeSection === 'knowledge' || activeSection === 'schedule')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Drop an unreachable teacher-only section
      setActiveSection('memory');
    }
  }, [isTeacherMode, activeSection]);

  // Model editing state
  const [editingModel, setEditingModel] = useState<EditingModel | null>(null);
  const [showModelDialog, setShowModelDialog] = useState(false);

  // Provider deletion confirmation
  const [providerToDelete, setProviderToDelete] = useState<ProviderId | null>(null);

  // Add provider dialog
  const [showAddProviderDialog, setShowAddProviderDialog] = useState(false);
  const [showAddTTSProviderDialog, setShowAddTTSProviderDialog] = useState(false);
  const [showAddASRProviderDialog, setShowAddASRProviderDialog] = useState(false);
  const addCustomTTSProvider = useSettingsStore((state) => state.addCustomTTSProvider);
  const addCustomASRProvider = useSettingsStore((state) => state.addCustomASRProvider);

  const handleAddTTSProvider = (data: NewAudioProviderData) => {
    const id = `custom-tts-${Date.now()}` as TTSProviderId;
    addCustomTTSProvider(id, data.name, data.baseUrl, data.requiresApiKey, data.defaultModel);
  };

  const handleAddASRProvider = (data: NewAudioProviderData) => {
    const id = `custom-asr-${Date.now()}` as ASRProviderId;
    addCustomASRProvider(id, data.name, data.baseUrl, data.requiresApiKey);
  };

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Resizable column widths
  const [sidebarWidth, setSidebarWidth] = useState(208);
  const [providerListWidth, setProviderListWidth] = useState(216);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{
    target: 'sidebar' | 'providerList';
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, target: 'sidebar' | 'providerList') => {
      e.preventDefault();
      const startWidth = target === 'sidebar' ? sidebarWidth : providerListWidth;
      resizeRef.current = { target, startX: e.clientX, startWidth };
      setIsResizing(true);
    },
    [sidebarWidth, providerListWidth],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { target, startX, startWidth } = resizeRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(120, Math.min(360, startWidth + delta));
      if (target === 'sidebar') {
        setSidebarWidth(newWidth);
      } else {
        setProviderListWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  const handleSave = () => {
    onOpenChange(false);
  };

  const handleProviderSelect = (pid: ProviderId) => {
    setSelectedProviderId(pid);
  };

  const handleProviderConfigChange = (
    pid: ProviderId,
    apiKey: string,
    baseUrl: string,
    requiresApiKey: boolean,
  ) => {
    setProviderConfig(pid, {
      apiKey,
      baseUrl,
      requiresApiKey,
    });
  };

  const handleProviderConfigSave = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const selectedProvider = providersConfig[selectedProviderId]
    ? {
        id: selectedProviderId,
        name: providersConfig[selectedProviderId].name,
        type: providersConfig[selectedProviderId].type,
        defaultBaseUrl: providersConfig[selectedProviderId].defaultBaseUrl,
        baseUrlPlaceholder: PROVIDERS[selectedProviderId]?.baseUrlPlaceholder,
        supportsModelDiscovery: PROVIDERS[selectedProviderId]?.supportsModelDiscovery,
        alternateBaseUrls: PROVIDERS[selectedProviderId]?.alternateBaseUrls,
        icon: providersConfig[selectedProviderId].icon,
        requiresApiKey: providersConfig[selectedProviderId].requiresApiKey,
        models: providersConfig[selectedProviderId].models,
      }
    : undefined;

  // Handle model editing
  const handleEditModel = (pid: ProviderId, modelIndex: number) => {
    const allModels = providersConfig[pid]?.models || [];
    setEditingModel({
      providerId: pid,
      modelIndex,
      model: { ...allModels[modelIndex] },
    });
    setShowModelDialog(true);
  };

  const handleAddModel = () => {
    setEditingModel({
      providerId: selectedProviderId,
      modelIndex: null,
      model: {
        id: '',
        name: '',
        capabilities: {
          streaming: true,
          tools: true,
          vision: false,
        },
      },
    });
    setShowModelDialog(true);
  };

  const handleDeleteModel = (pid: ProviderId, modelIndex: number) => {
    const currentModels = providersConfig[pid]?.models || [];
    const newModels = currentModels.filter((_, i) => i !== modelIndex);
    setProviderConfig(pid, { models: newModels });
  };

  // Merge probed model ids into the provider's model list. Previously
  // probe-derived entries (`source: 'probed'`) are dropped first so a re-fetch
  // (after the user changes base URL / API key) REPLACES the stale set instead
  // of accumulating dead ids. Catalog and manually-added models are preserved.
  // `modelInfoFromId(id, pid)` keeps built-in thinking capability so the
  // thinking control isn't silently hidden for fetched built-in models.
  const handleModelsFetched = (pid: ProviderId, fetchedIds: string[]): number => {
    const currentModels = providersConfig[pid]?.models || [];
    const kept = currentModels.filter((m) => m.source !== 'probed');
    const keptIds = new Set(kept.map((m) => m.id));
    const additions = fetchedIds
      .filter((id) => !keptIds.has(id))
      .map((id) => ({ ...modelInfoFromId(id, pid), source: 'probed' as const }));
    const next = [...kept, ...additions];
    // Write when the set changed at all — additions, or stale probed ids pruned.
    if (additions.length > 0 || next.length !== currentModels.length) {
      setProviderConfig(pid, { models: next });
    }
    return additions.length;
  };

  const handleAutoSaveModel = () => {
    if (!editingModel) return;
    const { providerId: pid, modelIndex, model } = editingModel;
    if (!model.id.trim()) return;
    const currentModels = providersConfig[pid]?.models || [];
    let newModels: typeof currentModels;
    let newModelIndex = modelIndex;

    if (modelIndex === null) {
      const existingIndex = currentModels.findIndex((m) => m.id === model.id);
      if (existingIndex >= 0) {
        newModels = [...currentModels];
        newModels[existingIndex] = model;
        newModelIndex = existingIndex;
      } else {
        newModels = [...currentModels, model];
        newModelIndex = newModels.length - 1;
      }
      setProviderConfig(pid, { models: newModels });
      setEditingModel({ ...editingModel, modelIndex: newModelIndex });
    } else {
      newModels = [...currentModels];
      newModels[modelIndex] = model;
      setProviderConfig(pid, { models: newModels });
    }
  };

  const handleSaveModel = () => {
    if (!editingModel) return;
    const { providerId: pid, modelIndex, model } = editingModel;
    if (!model.id.trim()) {
      toast.error(t('settings.modelIdRequired'));
      return;
    }
    const currentModels = providersConfig[pid]?.models || [];
    let newModels: typeof currentModels;
    if (modelIndex === null) {
      newModels = [...currentModels, model];
    } else {
      newModels = [...currentModels];
      newModels[modelIndex] = model;
    }
    setProviderConfig(pid, { models: newModels });
    setShowModelDialog(false);
    setEditingModel(null);
  };

  // Handle provider management
  const handleAddProvider = (providerData: NewProviderData) => {
    if (!providerData.name.trim()) {
      toast.error(t('settings.providerNameRequired'));
      return;
    }
    const newProviderId = `custom-${Date.now()}` as ProviderId;
    const updatedConfig = {
      ...providersConfig,
      [newProviderId]: createCustomProviderSettings({
        name: providerData.name,
        type: providerData.type,
        baseUrl: providerData.baseUrl,
        icon: providerData.icon,
        requiresApiKey: providerData.requiresApiKey,
        modelsUrl: providerData.modelsUrl,
      }),
    };
    setProvidersConfig(updatedConfig);
    setShowAddProviderDialog(false);
    setSelectedProviderId(newProviderId);
  };

  const handleDeleteProvider = (pid: ProviderId) => {
    if (providersConfig[pid]?.isBuiltIn) {
      toast.error(t('settings.cannotDeleteBuiltIn'));
      return;
    }
    setProviderToDelete(pid);
  };

  const confirmDeleteProvider = () => {
    if (!providerToDelete) return;
    const pid = providerToDelete;
    const updatedConfig = { ...providersConfig };
    delete updatedConfig[pid];
    // setProvidersConfig re-resolves the global (providerId, modelId)
    // selection at the source (#580 invariant) — keep a still-usable
    // provider, fall back to another usable one, or go to State A. No
    // hand-rolled "pick the first config key" here: that ignored usability
    // and could re-select an invalid/unusable provider.
    setProvidersConfig(updatedConfig);
    if (selectedProviderId === pid) {
      // Settings-panel tab only (local UI), independent of model selection.
      const firstRemainingPid = Object.keys(updatedConfig)[0] as ProviderId | undefined;
      setSelectedProviderId(firstRemainingPid || 'openai');
    }
    setProviderToDelete(null);
  };

  const handleResetProvider = (pid: ProviderId) => {
    const provider = PROVIDERS[pid];
    if (!provider) return;
    setProviderConfig(pid, { models: [...provider.models] });
    toast.success(t('settings.resetSuccess'));
  };

  // Get all providers from providersConfig
  const allProviders = Object.entries(providersConfig).map(([id, config]) => ({
    id: id as ProviderId,
    name: config.name,
    type: config.type,
    defaultBaseUrl: config.defaultBaseUrl,
    icon: config.icon,
    requiresApiKey: config.requiresApiKey,
    models: config.models,
    isServerConfigured: config.isServerConfigured,
  }));

  // Sections that show a provider list column
  const _hasProviderList = [
    'providers',
    'pdf',
    'web-search',
    'image',
    'video',
    'tts',
    'asr',
  ].includes(activeSection);

  // Get header content based on section
  const getHeaderContent = () => {
    switch (activeSection) {
      case 'general':
        return <h2 className="text-lg font-semibold">{t('settings.systemSettings')}</h2>;
      case 'skills':
        return (
          <>
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('settings.skills.title')}</h2>
          </>
        );
      case 'token-plan':
        return <h2 className="text-lg font-semibold">{t('settings.tokenPlan.nav')}</h2>;
      case 'memory':
        return (
          <>
            <Brain className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('settings.memory.title')}</h2>
          </>
        );
      case 'knowledge':
        return isTeacherMode ? (
          <>
            <Library className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('settings.knowledge.title')}</h2>
          </>
        ) : null;
      case 'schedule':
        return isTeacherMode ? (
          <>
            <CalendarClock className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('settings.schedule.title')}</h2>
          </>
        ) : null;
      case 'links':
        return (
          <>
            <ExternalLink className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('settings.links.title')}</h2>
          </>
        );
      case 'providers':
        if (selectedProvider) {
          return (
            <>
              {selectedProvider.icon ? (
                <img
                  src={selectedProvider.icon}
                  alt={selectedProvider.name}
                  className={cn(
                    'w-8 h-8 rounded',
                    MONO_LOGO_PROVIDERS.has(selectedProvider.id) && 'dark:invert',
                  )}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Box className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <h2 className="text-lg font-semibold">
                  {t(`settings.providerNames.${selectedProvider.id}`) !==
                  `settings.providerNames.${selectedProvider.id}`
                    ? t(`settings.providerNames.${selectedProvider.id}`)
                    : selectedProvider.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {getProviderTypeLabel(selectedProvider.type, t)}
                </p>
              </div>
            </>
          );
        }
        return null;
      case 'pdf': {
        const pdfProvider = PDF_PROVIDERS[selectedPdfProviderId];
        if (!pdfProvider) return null;
        return (
          <>
            {pdfProvider.icon ? (
              <img
                src={pdfProvider.icon}
                alt={pdfProvider.name}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Box className="h-8 w-8 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">{pdfProvider.name}</h2>
          </>
        );
      }
      case 'web-search': {
        const wsProvider = WEB_SEARCH_PROVIDERS[selectedWebSearchProviderId];
        if (!wsProvider) return null;
        return (
          <>
            {wsProvider.icon ? (
              <img
                src={wsProvider.icon}
                alt={wsProvider.name}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Box className="h-8 w-8 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">
              {getWebSearchProviderDisplayName(wsProvider.id, t)}
            </h2>
          </>
        );
      }
      case 'image': {
        const imgProvider = IMAGE_PROVIDERS[selectedImageProviderId];
        const imgIcon = IMAGE_PROVIDER_ICONS[selectedImageProviderId];
        return (
          <>
            {imgIcon ? (
              <img
                src={imgIcon}
                alt={imgProvider?.name}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Box className="h-8 w-8 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">
              {t(`settings.${IMAGE_PROVIDER_NAMES[selectedImageProviderId]}`) || imgProvider?.name}
            </h2>
          </>
        );
      }
      case 'video': {
        const vidProvider = VIDEO_PROVIDERS[selectedVideoProviderId];
        const vidIcon = VIDEO_PROVIDER_ICONS[selectedVideoProviderId];
        return (
          <>
            {vidIcon ? (
              <img
                src={vidIcon}
                alt={vidProvider?.name}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Box className="h-8 w-8 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">
              {t(`settings.${VIDEO_PROVIDER_NAMES[selectedVideoProviderId]}`) || vidProvider?.name}
            </h2>
          </>
        );
      }
      case 'tts': {
        const ttsIcon = TTS_PROVIDERS[ttsProviderId as keyof typeof TTS_PROVIDERS]?.icon;
        return (
          <>
            {ttsIcon ? (
              <img
                src={ttsIcon}
                alt=""
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Volume2 className="h-6 w-6 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">{getTTSProviderName(ttsProviderId, t)}</h2>
          </>
        );
      }
      case 'asr': {
        const asrIcon = ASR_PROVIDERS[asrProviderId as keyof typeof ASR_PROVIDERS]?.icon;
        return (
          <>
            {asrIcon ? (
              <img
                src={asrIcon}
                alt=""
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Mic className="h-6 w-6 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">{getASRProviderName(asrProviderId, t)}</h2>
          </>
        );
      }
      default:
        return null;
    }
  };

  const settingsNavigation = [
    [{ id: 'token-plan', labelKey: 'settings.tokenPlan.nav', icon: CreditCard }],
    [
      { id: 'providers', labelKey: 'settings.providers', icon: Box },
      { id: 'image', labelKey: 'settings.imageSettings', icon: ImageIcon },
      { id: 'video', labelKey: 'settings.videoSettings', icon: Film },
      { id: 'tts', labelKey: 'settings.ttsSettings', icon: Volume2 },
      { id: 'asr', labelKey: 'settings.asrSettings', icon: Mic },
      { id: 'pdf', labelKey: 'settings.documentParsingSettings', icon: FileText },
      { id: 'web-search', labelKey: 'settings.webSearchSettings', icon: Search },
    ],
    [
      { id: 'skills', labelKey: 'settings.skills.nav', icon: Sparkles },
      { id: 'memory', labelKey: 'settings.memory.nav', icon: Brain },
      ...(isTeacherMode
        ? [
            { id: 'knowledge' as const, labelKey: 'settings.knowledge.nav', icon: Library },
            { id: 'schedule' as const, labelKey: 'settings.schedule.nav', icon: CalendarClock },
          ]
        : []),
      { id: 'links', labelKey: 'settings.links.nav', icon: ExternalLink },
    ],
    [{ id: 'general', labelKey: 'settings.systemSettings', icon: Settings }],
  ] satisfies Array<Array<{ id: SettingsSection; labelKey: string; icon: typeof Settings }>>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-settings-dialog
        className="workspace-palette block h-[min(92dvh,54rem)] w-[calc(100%-2rem)] max-w-6xl overflow-hidden rounded-2xl p-0 gap-0 sm:max-w-[min(75rem,calc(100vw-3rem))]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('settings.description')}</DialogDescription>
        <div className="flex h-full flex-col overflow-hidden lg:flex-row">
          <div className="flex shrink-0 items-center gap-3 border-b bg-sidebar px-4 py-3 lg:hidden">
            <label htmlFor="settings-section" className="shrink-0 text-sm font-semibold">
              {t('settings.title')}
            </label>
            <SelectField
              id="settings-section"
              value={activeSection}
              onValueChange={(value) => setActiveSection(value as SettingsSection)}
              className="flex-1"
              options={settingsNavigation.flat().map(({ id, labelKey }) => ({
                value: id,
                label: t(labelKey),
              }))}
            />
          </div>
          {/* Related settings share one group and a consistent row rhythm. */}
          <nav
            aria-label={t('settings.title')}
            className="workspace-settings-nav hidden shrink-0 overflow-y-auto bg-sidebar p-3 lg:block"
            style={{ width: sidebarWidth }}
          >
            {settingsNavigation.map((group, index) => (
              <div
                key={group[0].id}
                className={cn(
                  'space-y-0.5',
                  index > 0 && 'mt-3 border-t border-sidebar-border/70 pt-3',
                )}
              >
                {group.map(({ id, labelKey, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    data-settings-section={id}
                    aria-current={activeSection === id ? 'true' : undefined}
                    onClick={() => setActiveSection(id)}
                    className={cn(
                      'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      activeSection === id
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Sidebar resize handle */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'sidebar')}
            className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
          >
            <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
          </div>

          {/* Middle - Provider List (only shown for provider-based sections) */}
          {activeSection === 'providers' && (
            <>
              <ProviderList
                providers={allProviders}
                selectedProviderId={selectedProviderId}
                onSelect={handleProviderSelect}
                onAddProvider={() => setShowAddProviderDialog(true)}
                width={providerListWidth}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {activeSection === 'pdf' && (
            <>
              <ProviderListColumn
                providers={Object.values(PDF_PROVIDERS)}
                configs={pdfProvidersConfig}
                selectedId={selectedPdfProviderId}
                onSelect={setSelectedPdfProviderId}
                width={providerListWidth}
                t={t}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {activeSection === 'web-search' && (
            <>
              <ProviderListColumn
                providers={Object.values(WEB_SEARCH_PROVIDERS).map((provider) => ({
                  ...provider,
                  name: getWebSearchProviderDisplayName(provider.id, t),
                }))}
                configs={webSearchProvidersConfig}
                selectedId={selectedWebSearchProviderId}
                onSelect={setSelectedWebSearchProviderId}
                width={providerListWidth}
                t={t}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {activeSection === 'image' && (
            <>
              <ProviderListColumn
                providers={Object.values(IMAGE_PROVIDERS).map((p) => ({
                  id: p.id,
                  name: t(`settings.${IMAGE_PROVIDER_NAMES[p.id]}`) || p.name,
                  icon: IMAGE_PROVIDER_ICONS[p.id],
                }))}
                configs={imageProvidersConfig}
                selectedId={selectedImageProviderId}
                onSelect={setSelectedImageProviderId}
                width={providerListWidth}
                t={t}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {activeSection === 'video' && (
            <>
              <ProviderListColumn
                providers={Object.values(VIDEO_PROVIDERS).map((p) => ({
                  id: p.id,
                  name: t(`settings.${VIDEO_PROVIDER_NAMES[p.id]}`) || p.name,
                  icon: VIDEO_PROVIDER_ICONS[p.id],
                }))}
                configs={videoProvidersConfig}
                selectedId={selectedVideoProviderId}
                onSelect={setSelectedVideoProviderId}
                width={providerListWidth}
                t={t}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {activeSection === 'tts' && (
            <>
              <ProviderListColumn
                providers={[
                  ...Object.values(TTS_PROVIDERS).map((p) => ({
                    id: p.id,
                    name: getTTSProviderName(p.id, t),
                    icon: p.icon,
                  })),
                  ...Object.entries(ttsProvidersConfig)
                    .filter(([id]) => isCustomTTSProvider(id))
                    .map(([id, cfg]) => ({
                      id: id as TTSProviderId,
                      name: cfg.customName || id,
                      icon: undefined,
                    })),
                ]}
                configs={ttsProvidersConfig}
                selectedId={ttsProviderId}
                onSelect={setTTSProvider}
                width={providerListWidth}
                t={t}
                onAdd={() => setShowAddTTSProviderDialog(true)}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {activeSection === 'asr' && (
            <>
              <ProviderListColumn
                providers={[
                  ...Object.values(ASR_PROVIDERS).map((p) => ({
                    id: p.id,
                    name: getASRProviderName(p.id, t),
                    icon: p.icon,
                  })),
                  ...Object.entries(asrProvidersConfig)
                    .filter(([id]) => isCustomASRProvider(id))
                    .map(([id, cfg]) => ({
                      id: id as ASRProviderId,
                      name: cfg.customName || id,
                      icon: undefined,
                    })),
                ]}
                configs={asrProvidersConfig}
                selectedId={asrProviderId}
                onSelect={setASRProvider}
                width={providerListWidth}
                t={t}
                onAdd={() => setShowAddASRProviderDialog(true)}
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, 'providerList')}
                className="hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex group"
              >
                <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            </>
          )}

          {/* Right - Configuration Panel */}
          <div className="workspace-settings-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b p-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3 [&_h2]:break-words [&_img]:shrink-0 [&_svg]:shrink-0">
                {getHeaderContent()}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeSection === 'providers' &&
                  !providersConfig[selectedProviderId]?.isBuiltIn && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteProvider(selectedProviderId)}
                      aria-label={t('settings.deleteProvider')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  aria-label={t('settings.close')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {SERVICE_SECTIONS.includes(activeSection) && <ServiceActivation
                key={`${platformMode}/${activeSection}/${selectedProviderId}/${selectedPdfProviderId}/${selectedWebSearchProviderId}/${selectedImageProviderId}/${selectedVideoProviderId}/${ttsProviderId}/${asrProviderId}`}
                section={activeSection as ServiceSection}
                providerId={({ providers: selectedProviderId, pdf: selectedPdfProviderId, 'web-search': selectedWebSearchProviderId,
                  image: selectedImageProviderId, video: selectedVideoProviderId, tts: ttsProviderId, asr: asrProviderId })[activeSection as ServiceSection]}
              />}
              {activeSection === 'general' && <GeneralSettings />}

              {activeSection === 'skills' && <SkillSettings />}

              {activeSection === 'token-plan' && <TokenPlanSettings />}

              {activeSection === 'memory' && <MemorySettings />}

              {isTeacherMode && activeSection === 'knowledge' && <KnowledgeSettings />}

              {isTeacherMode && activeSection === 'schedule' && <ScheduleSettings />}

              {activeSection === 'links' && <LinksSettings />}

              {activeSection === 'providers' && selectedProvider && (
                <ProviderConfigPanel
                  provider={selectedProvider}
                  initialApiKey={providersConfig[selectedProviderId]?.apiKey || ''}
                  initialBaseUrl={providersConfig[selectedProviderId]?.baseUrl || ''}
                  initialRequiresApiKey={
                    providersConfig[selectedProviderId]?.requiresApiKey ?? true
                  }
                  providersConfig={providersConfig}
                  onConfigChange={(apiKey, baseUrl, requiresApiKey) =>
                    handleProviderConfigChange(selectedProviderId, apiKey, baseUrl, requiresApiKey)
                  }
                  onSave={handleProviderConfigSave}
                  onEditModel={(index) => handleEditModel(selectedProviderId, index)}
                  onDeleteModel={(index) => handleDeleteModel(selectedProviderId, index)}
                  onAddModel={handleAddModel}
                  onModelsFetched={(ids) => handleModelsFetched(selectedProviderId, ids)}
                  modelsUrl={providersConfig[selectedProviderId]?.modelsUrl}
                  onResetToDefault={() => handleResetProvider(selectedProviderId)}
                  isBuiltIn={providersConfig[selectedProviderId]?.isBuiltIn ?? true}
                />
              )}

              {activeSection === 'pdf' && (
                <PDFSettings selectedProviderId={selectedPdfProviderId} />
              )}
              {activeSection === 'web-search' && (
                <WebSearchSettings selectedProviderId={selectedWebSearchProviderId} />
              )}
              {activeSection === 'image' && (
                <ImageSettings selectedProviderId={selectedImageProviderId} />
              )}
              {activeSection === 'video' && (
                <VideoSettings selectedProviderId={selectedVideoProviderId} />
              )}
              {activeSection === 'tts' && <TTSSettings selectedProviderId={ttsProviderId} />}
              {activeSection === 'asr' && <ASRSettings selectedProviderId={asrProviderId} />}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t px-4 py-3 sm:px-6">
              {activeSection !== 'memory' && saveStatus === 'saved' && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('settings.saveSuccess')}</span>
                </div>
              )}
              {activeSection !== 'memory' && saveStatus === 'error' && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  <span>{t('settings.saveFailed')}</span>
                </div>
              )}
              <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                {t('settings.close')}
              </Button>
              {activeSection !== 'memory' && (
                <Button className="h-10" onClick={handleSave}>
                  {t('settings.save')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Edit Model Dialog */}
      <ModelEditDialog
        open={showModelDialog}
        onOpenChange={setShowModelDialog}
        editingModel={editingModel}
        setEditingModel={setEditingModel}
        onSave={handleSaveModel}
        onAutoSave={handleAutoSaveModel}
        providerId={selectedProviderId}
        apiKey={providersConfig[selectedProviderId]?.apiKey || ''}
        baseUrl={providersConfig[selectedProviderId]?.baseUrl}
        providerType={providersConfig[selectedProviderId]?.type}
        requiresApiKey={providersConfig[selectedProviderId]?.requiresApiKey}
        isServerConfigured={providersConfig[selectedProviderId]?.isServerConfigured}
      />

      {/* Add Provider Dialog */}
      <AddProviderDialog
        open={showAddProviderDialog}
        onOpenChange={setShowAddProviderDialog}
        onAdd={handleAddProvider}
      />

      {/* Add TTS Provider Dialog */}
      <AddAudioProviderDialog
        open={showAddTTSProviderDialog}
        onOpenChange={setShowAddTTSProviderDialog}
        onAdd={handleAddTTSProvider}
        type="tts"
      />

      {/* Add ASR Provider Dialog */}
      <AddAudioProviderDialog
        open={showAddASRProviderDialog}
        onOpenChange={setShowAddASRProviderDialog}
        onAdd={handleAddASRProvider}
        type="asr"
      />

      {/* Delete Provider Confirmation */}
      <AlertDialog
        open={providerToDelete !== null}
        onOpenChange={(open) => !open && setProviderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deleteProvider')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.deleteProviderConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancelEdit')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProvider}>
              {t('settings.deleteProvider')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
