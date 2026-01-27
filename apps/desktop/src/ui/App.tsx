import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UpdateProvider } from '../hooks/update';
import { MainLayout } from './layouts/MainLayout';
import { RecordsPage, SyncPage, StatsPage, AccountPage, SettingsPage, CloudSyncPage, AboutPage, TrayMenuPage } from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <UpdateProvider>
        <Routes>
          {/* 托盘菜单窗口 - 独立路由，不使用 MainLayout */}
          <Route path="/tray-menu" element={<TrayMenuPage />} />
          
          {/* 主应用路由 */}
          <Route element={<MainLayout />}>
            {/* 默认页：数据统计 */}
            <Route index element={<Navigate to="/stats" replace />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/sync" element={<SyncPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/cloud-sync" element={<CloudSyncPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Route>
        </Routes>
      </UpdateProvider>
    </BrowserRouter>
  );
}

