# 钢琴快速识谱

面向钢琴初学者的识谱训练网页应用。单用户、Docker 本地部署。

## 快速开始

```bash
docker compose up --build
# 打开 http://localhost:3000
```

## 本地开发

```bash
npm ci
cp .env.example .env.local
docker compose up db   # 只起 Postgres
npm run dev
```

建表迁移在服务启动时自动应用（`src/instrumentation.ts`），无需独立迁移命令。

## 门槛

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
```

CI 在每次 push 到 main 与每个 PR 上跑这三关，全绿为通过。

集成测试（`tests/integration/`）跑在真实容器化 PostgreSQL 上（不 mock）：
本地先 `docker compose up db`（或任意可达的 `DATABASE_URL`），无 DB 时自动跳过；
CI 由 workflow 的 postgres service 容器提供，缺 `DATABASE_URL` 会直接红。

## 文档

- 领域术语表：`CONTEXT.md`
- 架构决策记录：`docs/adr/`
- 设计文档与实现地图：GitHub Issues #31 / #32
