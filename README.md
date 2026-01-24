# 终末地抽卡助手

<p align="center">
  <img src="apps/desktop/public/app-icon.svg" width="128" alt="Logo"/>
</p>

<p align="center">
  一款用于管理《终末地》抽卡记录的桌面工具
</p>

<p align="center">
  <a href="https://github.com/xccccya/EndfieldGachaHelper/releases">
    <img src="https://img.shields.io/github/v/release/xccccya/EndfieldGachaHelper?style=flat-square" alt="Release"/>
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"/>
  </a>
</p>

## 功能

- 抽卡记录同步与查询
- 抽卡数据统计分析
- 保底进度追踪
- 多账号管理
- 云端数据同步
- 中英双语支持

## 预览

<p align="center">
  <img src="apps/desktop/screenshots/image1.png" width="45%" />
  <img src="apps/desktop/screenshots/image2.png" width="45%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/image3.png" width="45%" />
  <img src="apps/desktop/screenshots/image4.png" width="45%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/image5.png" width="45%" />
  <img src="apps/desktop/screenshots/image6.png" width="45%" />
</p>

## 技术栈

| 模块 | 技术 |
|------|------|
| 桌面端 | Tauri v2 + React + Vite + TailwindCSS |
| 后端 API | NestJS + Fastify + Prisma |
| 数据库 | MySQL |

## 快速开始

### 环境要求

- Node.js（建议 LTS）
- Rust 工具链（用于 Tauri 构建）
- MySQL 8.x（云同步功能）

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
# 启动桌面端
npm run dev:desktop

# 启动后端 API（可选，云同步功能需要）
npm run dev:api
```

### 构建

```bash
# 构建 Tauri 桌面应用
npm run tauri:build -w @efgachahelper/desktop
```

## 目录结构

```
├── apps/
│   ├── desktop/     # Tauri 桌面端
│   └── api/         # NestJS 后端 API
├── packages/
│   └── shared/      # 共享类型定义
└── infra/           # 基础设施脚本
```

## 许可证

[Apache License 2.0](LICENSE)
