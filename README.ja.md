# Endfield Gacha Helper

言語 / Language: [简体中文](README.md) | [English](README.en.md) | **日本語**

<p align="center">
  <img src="apps/desktop/public/app-icon.svg" width="128" alt="Logo"/>
</p>

<p align="center">
  『<em>アークナイツ：エンドフィールド</em>』のガチャ（スカウト）履歴を管理するデスクトップツールです。スカウト履歴を永続保存し、公式の「90日」保存制限を超えて参照できるようにします。
</p>

<p align="center">
  <a href="https://github.com/xccccya/EndfieldGachaHelper/releases">
    <img src="https://img.shields.io/github/v/release/xccccya/EndfieldGachaHelper?style=flat-square" alt="Release"/>
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"/>
  </a>
</p>

## 機能

- 公式APIからスカウト履歴を取得・同期
- データの統計・分析（限定／常設／初心者／武器）
- データのエクスポート／インポート（JSON／CSV）
- 複数アカウント・複数キャラクターの紐付け／切り替え
- 中国版 Hypergryph アカウント、グローバル版 Gryphline アカウント（Asia／Americas/Europe サーバー）に対応
- クラウド同期
- 多言語（i18n）対応
- ライト／ダークテーマ切り替え
- オペレーター／武器アイコン素材の追加（作業中）
- クラウド同期ユーザーのデータに基づくランキング（作業中）

## プレビュー

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

## 技術スタック

| モジュール | 技術 |
|------|------|
| デスクトップ | Tauri v2 + React + Vite + TailwindCSS |
| バックエンド API | NestJS + Fastify + Prisma |
| データベース | MySQL |

## クイックスタート

### 必要環境

- Node.js（LTS 推奨）
- Rust ツールチェーン（Tauri のビルドに必要）
- MySQL 8.x（クラウド同期機能を利用する場合）

### 依存関係のインストール

```bash
npm install
```

### 開発起動

```bash
# デスクトップアプリを起動
npm run dev:desktop

# バックエンド API を起動（任意。クラウド同期には必要）
npm run dev:api
```

### ビルド

```bash
# Tauri デスクトップアプリをビルド
npm run tauri:build -w @efgachahelper/desktop
```

## ディレクトリ構成

```
├── apps/
│   ├── desktop/     # Tauri デスクトップアプリ
│   └── api/         # NestJS バックエンド API
├── packages/
│   └── shared/      # 共有型定義
└── infra/           # インフラ関連スクリプト
```

## ライセンス

[Apache License 2.0](LICENSE)

