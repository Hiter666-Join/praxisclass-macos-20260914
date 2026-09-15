'use client';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select';
import type { CSSProperties } from 'react';
import { Box, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { ProviderId, ProviderConfig } from '@/lib/ai/providers';
import { MONO_LOGO_PROVIDERS } from '@/lib/ai/providers';

interface ProviderWithServerInfo extends ProviderConfig {
  isServerConfigured?: boolean;
}

interface ProviderListProps {
  providers: ProviderWithServerInfo[];
  selectedProviderId: ProviderId;
  onSelect: (providerId: ProviderId) => void;
  onAddProvider: () => void;
  width?: number;
}

export function ProviderList({
  providers,
  selectedProviderId,
  onSelect,
  onAddProvider,
  width,
}: ProviderListProps) {
  const { t } = useI18n();

  // Helper function to get translated provider name
  const getProviderDisplayName = (provider: ProviderConfig) => {
    const translationKey = `settings.providerNames.${provider.id}`;
    const translated = t(translationKey);
    // If translation exists (not equal to key), use it; otherwise fallback to provider.name
    return translated !== translationKey ? translated : provider.name;
  };

  return (
    <div
      className="workspace-settings-providers flex w-full shrink-0 flex-col bg-card lg:w-[var(--provider-list-width)]"
      style={{ '--provider-list-width': `${width ?? 192}px` } as CSSProperties}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3 lg:hidden">
        <SelectField
          value={selectedProviderId}
          onValueChange={(value) => onSelect(value as ProviderId)}
          aria-label={t('settings.providers')}
          className="flex-1"
          options={providers.map((provider) => ({
            value: provider.id,
            label: `${getProviderDisplayName(provider)}${provider.isServerConfigured ? ` · ${t('settings.serverConfigured')}` : ''}`,
          }))}
        />
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          onClick={onAddProvider}
          aria-label={t('settings.addProviderButton')}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="hidden min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3 lg:block">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            aria-pressed={selectedProviderId === provider.id}
            title={getProviderDisplayName(provider)}
            onClick={() => onSelect(provider.id)}
            className={cn(
              'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selectedProviderId === provider.id
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted/70',
            )}
          >
            {provider.icon ? (
              <img
                src={provider.icon}
                alt={getProviderDisplayName(provider)}
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
              <span className="block truncate text-sm font-medium">
                {getProviderDisplayName(provider)}
              </span>
              {provider.isServerConfigured && (
                <span className="block text-xs leading-5 text-muted-foreground">
                  {t('settings.serverConfigured')}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Add Provider Button */}
      <div className="hidden border-t p-3 lg:block">
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onAddProvider}>
          <Plus className="h-3.5 w-3.5" />
          {t('settings.addProviderButton')}
        </Button>
      </div>
    </div>
  );
}
