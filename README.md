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
docker compose up db   # 只起 Postgres
npm run dev
```

## 门槛

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
```

CI 在每次 push 到 main 与每个 PR 上跑这三关，全绿为通过。

## 文档

- 领域术语表：`CONTEXT.md`
- 架构决策记录：`docs/adr/`
- 设计文档与实现地图：GitHub Issues #31 / #32
