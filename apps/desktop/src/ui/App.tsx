import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { RecordsPage, SyncPage, StatsPage, AccountPage, SettingsPage, CloudSyncPage, AboutPage, TrayMenuPage } from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 托盘菜单窗口 - 独立路由，不使用 MainLayout */}
        <Route path="/tray-menu" element={<TrayMenuPage />} />
        
        {/* 主应用路由 */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<RecordsPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/cloud-sync" element={<CloudSyncPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

