# 终末地抽卡助手

语言 / Language / 言語: **简体中文** | [English](README.en.md) | [日本語](README.ja.md)

<p align="center">
  <img src="apps/desktop/public/app-icon.svg" width="128" alt="Logo"/>
</p>

<p align="center">
  一款用于管理《明日方舟：终末地》抽卡（寻访）记录的桌面工具。持久化记录你的寻访数据，突破官方九十天限制
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

- 抽卡记录官方接口拉取同步
- 抽卡数据统计分析（限定/常驻/新手/武器）
- 导出/导入数据（JSON/CSV）
- 多账号多角色绑定/切换
- 支持国服鹰角网络账号与国际服Gryphline（Asia和Americas/Europe服务器）账号
- 云端数据同步
- 国际化支持
- 深/浅色模式切换
- 干员/武器图标素材添加（咕咕咕）
- 抽卡排行—根据使用了云同步玩家的数据进行排行（依旧咕咕咕）

## 预览

<p align="center">
  <img src="apps/desktop/screenshots/1.png" width="90%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/2.png" width="90%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/3.png" width="90%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/4.png" width="90%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/5.png" width="90%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/6.png" width="90%" />
</p>
<p align="center">
  <img src="apps/desktop/screenshots/7.png" width="90%" />
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
