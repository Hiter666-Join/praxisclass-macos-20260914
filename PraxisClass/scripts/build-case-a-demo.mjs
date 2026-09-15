import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/build-case-a-demo.mjs <output-directory>');
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await fs.readFile(path.join(root, 'examples/case-a/binary-search.html'), 'utf8');
const now = new Date().toISOString();
const manifest = {
  formatVersion: 1,
  exportedAt: now,
  appVersion: '1.0.0',
  stage: {
    name: '案例 A · 有序数据检索实训',
    description: 'AI 辅助制作的教学样例；测试集 A-20260905-01，非真人试用数据。',
    language: 'zh-CN',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  agents: [],
  mediaIndex: {},
  scenes: [
    {
      type: 'interactive',
      title: 'Python 二分检索与隐藏用例',
      order: 0,
      content: { type: 'interactive', html, widgetType: 'code' },
      actions: [],
    },
  ],
};
const zip = new JSZip();
zip.file('manifest.json', JSON.stringify(manifest, null, 2));
await fs.mkdir(output, { recursive: true });
const target = path.resolve(output, 'case-a-binary-search.praxis.zip');
await fs.writeFile(target, await zip.generateAsync({ type: 'nodebuffer' }));
console.log(target);
