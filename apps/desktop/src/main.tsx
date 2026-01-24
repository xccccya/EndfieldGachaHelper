import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import './ui/styles/globals.css';
import './i18n';
import { initStorage } from './lib/storage';

// 初始化存储系统（包括 SQLite 数据库）
async function initApp() {
  try {
    const result = await initStorage();
    if (result.migrated) {
      console.log('[App] 数据迁移完成:', result);
    }
  } catch (e) {
    console.error('[App] 存储系统初始化失败:', e);
  }
  
  // 渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void initApp();

