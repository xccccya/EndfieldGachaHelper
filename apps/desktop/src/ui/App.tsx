import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { RecordsPage, SyncPage, StatsPage, AccountPage, SettingsPage } from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<RecordsPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

