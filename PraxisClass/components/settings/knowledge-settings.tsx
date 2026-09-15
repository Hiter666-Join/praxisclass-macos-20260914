'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { knowledgeCall } from '@/components/knowledge/use-knowledge-api';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';

interface TestResponse {
  ok: boolean;
  status?: number;
  error?: string;
  configured: boolean;
}

export function KnowledgeSettings() {
  const { t } = useI18n();
  const dify = useSettingsStore((state) => state.dify);
  const setDify = useSettingsStore((state) => state.setDify);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await knowledgeCall<TestResponse>('test'));
    } catch (error) {
      setResult({
        ok: false,
        configured: true,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('settings.knowledge.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.knowledge.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="dify-base-url">{t('settings.knowledge.baseUrl')}</Label>
            <Input
              id="dify-base-url"
              value={dify?.baseUrl ?? ''}
              onChange={(event) => setDify({ baseUrl: event.target.value })}
              placeholder="https://api.dify.ai/v1"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dify-dataset-id">{t('settings.knowledge.datasetId')}</Label>
            <Input
              id="dify-dataset-id"
              value={dify?.datasetId ?? ''}
              onChange={(event) => setDify({ datasetId: event.target.value })}
              placeholder={t('settings.knowledge.datasetIdPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dify-api-key">{t('settings.knowledge.apiKey')}</Label>
            <div className="relative">
              <Input
                id="dify-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={dify?.apiKey ?? ''}
                onChange={(event) => setDify({ apiKey: event.target.value })}
                placeholder="dataset-…"
                className="pr-10"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={t('settings.knowledge.toggleApiKey')}
              >
                {showApiKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('settings.knowledge.envFallback')}</p>
          <p className="text-xs text-muted-foreground">
            {dify?.baseUrl && dify?.datasetId && dify?.apiKey
              ? '教师端知识库参数已填写。检索和插入资料时使用此配置，可先测试连接。'
              : '请填写知识库地址、数据集 ID 和 API Key 后测试连接。'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" disabled={testing} onClick={() => void runTest()}>
              {t('settings.knowledge.test')}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/knowledge">{t('settings.knowledge.goToKnowledge')}</Link>
            </Button>
            {result && (
              <span
                className={
                  result.ok
                    ? 'text-xs text-emerald-600 dark:text-emerald-400'
                    : 'text-xs text-destructive'
                }
              >
                {result.ok
                  ? t('settings.knowledge.testOk')
                  : result.configured === false
                    ? t('settings.knowledge.testUnconfigured')
                    : t('settings.knowledge.testFailed', {
                        detail: result.error ?? String(result.status ?? ''),
                      })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
