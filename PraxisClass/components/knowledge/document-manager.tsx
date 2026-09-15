'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PDFSettings } from '@/components/settings/pdf-settings';
import { KnowledgeSettings } from '@/components/settings/knowledge-settings';
import { useSettingsStore } from '@/lib/store/settings';
import type { PDFProviderId } from '@/lib/pdf/types';
import type {
  DocumentStatus,
  ManagedKnowledgeDocument,
} from '@/lib/platform/knowledge/documents/types';
import {
  currentParserConfig,
  documentAction,
  documentApi,
  DOCUMENTS_API,
  type DocumentSummary,
} from './document-api';

const statuses: Record<DocumentStatus, string> = {
  queued: '等待解析',
  parsing: '正在解析',
  draft: '待核对',
  syncing: '同步中',
  indexing: '建立索引中',
  ready: '可检索',
  failed: '需要处理',
  deleting: '删除中',
};
const busyStatus = (status: DocumentStatus) =>
  ['queued', 'parsing', 'syncing', 'deleting'].includes(status);

export function DocumentManager({ onUseCase }: { onUseCase: (caseName: string) => void }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caseName, setCaseName] = useState('');
  const [source, setSource] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<ManagedKnowledgeDocument | null>(null);
  const [entryIndex, setEntryIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const selectedRef = useRef(selected);
  const dirtyRef = useRef(dirty);
  selectedRef.current = selected;
  dirtyRef.current = dirty;
  const providerId = useSettingsStore((state) => state.pdfProviderId);
  const setProvider = useSettingsStore((state) => state.setPDFProvider);
  const fetchProviders = useSettingsStore((state) => state.fetchServerProviders);
  const parserAvailable = ['mineru-cloud', 'alidocmind', 'mineru'].includes(providerId);

  const reload = useCallback(async () => {
    try {
      const result = await documentApi<{ documents: DocumentSummary[] }>();
      setDocuments(result.documents);
      setError('');
      const active = selectedRef.current;
      if (active && !dirtyRef.current) {
        const found = result.documents.find((doc) => doc.id === active.id);
        if (!found) setSelected(null);
        else if (found.updatedAt !== active.updatedAt)
          setSelected(
            (await documentApi<{ document: ManagedKnowledgeDocument }>(`?id=${active.id}`))
              .document,
          );
      }
      return result.documents;
    } catch (err) {
      setError(err instanceof Error ? err.message : '资料加载失败');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastIndexCheck = 0;
    const poll = async () => {
      if (document.visibilityState !== 'hidden') {
        const docs = await reload();
        const indexing = docs.find((doc) => doc.status === 'indexing');
        if (indexing && Date.now() - lastIndexCheck > 10000) {
          lastIndexCheck = Date.now();
          try {
            await documentAction('refresh', indexing);
          } catch (err) {
            if (!cancelled) setError(err instanceof Error ? err.message : '索引状态暂不可用');
          }
        }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 4000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reload]);

  const openDocument = async (id: string) => {
    if (dirtyRef.current) {
      toast.warning('请先保存当前草稿，或点击放弃修改');
      return;
    }
    try {
      setSelected(
        (await documentApi<{ document: ManagedKnowledgeDocument }>(`?id=${id}`)).document,
      );
      setEntryIndex(0);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '打开资料失败');
    }
  };
  const action = async (
    name: string,
    doc: Pick<ManagedKnowledgeDocument, 'id' | 'revision'>,
    extra: Record<string, unknown> = {},
  ) => {
    setSaving(true);
    try {
      const result = await documentAction(name, doc, extra);
      if (selected?.id === doc.id) setSelected(result.document);
      setDirty(false);
      setDeleteId(null);
      toast.success(
        name === 'save'
          ? '草稿已保存，发布后更新检索内容'
          : name === 'publish'
            ? '已提交同步，索引完成后可检索'
            : name === 'delete'
              ? '正在删除资料及关联索引'
              : '操作已提交',
      );
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };
  const upload = async () => {
    if (!file || !caseName.trim() || !source.trim()) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('单个文件不能超过 15 MB');
      return;
    }
    const plainText = /\.(txt|md)$/i.test(file.name);
    if (!plainText && !parserAvailable) {
      setSettingsOpen(true);
      toast.error('请先选择在线解析服务并填写凭据');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('caseName', caseName.trim());
      form.set('source', source.trim());
      if (!plainText) form.set('config', JSON.stringify(currentParserConfig()));
      const result = await documentApi<{ document: ManagedKnowledgeDocument }>('', {
        method: 'POST',
        body: form,
      });
      setSelected(result.document);
      setEntryIndex(0);
      setDirty(false);
      setUploadOpen(false);
      setFile(null);
      setSource('');
      toast.success('资料已保存，正在后台排队解析');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };
  const editEntry = (patch: Partial<ManagedKnowledgeDocument['entries'][number]>) => {
    if (!selected) return;
    setSelected({
      ...selected,
      entries: selected.entries.map((entry, index) =>
        index === entryIndex ? { ...entry, ...patch } : entry,
      ),
    });
    setDirty(true);
  };
  const visible = documents.filter((doc) => !filter || doc.caseName === filter);
  const cases = [...new Set(documents.map((doc) => doc.caseName))];
  const current = selected?.entries[entryIndex];
  const blocked = saving || (!!selected && busyStatus(selected.status));

  return (
    <section className="space-y-5" aria-label="案例资料管理">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">案例资料</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            上传资料，核对知识与出处，再发布到教学知识库。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-expanded={settingsOpen}
          >
            <Settings2 className="size-4" />
            服务设置
          </Button>
          <Button
            onClick={() => {
              if (dirty) {
                toast.warning('请先保存或放弃当前修改');
                return;
              }
              setUploadOpen(!uploadOpen);
            }}
            aria-expanded={uploadOpen}
          >
            <Plus className="size-4" />
            上传资料
          </Button>
        </div>
      </div>

      {settingsOpen && (
        <div className="workspace-panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">解析与知识库服务</h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="关闭服务设置"
              onClick={() => setSettingsOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            Dify 知识库 API 用于入库、同步与检索；TXT、Markdown
            可直接导入，扫描文件的识别需要另行配置在线解析服务。
          </p>
          <Label htmlFor="library-parser">在线解析服务</Label>
          <SelectField
            id="library-parser"
            className="mb-5 mt-2 sm:max-w-sm"
            value={parserAvailable ? providerId : ''}
            onValueChange={(value) => setProvider(value as PDFProviderId)}
            placeholder="请选择服务"
            options={[
              { value: 'mineru-cloud', label: 'MinerU 在线服务' },
              { value: 'alidocmind', label: '阿里云文档智能' },
              { value: 'mineru', label: 'MinerU 远程服务地址' },
            ]}
          />
          {parserAvailable && <PDFSettings selectedProviderId={providerId} />}
          <details className="mt-6 border-t border-border pt-4">
            <summary className="cursor-pointer font-medium">Dify 知识库 API 配置</summary>
            <div className="mt-4">
              <KnowledgeSettings />
            </div>
          </details>
        </div>
      )}

      {uploadOpen && (
        <form
          className="workspace-panel space-y-4 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void upload();
          }}
        >
          <h3 className="font-semibold">添加案例资料</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="library-case">所属案例</Label>
              <Input
                id="library-case"
                list="library-cases"
                maxLength={80}
                value={caseName}
                onChange={(event) => setCaseName(event.target.value)}
                placeholder="例如：Python 有序数据检索"
                required
                disabled={uploading}
              />
              <datalist id="library-cases">
                {cases.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="library-source">资料来源</Label>
              <Input
                id="library-source"
                maxLength={300}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="教材名称、实训手册或标准编号"
                required
                disabled={uploading}
              />
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5">
            <Label htmlFor="library-file" className="mb-3 block">
              选择文件
            </Label>
            <input
              id="library-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.bmp,.gif,.txt,.md"
              disabled={uploading}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next && !source) setSource(next.name);
              }}
              className="block w-full min-w-0 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-secondary-foreground"
            />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              TXT、Markdown 可直接导入；PDF、Office、图片使用已配置的在线解析服务。单个文件不超过 15
              MB，实际支持范围以服务为准。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={uploading || !file || !caseName.trim() || !source.trim()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploading ? '正在上传' : '上传并解析'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={() => setUploadOpen(false)}
            >
              取消
            </Button>
            <span className="text-xs text-muted-foreground">
              解析过程可离开页面，完成后回来核对。
            </span>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          {error}
          <Button size="sm" variant="ghost" onClick={() => void reload()}>
            重新加载
          </Button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SelectField
          aria-label="按案例筛选资料"
          className="sm:w-64"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: '', label: '全部案例' },
            ...cases.map((name) => ({ value: name, label: name })),
          ]}
        />
        <span className="text-sm text-muted-foreground">
          {documents.length} 份资料 ·{' '}
          {documents
            .filter((doc) => doc.publishedRevision === doc.revision)
            .reduce((sum, doc) => sum + doc.entryCount, 0)}{' '}
          条已发布知识
        </span>
        <Button variant="ghost" size="icon" aria-label="刷新资料列表" onClick={() => void reload()}>
          <RefreshCw className="size-4" />
        </Button>
      </div>
      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/50" aria-label="正在加载资料" />
      ) : !visible.length ? (
        <div className="workspace-panel px-6 py-10 text-center">
          <BookOpen className="mx-auto mb-3 size-7 text-muted-foreground" />
          <h3 className="font-medium">从一份教学资料开始</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            上传案例的教材、实训手册或标准文件，解析后即可整理成带出处的专业知识。
          </p>
        </div>
      ) : (
        <ul className="workspace-panel divide-y divide-border overflow-hidden">
          {visible.map((doc) => (
            <li
              key={doc.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5 ${selected?.id === doc.id ? 'bg-primary/5' : ''}`}
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => void openDocument(doc.id)}
              >
                <span className="block break-words text-sm font-medium">{doc.fileName}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {doc.caseName} · {(doc.fileSize / 1024 / 1024).toFixed(1)} MB · {doc.entryCount}{' '}
                  条知识
                </span>
              </button>
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${doc.status === 'ready' ? 'text-emerald-700 dark:text-emerald-400' : doc.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {busyStatus(doc.status) ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : doc.status === 'ready' ? (
                  <CheckCircle2 className="size-3.5" />
                ) : null}
                {statuses[doc.status]}
              </span>
              <Button variant="outline" size="sm" onClick={() => void openDocument(doc.id)}>
                查看与编辑
              </Button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="workspace-panel space-y-5 p-5 sm:p-6" aria-label="资料详情">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="break-words font-semibold">{selected.fileName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {statuses[selected.status]}
                {dirty ? ' · 有未保存修改' : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`${DOCUMENTS_API}?id=${selected.id}&file=1`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-3.5" />
                查看原文件
              </a>
            </Button>
          </div>
          {selected.error && (
            <p role="alert" className="text-sm text-destructive">
              {selected.error}
            </p>
          )}
          {!!selected.warnings.length && (
            <details className="rounded-lg bg-muted/40 p-3 text-sm">
              <summary className="cursor-pointer">核对提示（{selected.warnings.length}）</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 text-muted-foreground">
                {selected.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          {!!selected.entries.length && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-case">所属案例</Label>
                  <Input
                    id="edit-case"
                    value={selected.caseName}
                    maxLength={80}
                    disabled={blocked}
                    onChange={(event) => {
                      setSelected({ ...selected, caseName: event.target.value });
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-source">资料来源</Label>
                  <Input
                    id="edit-source"
                    value={selected.source}
                    maxLength={300}
                    disabled={blocked}
                    onChange={(event) => {
                      setSelected({ ...selected, source: event.target.value });
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div>
                  <Label htmlFor="entry-select">选择知识条目</Label>
                  <SelectField
                    id="entry-select"
                    className="mt-2"
                    value={String(entryIndex)}
                    onValueChange={(value) => setEntryIndex(Number(value))}
                    options={selected.entries.map((entry, index) => ({
                      value: String(index),
                      label: `${index + 1}. ${entry.enabled ? '' : '[未选入] '}${entry.title}`,
                    }))}
                  />
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    逐条核对名称、内容和出处；取消选入的条目不会发布。
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={blocked || selected.entries.length >= 120}
                    onClick={() => {
                      setSelected({
                        ...selected,
                        entries: [
                          ...selected.entries,
                          {
                            id: crypto.randomUUID(),
                            title: '新知识条目',
                            content: '请填写原文支持的知识内容',
                            location: '',
                            enabled: true,
                          },
                        ],
                      });
                      setEntryIndex(selected.entries.length);
                      setDirty(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                    添加条目
                  </Button>
                </div>
                {current && (
                  <div className="space-y-4">
                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                      <Checkbox
                        checked={current.enabled}
                        disabled={blocked}
                        onCheckedChange={(checked) => editEntry({ enabled: checked === true })}
                      />
                      选入知识库
                    </label>
                    <div className="space-y-2">
                      <Label htmlFor="entry-title">知识名称</Label>
                      <Input
                        id="entry-title"
                        maxLength={200}
                        value={current.title}
                        disabled={blocked}
                        onChange={(event) => editEntry({ title: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-location">原文位置</Label>
                      <Input
                        id="entry-location"
                        maxLength={160}
                        value={current.location}
                        disabled={blocked}
                        placeholder="教材页码、段落或工作表位置"
                        onChange={(event) => editEntry({ location: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-content">知识内容</Label>
                      <Textarea
                        id="entry-content"
                        rows={9}
                        maxLength={4000}
                        className="bg-background text-sm leading-7"
                        value={current.content}
                        disabled={blocked}
                        onChange={(event) => editEntry({ content: event.target.value })}
                      />
                      <p className="text-right text-xs text-muted-foreground">
                        {current.content.length}/4000
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  disabled={blocked || !dirty}
                  onClick={() =>
                    void action('save', selected, {
                      draft: {
                        revision: selected.revision,
                        caseName: selected.caseName,
                        source: selected.source,
                        entries: selected.entries,
                      },
                    })
                  }
                >
                  保存草稿
                </Button>
                <Button
                  disabled={blocked || dirty || !selected.entries.some((entry) => entry.enabled)}
                  onClick={() => void action('publish', selected)}
                >
                  {selected.remote ? '发布更新并同步' : '发布到知识库'}
                </Button>
                {dirty && (
                  <Button
                    variant="ghost"
                    disabled={blocked}
                    onClick={() => {
                      setDirty(false);
                      dirtyRef.current = false;
                      void openDocument(selected.id);
                    }}
                  >
                    放弃修改
                  </Button>
                )}
                {selected.publishedRevision === selected.revision && (
                  <Button
                    variant="ghost"
                    disabled={blocked || dirty}
                    onClick={() => onUseCase(selected.caseName)}
                  >
                    用此案例备课
                  </Button>
                )}
                {selected.status === 'indexing' && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void action('refresh', selected)}
                  >
                    检查索引
                  </Button>
                )}
              </div>
            </>
          )}
          {!selected.entries.length && selected.status === 'failed' && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={() =>
                void action(
                  'parse',
                  selected,
                  /\.(txt|md)$/i.test(selected.fileName) ? {} : { config: currentParserConfig() },
                )
              }
            >
              使用当前服务重试解析
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {deleteId === selected.id ? (
              <>
                <span className="text-sm">删除原文件、知识条目及 Dify 关联文档？</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={blocked}
                  onClick={() => void action('delete', selected)}
                >
                  确认删除
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>
                  取消
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={blocked || dirty}
                onClick={() => setDeleteId(selected.id)}
              >
                <Trash2 className="size-3.5" />
                删除资料
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
