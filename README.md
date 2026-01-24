# 终末地抽卡助手（Endfield Gacha Helper）

## 开发环境要求

- Node.js（建议 LTS）
- Rust 工具链（用于 Tauri 桌面端构建）
- MySQL 8.4.6（本地）

## 目录结构

- `apps/desktop`：Tauri v2 桌面端（Vite + React）
- `apps/api`：后端 API（NestJS + Fastify + Prisma）
- `packages/shared`：共享类型/DTO
- `infra`：本地基础设施辅助（SQL 脚本，后续会补 docker compose）

## 快速开始

在仓库根目录安装依赖：

```bash
npm install
```

启动桌面端（前端 dev server）：

```bash
npm run dev:desktop
```

启动后端 API：

```bash
npm run dev:api
```
