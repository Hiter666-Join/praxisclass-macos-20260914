# 致谢与来源说明

## 1. 来源与许可

本项目在开发过程中参考了开源项目 OpenMAIC（THU-MAIC，MIT 许可，参考版本 v1.0.0 / commit 32bfd197），并在此基础上持续重构与扩展。

MIT License

Copyright (c) 2026 THU-MAIC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

以下组件同样以 MIT 许可提供，版权归各自作者：

- PptxGenJS（Copyright (c) 2015-present Brent Ely；`packages/pptxgenjs` 为其 4.0.1 的修改副本）
- PPTist 与 pptxtojson（Copyright © 2020-PRESENT pipipi-pikachu；`packages/@praxis/importer` 的来源）
- pi（earendil-works；Copyright (c) Mario Zechner）
- svg64（Copyright (c) 2018-Present Atanas Atanasov）

## 2. 其他第三方

himalaya — ISC（lib/agent 的 HTML 解析来源）

GSAP — GSAP Standard License

Inter / Noto Sans 系列 / KaTeX 字体 — OFL-1.1 / MIT

`public/avatars/*.svg` — Avataaars，Pablo Stanley，free for personal and commercial use

`public/logos/*` — 第三方商标仅用于标识对应服务商

npm 传递依赖 — 按各自 manifest 许可随安装原样携带

## 3. 本团队原创模块与改动统计

开发团队：PraxisClass。

### 团队新增模块与集成改动（S1–S5）

- `app/(platform)/**`、`app/portal/**`：提供教师端、学生端的平台 route group 与统一入口。
- `components/platform/**`：提供平台导航、布局、课程卡片、统计卡片和日程交互组件。
- `lib/platform/**`：实现平台 auth、db、analytics、memory、knowledge 与 schedule 服务。
- `components/dashboard/**`：基于 ECharts 呈现通过率、趋势、质量与失败项等反馈数据。
- `components/knowledge/**`：实现知识库查询、同步、导入、知识提取与表格视图。
- `tests/platform/**`：覆盖平台鉴权、数据访问、分析、记忆、知识库与日程逻辑。
- `lib/prompts/templates/task-engine-outlines/**`：提供产业真实任务向教学任务转化引擎的系统与用户 prompt。
- `components/generation/taskcard-view.tsx`：解析并呈现 `taskcard` fenced JSON 教学任务卡。
- `scripts/platform-preflight.mjs`：预检平台健康状态、双端入口和核心教师功能接口。
- `instrumentation.ts`：在 Node runtime 中启动并在进程退出时停止日程 tick。

### 品牌更迭中移除或替换的上游部分

- 将 LGPL 的 `mathml2omml` 替换为 `@plurimath/plurimath`。
- 剥离字体 CDN 依赖，改为仓库依赖与可配置的自托管字体来源。
- 删除上游发布流、文档站和社区素材。
- 将品牌可见层、标识符与 npm scope 全部更名为 PraxisClass / `praxis` / `@praxis/*`。

### 改动统计

以下统计固定在接手前的 `382a89e9`，相对于上游 `32bfd197`，不包含本轮未提交改动。差异行数只用于说明改动规模，不等同于独立原创量。

① 平台相关路径差异：

```text
git diff --shortstat 32bfd197..382a89e9 -- 'app/(platform)' app/portal components/platform lib/platform components/dashboard components/knowledge tests/platform scripts/platform-preflight.mjs instrumentation.ts
70 files changed, 6798 insertions(+)
```

即上述路径有 70 个文件发生变化、增加 6798 行；其中也包括对已有文件的集成修改，并非全部是新增文件。

② 全仓差异：

```text
git diff --shortstat 32bfd197..382a89e9
1435 files changed, 18302 insertions(+), 25281 deletions(-)
```

② 含删除、改名和依赖锁文件变化。来源与许可保留情况应结合实际文件审阅，不从行数推导。

## 4. 素材说明

品牌图与角色头像为本团队使用 AI 生成工具制作。
