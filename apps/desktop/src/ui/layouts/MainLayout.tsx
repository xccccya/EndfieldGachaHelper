/**
 * 主布局组件
 * 自定义标题栏 + 左侧边栏 + 右侧内容区
 * 基于 Design.md 工业科幻风格设计
 */

import { useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Moon,
  Sun,
  History,
  RefreshCw,
  BarChart3,
  Settings,
  UserPlus,
  ChevronRight,
  User,
} from 'lucide-react';
import { setTheme, useTheme } from '../theme';
import { useAccounts } from '../../hooks/useEndfield';
import { TitleBar } from '../components';

type NavItem = {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { path: '/stats', labelKey: 'nav.stats', icon: <BarChart3 size={20} /> },
  { path: '/', labelKey: 'nav.records', icon: <History size={20} /> },
  { path: '/sync', labelKey: 'nav.sync', icon: <RefreshCw size={20} /> },
  { path: '/account', labelKey: 'nav.account', icon: <UserPlus size={20} /> },
  { path: '/settings', labelKey: 'nav.settings', icon: <Settings size={20} /> },
];

export function MainLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const { activeAccount } = useAccounts();

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  // 获取当前页面标题
  const getCurrentTitle = () => {
    const path = location.pathname.slice(1) || 'records';
    return t(`nav.${path}`);
  };

  // 切换主题（带动画）
  const handleThemeToggle = useCallback(() => {
    setTheme(nextTheme);
  }, [nextTheme]);

  return (
    <div className="h-dvh flex flex-col bg-bg-0 text-fg-0 overflow-hidden">
      {/* 自定义标题栏 */}
      <TitleBar />

      {/* 主内容区域 */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 mx-auto w-full max-w-7xl">
        {/* 侧边栏 */}
        <aside className="w-72 shrink-0 flex flex-col rounded-2xl border border-border bg-bg-1 shadow-lg overflow-hidden">
          {/* 导航菜单 */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  group relative flex items-center gap-3 rounded-lg px-4 py-3
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-brand/15 text-brand' 
                    : 'text-fg-0 hover:bg-bg-2/80 hover:text-fg-0'
                  }
                `}
              >
                {/* 激活状态左侧装饰条 */}
                {location.pathname === item.path && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand rounded-r" />
                )}
                <span className={`shrink-0 ${location.pathname === item.path ? 'text-brand' : 'text-fg-1 group-hover:text-fg-0'} transition-colors`}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{t(item.labelKey)}</span>
                {/* 悬停箭头 */}
                <ChevronRight 
                  size={14} 
                  className={`ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${
                    location.pathname === item.path ? 'opacity-100 translate-x-0 text-brand' : 'text-fg-2'
                  }`} 
                />
              </NavLink>
            ))}
          </nav>

          {/* 底部区域：账号信息 + 版本 */}
          <div className="border-t border-border">
            {/* 当前账号显示 */}
            {activeAccount ? (
              <NavLink
                to="/account"
                className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-2 transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center text-brand font-bold text-sm border border-brand/30 group-hover:border-brand/50 transition-colors">
                  {activeAccount.roles[0]?.nickName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-fg-0">
                    {activeAccount.roles[0]?.nickName || `UID: ${activeAccount.roles[0]?.roleId || activeAccount.uid}`}
                  </div>
                  <div className="text-xs text-fg-1 truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {activeAccount.channelName}
                  </div>
                </div>
                <ChevronRight size={16} className="text-fg-2 shrink-0 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
              </NavLink>
            ) : (
              <NavLink
                to="/account"
                className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-2 transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-fg-2/10 flex items-center justify-center text-fg-2 border border-border group-hover:border-fg-2/30 transition-colors">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-fg-0">{t('account.addAccount')}</div>
                  <div className="text-xs text-fg-1">{t('account.noAccountTip')}</div>
                </div>
                <ChevronRight size={16} className="text-fg-2 shrink-0 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
              </NavLink>
            )}

            {/* 版本信息 */}
            <div className="px-4 py-3 bg-bg-2/50 flex items-center justify-between text-xs text-fg-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {t('common.online')}
              </span>
              <span className="px-2 py-0.5 rounded bg-brand/20 text-brand font-mono">
                v0.1.0
              </span>
            </div>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Header */}
          <header className="relative flex items-center justify-between rounded-2xl border border-border bg-bg-1 px-6 py-4 shadow-lg overflow-hidden">
            {/* 装饰背景 */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(
                  -45deg,
                  transparent 0%, transparent 40%,
                  currentColor 40%, currentColor 50%,
                  transparent 50%, transparent 90%,
                  currentColor 90%, currentColor 100%
                )`,
                backgroundSize: '6px 6px',
              }}
            />
            
            <div className="relative min-w-0">
              <h1 className="text-xl font-bold tracking-wide">
                {getCurrentTitle()}
              </h1>
            </div>
            
            <div className="relative flex items-center gap-2">
              {/* 主题切换按钮 - 带动画 */}
              <button
                className="group relative inline-flex items-center gap-2 rounded-lg border border-border bg-bg-2 px-4 py-2.5 text-sm font-medium text-fg-0 hover:border-brand/50 hover:bg-bg-3 active:scale-[0.98] transition-all duration-200"
                type="button"
                onClick={handleThemeToggle}
                aria-label={t('actions.toggleTheme')}
              >
                <span className="relative text-fg-1 group-hover:text-brand transition-colors">
                  <span className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'}`}>
                    <Sun size={18} />
                  </span>
                  <span className={`flex items-center justify-center transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`}>
                    <Moon size={18} />
                  </span>
                </span>
                <span className="hidden sm:inline">{t('actions.theme')}</span>
              </button>
            </div>
          </header>

          {/* 页面内容 */}
          <div className="flex-1 animate-fade-in overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
