import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  'zh-CN': {
    translation: {
      app: {
        title: '终末地抽卡助手',
        subtitle: '本地优先 · 可选云同步',
      },
      nav: {
        records: '抽卡记录',
        sync: '云同步',
        settings: '设置',
      },
      header: {
        kicker: '工业科幻 · 高对比 · 粗边框',
        title: '项目骨架已就绪（下一步：Tauri + 本地数据库）',
      },
      actions: {
        theme: '主题',
        language: '语言',
        toggleTheme: '切换主题',
        toggleLanguage: '切换语言',
      },
      home: {
        hint: '从 0 到可用：先把基础设施搭稳',
        welcome: '欢迎',
        badge: 'DEV',
        card1: {
          title: '本地抽卡记录',
          desc: '后续接入凭据导入、拉取解析、SQLite 入库与去重。',
        },
        card2: {
          title: '云端备份',
          desc: '后续提供账号体系、批量上传、分页查询与导出。',
        },
      },
    },
  },
  'en-US': {
    translation: {
      app: {
        title: 'Endfield Gacha Helper',
        subtitle: 'Local-first · Optional cloud sync',
      },
      nav: {
        records: 'Gacha Records',
        sync: 'Cloud Sync',
        settings: 'Settings',
      },
      header: {
        kicker: 'Industrial Sci‑Fi · High contrast · Bold borders',
        title: 'Scaffold ready (next: Tauri + local DB)',
      },
      actions: {
        theme: 'Theme',
        language: 'Language',
        toggleTheme: 'Toggle theme',
        toggleLanguage: 'Toggle language',
      },
      home: {
        hint: 'From 0 to usable: build solid foundations',
        welcome: 'Welcome',
        badge: 'DEV',
        card1: {
          title: 'Local gacha records',
          desc: 'Next: credentials import, fetch/parse, SQLite storage and dedup.',
        },
        card2: {
          title: 'Cloud backup',
          desc: 'Next: accounts, batch upload, pagination and export.',
        },
      },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
});

export default i18n;

