'use client';

import { ExternalLink } from 'lucide-react';

import { ASTRONCLAW_URL, XINGCHEN_URL } from '@/components/platform/nav-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';

interface ExternalTool {
  key: string;
  url: string;
  mode: 'teacher' | 'student';
}

const TOOLS: ExternalTool[] = [
  { key: 'astronclaw', url: ASTRONCLAW_URL, mode: 'student' },
  { key: 'xingchen', url: XINGCHEN_URL, mode: 'teacher' },
];

export function LinksSettings() {
  const { t } = useI18n();
  const mode = useSettingsStore((state) => state.mode);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('settings.links.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.links.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          {TOOLS.filter((tool) => tool.mode === mode).map((tool) => {
            const configured = /^https?:\/\//i.test(tool.url);
            return (
              <div key={tool.key} className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{t(`platform.nav.${tool.key}`)}</span>
                {configured ? (
                  <span className="truncate text-xs text-muted-foreground">{tool.url}</span>
                ) : (
                  <Badge variant="outline">{t('settings.links.notConfigured')}</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={!configured}
                  asChild={configured}
                >
                  {configured ? (
                    <a href={tool.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('settings.links.open')}
                    </a>
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('settings.links.open')}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
