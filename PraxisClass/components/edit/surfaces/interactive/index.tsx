'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { sceneEditorRegistry } from '@/lib/edit/scene-editor-registry';
import type { SurfaceState } from '@/lib/edit/scene-editor-surface';
import { useStageStore } from '@/lib/store/stage';
import { getInteractiveDraft, saveClassroomEdits, useClassroomDrafts } from '@/lib/edit/classroom-save';
import type { InteractiveContent, Scene } from '@/lib/types/stage';

const EMPTY_CONTENT: InteractiveContent = { type: 'interactive', html: '' };
const EMPTY_ITEMS: [] = [];

function useInteractiveSurfaceState(): SurfaceState<InteractiveContent, undefined> {
  const content = useStageStore((state) => {
    const scene = state.scenes.find((item) => item.id === state.currentSceneId);
    return scene?.content.type === 'interactive' ? scene.content : EMPTY_CONTENT;
  });
  return {
    content,
    selection: undefined,
    hasSelection: false,
    insertItems: EMPTY_ITEMS,
    floatingActions: EMPTY_ITEMS,
    commands: EMPTY_ITEMS,
    hints: EMPTY_ITEMS,
  };
}

function InteractiveSurface() {
  const scene = useStageStore((state) =>
    state.scenes.find((item) => item.id === state.currentSceneId),
  );
  if (!scene || scene.content.type !== 'interactive') return null;
  return <InteractiveEditor key={scene.id} scene={scene} content={scene.content} />;
}

function InteractiveEditor({ scene, content }: { scene: Scene; content: InteractiveContent }) {
  const storedDraft = useClassroomDrafts(state => state.drafts[`${scene.stageId}/${scene.id}`]);
  const draft = storedDraft?.html ?? content.html ?? '';
  const url = storedDraft?.url ?? content.url ?? '';
  const updateDraft = (patch: Partial<{ html: string; url: string }>) => {
    useClassroomDrafts.getState().setDraft(scene.stageId, scene.id, {
      ...(getInteractiveDraft(scene.stageId, scene.id) ?? { html: content.html ?? '', url: content.url ?? '' }), ...patch,
    });
  };
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const dirty = draft !== (content.html ?? '') || url !== (content.url ?? '');

  async function save() {
    setSaving(true);
    setFailed(false);
    setMessage('');
    try {
      await saveClassroomEdits();
      setMessage('内容已保存，刷新后仍可继续编辑。');
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col bg-background"
      aria-label="交互页面编辑器"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Button
          size="sm"
          variant={editing ? 'secondary' : 'default'}
          onClick={() => setEditing(false)}
        >
          预览
        </Button>
        <Button
          size="sm"
          variant={editing ? 'default' : 'secondary'}
          onClick={() => setEditing(true)}
        >
          编辑内容
        </Button>
        <Button size="sm" disabled={saving || (!dirty && !failed)} onClick={() => void save()}>
          {saving ? '正在保存…' : '保存内容'}
        </Button>
        {dirty && <span className="text-sm text-muted-foreground">有未保存的修改</span>}
        {message && (
          <span role={failed ? 'alert' : 'status'} className="text-sm">
            {message}
          </span>
        )}
      </div>
      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
          <label htmlFor="interactive-source" className="text-sm font-medium">
            交互页面内容（HTML）
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            可修改题目、说明、Python 初始代码与测试用例。保存后更新本页；预览使用已保存的内容。
          </p>
          <textarea
            id="interactive-source"
            value={draft}
            onChange={(event) => {
              updateDraft({ html: event.target.value });
              setMessage('');
            }}
            spellCheck={false}
            className="min-h-48 flex-1 resize-none rounded-xl border border-border bg-muted/20 p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {!content.html && (
            <>
              <label htmlFor="interactive-url" className="text-sm font-medium">
                外部页面地址
              </label>
              <input
                id="interactive-url"
                value={url}
                onChange={(event) => updateDraft({ url: event.target.value })}
                className="rounded-xl border border-border p-3 text-sm"
              />
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <SceneRenderer scene={scene} mode="playback" />
        </div>
      )}
    </section>
  );
}

sceneEditorRegistry.register({
  sceneType: 'interactive',
  SurfaceComponent: InteractiveSurface,
  useSurfaceState: useInteractiveSurfaceState,
});
