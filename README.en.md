# Endfield Gacha Helper

Language / 言語: [简体中文](README.md) | **English** | [日本語](README.ja.md)

<p align="center">
  <img src="apps/desktop/public/app-icon.svg" width="128" alt="Logo"/>
</p>

<p align="center">
  A desktop tool for managing gacha (recruitment) history in <em>Arknights: Endfield</em>. It persistently stores your pull records and keeps them available beyond the official 90-day limitation.
</p>

<p align="center">
  <a href="https://github.com/xccccya/EndfieldGachaHelper/releases">
    <img src="https://img.shields.io/github/v/release/xccccya/EndfieldGachaHelper?style=flat-square" alt="Release"/>
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"/>
  </a>
</p>

## Features

- Sync pull history via the official API
- Statistics & analysis (limited / standard / beginner / weapon)
- Export / import (JSON / CSV)
- Multi-account and multi-character binding / switching
- Supports CN server Hypergryph accounts and Global Gryphline accounts (Asia and Americas/Europe servers)
- Cloud data sync
- Internationalization (i18n)
- Light / dark mode
- Operator / weapon icon assets (WIP)
- Pull rankings based on cloud-sync users (WIP)

## Preview

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

## Tech Stack

| Module | Tech |
|------|------|
| Desktop | Tauri v2 + React + Vite + TailwindCSS |
| Backend API | NestJS + Fastify + Prisma |
| Database | MySQL |

## Quick Start

### Requirements

- Node.js (LTS recommended)
- Rust toolchain (for Tauri builds)
- MySQL 8.x (for cloud sync)

### Install dependencies

```bash
npm install
```

### Start development

```bash
# Start the desktop app
npm run dev:desktop

# Start the backend API (optional; required for cloud sync)
npm run dev:api
```

### Build

```bash
# Build the Tauri desktop application
npm run tauri:build -w @efgachahelper/desktop
```

## Project Structure

```
├── apps/
│   ├── desktop/     # Tauri desktop app
│   └── api/         # NestJS backend API
├── packages/
│   └── shared/      # Shared type definitions
└── infra/           # Infrastructure scripts
```

## License

[Apache License 2.0](LICENSE)

