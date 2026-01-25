/**
 * 主布局组件
 * 自定义标题栏 + 左侧边栏 + 右侧内容区
 * 基于 Design.md 工业科幻风格设计
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
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
  Cloud,
  CloudOff,
  AlertCircle,
  Loader2,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { setTheme, useTheme } from '../theme';
import { useAccounts } from '../../hooks/useEndfield';
import { useSyncConfig, useSyncHealth } from '../../hooks/useSync';
import { useTray } from '../../hooks/useTray';
import { TitleBar, ParticleBackground, CloseConfirmModal, PageTransition } from '../components';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { getSidebarCollapsed, parseAccountKey, setSidebarCollapsed } from '../../lib/storage';

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
  { path: '/cloud-sync', labelKey: 'nav.cloudSync', icon: <Cloud size={20} /> },
  { path: '/settings', labelKey: 'nav.settings', icon: <Settings size={20} /> },
  { path: '/about', labelKey: 'nav.about', icon: <Info size={20} /> },
];

export function MainLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const { activeAccount } = useAccounts();
  const { status, lastSyncAt } = useSyncConfig();
  useSyncHealth(); // 初始化健康检查
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => getSidebarCollapsed());

  // 托盘功能
  const {
    showCloseConfirm,
    setShowCloseConfirm,
    handleCloseBehavior,
  } = useTray();

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const [themeToggleAnimating, setThemeToggleAnimating] = useState(false);

  // 获取当前页面标题
  const getCurrentTitle = () => {
    const path = location.pathname.slice(1) || 'records';
    // 将路径格式 (cloud-sync) 转换为 i18n key 格式 (cloudSync)
    const navKey = path.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return t(`nav.${navKey}`);
  };

  // 切换主题（带动画）
  const handleThemeToggle = useCallback(() => {
    setThemeToggleAnimating(true);
    window.setTimeout(() => setThemeToggleAnimating(false), 420);
    setTheme(nextTheme);
  }, [nextTheme]);

  // 响应托盘菜单发起的跳转（例如：点击“登录云同步账号”）
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<{ path: string; replace?: boolean }>('efgh:navigate', (event) => {
      const path = event.payload?.path;
      if (typeof path === 'string' && path.length > 0) {
        void navigate(path, { replace: !!event.payload?.replace });
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [navigate]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }, []);

  const navItemTitle = useCallback(
    (labelKey: string) => (sidebarCollapsed ? t(labelKey) : undefined),
    [sidebarCollapsed, t]
  );

  const syncStatusTitle = useMemo(() => {
    if (!sidebarCollapsed) return undefined;
    if (status === 'not_logged_in') return t('syncStatus.notLoggedIn', '未登录同步账号');
    if (status === 'disabled') return t('syncStatus.disabled', '同步已关闭');
    if (status === 'enabled') {
      return lastSyncAt
        ? t('syncStatus.lastSync', '同步于 {{time}}', { time: formatDistanceToNow(lastSyncAt) })
        : t('syncStatus.enabled', '同步已启用');
    }
    if (status === 'syncing') return t('syncStatus.syncing', '正在同步...');
    if (status === 'error') return t('syncStatus.error', '连接异常');
    return undefined;
  }, [lastSyncAt, sidebarCollapsed, status, t]);

  return (
    <div className="h-dvh flex flex-col bg-bg-0 text-fg-0 overflow-hidden relative">
      {/* 粒子背景 */}
      <ParticleBackground 
        particleCount={100}
        connectParticles={true}
        connectDistance={100}
        maxSpeed={0.3}
      />
      
      {/* 自定义标题栏 - 关闭按钮会触发确认弹窗 */}
      <TitleBar />

      {/* 关闭确认弹窗 */}
      <CloseConfirmModal
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleCloseBehavior}
      />

      {/* 主内容区域 */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 mx-auto w-full max-w-7xl">
        {/* 侧边栏 */}
        <aside
          className={`
            ef-sidebar shrink-0 flex flex-col rounded-lg border border-border bg-bg-1 shadow-md overflow-hidden
          `}
          data-collapsed={sidebarCollapsed ? 'true' : 'false'}
          aria-label="Sidebar"
        >
          {/* 侧边栏顶部：仅折叠按钮 */}
          <div className="ef-sidebar-top">
            <div className={`flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? t('actions.expandSidebar') : t('actions.collapseSidebar')}
                title={sidebarCollapsed ? t('actions.expandSidebar') : t('actions.collapseSidebar')}
                className="ef-sidebar-toggle group inline-flex items-center justify-center rounded-xl"
              >
                <span className="text-fg-1 group-hover:text-brand transition-colors">
                  {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </span>
              </button>
            </div>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 px-3 pb-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={navItemTitle(item.labelKey)}
                className={({ isActive }) => `
                  group relative ef-sidebar-nav-item rounded-md px-4 py-3
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
                <span
                  className={`ef-sidebar-icon shrink-0 ${location.pathname === item.path ? 'text-brand' : 'text-fg-1 group-hover:text-fg-0'} transition-colors`}
                >
                  {item.icon}
                </span>
                <span
                  className="ef-sidebar-label text-sm font-medium"
                >
                  {t(item.labelKey)}
                </span>
                {/* 悬停箭头 */}
                <ChevronRight 
                  size={14} 
                  className={`ef-sidebar-arrow opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${
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
                title={
                  sidebarCollapsed
                    ? (activeAccount.roles[0]?.nickName ||
                        `UID: ${activeAccount.roles[0]?.roleId || parseAccountKey(activeAccount.uid)?.roleId || activeAccount.uid}`)
                    : undefined
                }
                className="group ef-sidebar-footer-item px-4 py-3 hover:bg-bg-2 transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-md bg-brand/20 flex items-center justify-center text-brand font-bold text-sm border border-brand/30 group-hover:border-brand/50 transition-colors">
                  {activeAccount.roles[0]?.nickName?.charAt(0) || 'U'}
                </div>
                <div className="ef-sidebar-footer-text flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm font-semibold truncate text-fg-0">
                    {activeAccount.roles[0]?.nickName ||
                      `UID: ${activeAccount.roles[0]?.roleId || parseAccountKey(activeAccount.uid)?.roleId || activeAccount.uid}`}
                  </div>
                  <div className="text-xs text-fg-1 truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {activeAccount.channelName}
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="ef-sidebar-footer-arrow text-fg-2 shrink-0 group-hover:text-brand group-hover:translate-x-0.5 transition-all"
                />
              </NavLink>
            ) : (
              <NavLink
                to="/account"
                title={sidebarCollapsed ? t('account.addAccount') : undefined}
                className="group ef-sidebar-footer-item px-4 py-3 hover:bg-bg-2 transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-md bg-fg-2/10 flex items-center justify-center text-fg-2 border border-border group-hover:border-fg-2/30 transition-colors">
                  <User size={18} />
                </div>
                <div className="ef-sidebar-footer-text flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm font-medium text-fg-0">{t('account.addAccount')}</div>
                  <div className="text-xs text-fg-1">{t('account.noAccountTip')}</div>
                </div>
                <ChevronRight
                  size={16}
                  className="ef-sidebar-footer-arrow text-fg-2 shrink-0 group-hover:text-brand group-hover:translate-x-0.5 transition-all"
                />
              </NavLink>
            )}

            {/* 同步状态 */}
            <NavLink
              to="/cloud-sync"
              title={syncStatusTitle}
              className="group ef-sidebar-sync-item py-3 bg-bg-2/50 text-xs text-fg-1 hover:bg-bg-2 transition-colors"
            >
              <span className="ef-sidebar-sync-icon min-w-0 flex-1">
                {/* 状态图标 */}
                {status === 'not_logged_in' && (
                  <>
                    <CloudOff size={16} className="text-fg-2 shrink-0" />
                    <span className="ef-sidebar-sync-text truncate">
                      {t('syncStatus.notLoggedIn', '未登录同步账号')}
                    </span>
                  </>
                )}
                {status === 'disabled' && (
                  <>
                    <Cloud size={16} className="text-orange-400 shrink-0" />
                    <span className="ef-sidebar-sync-text truncate">
                      {t('syncStatus.disabled', '同步已关闭')}
                    </span>
                  </>
                )}
                {status === 'enabled' && (
                  <>
                    <Cloud size={16} className="text-green-500 shrink-0" />
                    <span className="ef-sidebar-sync-text truncate">
                      {lastSyncAt 
                        ? t('syncStatus.lastSync', '同步于 {{time}}', { time: formatDistanceToNow(lastSyncAt) })
                        : t('syncStatus.enabled', '同步已启用')
                      }
                    </span>
                  </>
                )}
                {status === 'syncing' && (
                  <>
                    <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
                    <span className="ef-sidebar-sync-text truncate">
                      {t('syncStatus.syncing', '正在同步...')}
                    </span>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                    <span className="ef-sidebar-sync-text truncate text-red-400">
                      {t('syncStatus.error', '连接异常')}
                    </span>
                  </>
                )}
              </span>
              <ChevronRight
                size={14}
                className="ef-sidebar-sync-arrow text-fg-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </NavLink>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Header */}
          <header className="relative flex items-center justify-between rounded-lg border border-border bg-bg-1 px-6 py-4 shadow-md overflow-hidden">
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
                className={[
                  'ef-theme-toggle group relative inline-flex items-center justify-center rounded-md',
                  'text-fg-0 active:scale-[0.98] transition-all duration-200',
                  themeToggleAnimating ? 'ef-theme-toggle--animating' : '',
                ].join(' ')}
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
              </button>
            </div>
          </header>

          {/* 页面内容 */}
          <PageTransition
            locationKey={`${location.pathname}${location.search}${location.hash}`}
            className="flex-1 overflow-auto"
          >
            {outlet}
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
