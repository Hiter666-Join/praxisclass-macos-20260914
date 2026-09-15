import { NodeExecutionEnv } from '@earendil-works/pi-agent-core/node';

/** pi's skill traversal uses POSIX separators, including for ignore-file matching. */
export class SkillDiscoveryEnv extends NodeExecutionEnv {
  override async fileInfo(path: string) {
    const result = await super.fileInfo(path);
    if (!result.ok || process.platform !== 'win32') return result;
    const normalized = result.value.path.replace(/\\/g, '/');
    return {
      ...result,
      value: { ...result.value, path: normalized, name: normalized.split('/').at(-1)! },
    };
  }

  override async listDir(path: string, abortSignal?: AbortSignal) {
    const result = await super.listDir(path, abortSignal);
    if (!result.ok || process.platform !== 'win32') return result;
    return {
      ...result,
      value: result.value.map((entry) => {
        const normalized = entry.path.replace(/\\/g, '/');
        return { ...entry, path: normalized, name: normalized.split('/').at(-1)! };
      }),
    };
  }
}
