# 运行时与依赖来源

- Node.js 24.14.0：复用先前交付的官方 Windows x64、macOS arm64/x64 运行时，保留各自许可证。来源：https://nodejs.org/dist/v24.14.0/
- pnpm 10.28.0：复用原交付工具及其 LICENSE。来源：https://registry.npmjs.org/pnpm/-/pnpm-10.28.0.tgz
- 应用依赖：以本包 `PraxisClass/pnpm-lock.yaml` 为准，使用已交付离线缓存。当前锁文件只增加 `playwright-core@1.58.2` 的直接引用，包解析与依赖图相同；该版本原已作为传递依赖存在于缓存。
- PostgreSQL 16：启动时由 Docker 拉取官方 `postgres:16` 镜像，不包含在 ZIP 内。
- Chrome、Docker Desktop、模型服务、可选远程解析和多媒体工具不包含在 ZIP 内。
- 项目源码保持 Copyright (c) 2026 PraxisClass / MIT；依赖许可证保留在原始包内。
