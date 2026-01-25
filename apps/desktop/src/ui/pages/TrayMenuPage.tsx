/**
 * 托盘菜单页面
 * 自定义的托盘右键菜单，使用独立窗口显示
 */

import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CloudOff as LucideCloudOff, Cloud as LucideCloud } from 'lucide-react';
import { getSyncConfig, subscribeSyncConfig } from '../../hooks/sync';
import type { SyncConfig } from '@efgachahelper/shared';
import { useTheme } from '../theme';

// 菜单项类型
type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
};

// 图标组件
const Icons = {
  // 显示窗口
  Window: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  // 云同步
  Cloud: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  ),
  // 云同步关闭
  CloudOff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M7.73 7.73A7.96 7.96 0 0 0 4 14c0 4.42 3.58 8 8 8h5a5 5 0 0 0 4.38-7.45"/>
      <path d="M16.74 10c.26-.7.4-1.44.4-2.22 0-3.86-3.14-7-7-7a6.99 6.99 0 0 0-6.13 3.63"/>
    </svg>
  ),
  // 登录
  Login: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  ),
  // 退出
  Exit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  // 用户
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  // 同步图标
  Sync: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/>
    </svg>
  ),
  // 同步关闭
  SyncOff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="10" strokeDasharray="4 2"/>
      <line x1="4" y1="4" x2="20" y2="20"/>
    </svg>
  ),
};

// 开关组件 - 精致的开关按钮
function Toggle({
  checked,
  onChange,
  disabled,
  isDark,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`
        relative inline-flex h-[20px] w-[38px] shrink-0 cursor-pointer items-center rounded-full
        transition-all duration-200 ease-in-out focus:outline-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
        ${checked 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.4)]' 
          : isDark
            ? 'bg-gray-600/60 hover:bg-gray-600/80'
            : 'bg-gray-300 hover:bg-gray-400/80'}
      `}
    >
      <span
        className={`
          inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow-lg
          transition-all duration-200 ease-in-out
          ${checked ? 'translate-x-[20px]' : 'translate-x-[2px]'}
        `}
      />
    </button>
  );
}

// 菜单项组件 - 带悬浮效果和图标
function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
  children,
  isDark,
}: MenuItemProps & { isDark: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
        transition-all duration-150 text-left group relative overflow-hidden
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : danger
            ? isDark
              ? 'hover:bg-red-500/15 text-red-400 hover:text-red-300'
              : 'hover:bg-red-500/10 text-red-600 hover:text-red-700'
            : isDark
              ? 'hover:bg-white/10 text-gray-200 hover:text-white active:bg-white/15'
              : 'hover:bg-black/5 text-gray-700 hover:text-gray-900 active:bg-black/10'
        }
      `}
    >
      {/* 悬浮高亮背景 */}
      <span className={`
        absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150
        ${danger
          ? 'bg-gradient-to-r from-red-500/10 to-transparent'
          : isDark
            ? 'bg-gradient-to-r from-white/5 to-transparent'
            : 'bg-gradient-to-r from-black/5 to-transparent'
        }
      `} />
      
      {/* 图标 */}
      <span className={`
        relative flex-shrink-0 p-1.5 rounded-md transition-all duration-150
        ${danger 
          ? isDark
            ? 'text-red-400 bg-red-500/10 group-hover:bg-red-500/20'
            : 'text-red-600 bg-red-500/10 group-hover:bg-red-500/15'
          : isDark
            ? 'text-gray-400 bg-white/5 group-hover:text-blue-400 group-hover:bg-blue-500/10'
            : 'text-gray-500 bg-black/5 group-hover:text-blue-600 group-hover:bg-blue-500/10'}
      `}>
        {icon}
      </span>
      
      {/* 标签 */}
      <span className="relative flex-1 text-sm font-medium">{label}</span>
      
      {/* 额外内容（如开关） */}
      {children && <span className="relative">{children}</span>}
    </button>
  );
}

// 分隔线组件
function Divider({ isDark }: { isDark: boolean }) {
  return <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-black/10'} my-1 mx-2`} />;
}

export function TrayMenuPage() {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 判断是否已登录
  const isLoggedIn = syncConfig?.user && syncConfig?.accessToken;
  // 判断是否开启自动同步
  const isAutoSyncEnabled = isLoggedIn && syncConfig?.autoSync;

  // 加载同步配置
  const loadSyncConfig = useCallback(() => {
    const config = getSyncConfig();
    setSyncConfig(config);
  }, []);

  // 初始化
  useEffect(() => {
    // 仅托盘菜单窗口需要：透明背景 + 禁止页面滚动（避免白边/滚动条）
    document.documentElement.classList.add('tray-menu-window');
    document.body.classList.add('tray-menu-window');

    loadSyncConfig();
    setIsReady(true);

    // 订阅配置变化
    const unsubscribe = subscribeSyncConfig(loadSyncConfig);
    return () => {
      unsubscribe();
      document.documentElement.classList.remove('tray-menu-window');
      document.body.classList.remove('tray-menu-window');
    };
  }, [loadSyncConfig]);

  // 监听同步状态更新事件
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen('tray-toggle-sync', () => {
      loadSyncConfig();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e: unknown) => {
        console.error('[TrayMenu] Failed to listen tray-toggle-sync:', e);
      });

    return () => {
      unlisten?.();
    };
  }, [loadSyncConfig]);

  // 关闭菜单
  const closeMenu = useCallback(async () => {
    try {
      await invoke('close_tray_menu');
    } catch (e) {
      console.error('Failed to close tray menu:', e);
    }
  }, []);

  // 显示主窗口
  const handleShowWindow = useCallback(async () => {
    try {
      await invoke('show_main_window_cmd');
      await closeMenu();
    } catch (e) {
      console.error('Failed to show main window:', e);
    }
  }, [closeMenu]);

  // 打开云同步页面（显示主窗口并导航到云同步页面）
  const handleOpenCloudSync = useCallback(async () => {
    try {
      // 让主窗口跳转到云同步页，并在未登录时自动弹出登录弹窗
      await invoke('navigate_main', { path: '/cloud-sync?auth=1' });
      await closeMenu();
    } catch (e) {
      console.error('Failed to open cloud sync:', e);
    }
  }, [closeMenu]);

  // 设置自动同步状态（托盘窗口里做即时 UI 更新 + 通知主窗口落盘）
  const handleSetAutoSync = useCallback(async (enabled: boolean) => {
    if (!isLoggedIn) return;

    // 先本地乐观更新（避免看起来“点了没反应”）
    setSyncConfig((prev) => (prev ? { ...prev, autoSync: enabled } : prev));

    try {
      await invoke('set_auto_sync', { enabled });
    } catch (e) {
      console.error('Failed to set auto sync:', e);
      // 失败则回滚
      setSyncConfig((prev) => (prev ? { ...prev, autoSync: !enabled } : prev));
    }
  }, [isLoggedIn]);

  // 退出应用
  const handleQuit = useCallback(async () => {
    try {
      await invoke('quit_app');
    } catch (e) {
      console.error('Failed to quit app:', e);
    }
  }, []);

  if (!isReady) {
    return (
      <div className="tray-menu-root">
        <div className="w-full h-full bg-transparent" />
      </div>
    );
  }

  const containerStyle: React.CSSProperties = isDark
    ? {
        background: 'rgba(17, 24, 39, 0.96)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        // 托盘菜单更贴近原生：去掉外部投影，避免底部出现“阴影层”
        boxShadow: 'none',
      }
    : {
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: 'none',
      };

  return (
    <div className="tray-menu-root">
      <div 
        className="w-full h-full flex flex-col rounded-lg overflow-hidden tray-menu-animate"
        style={containerStyle}
      >
        {/* 菜单内容 */}
        <div className="flex-1 p-1.5 overflow-hidden space-y-0.5">
          {/* 显示主窗口 */}
          <MenuItem
            isDark={isDark}
            icon={<Icons.Window />}
            label="显示主窗口"
            onClick={() => { void handleShowWindow(); }}
          />

          <Divider isDark={isDark} />

          {/* 云同步区域 */}
          {isLoggedIn ? (
            <>
              {/* 已登录：显示用户信息卡片 */}
              <div className={`px-2.5 py-2 rounded-lg mx-1 mb-1 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium shadow-lg">
                    {syncConfig?.user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {syncConfig?.user?.email || '用户'}
                    </p>
                    <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      已登录云同步
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 同步开关 - 特殊样式 */}
              <div 
                className={`
                  px-2.5 py-2 flex items-center gap-3 rounded-lg transition-all cursor-pointer group mx-1
                  ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}
                `}
                onClick={() => { void handleSetAutoSync(!syncConfig?.autoSync); }}
              >
                <span className={`
                  p-1.5 rounded-md transition-all duration-150
                  ${isAutoSyncEnabled 
                    ? 'text-blue-400 bg-blue-500/15' 
                    : isDark
                      ? 'text-gray-400 bg-white/5 group-hover:text-gray-300'
                      : 'text-gray-500 bg-black/5 group-hover:text-gray-700'}
                `}>
                  {isAutoSyncEnabled ? <LucideCloud size={16} /> : <LucideCloudOff size={16} />}
                </span>
                <span
                  className={`
                    flex-1 text-sm font-medium
                    ${isAutoSyncEnabled
                      ? (isDark ? 'text-white' : 'text-gray-900')
                      : (isDark ? 'text-gray-300' : 'text-gray-700')}
                  `}
                >
                  自动同步
                </span>
                <Toggle 
                  checked={isAutoSyncEnabled || false} 
                  onChange={(next) => { void handleSetAutoSync(next); }}
                  isDark={isDark}
                />
              </div>
            </>
          ) : (
            <>
              {/* 未登录：显示登录提示卡片 */}
              <div className="px-3 py-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mx-1 mb-1">
                <div className="flex items-start gap-2.5">
                  <span className="text-blue-400 mt-0.5">
                    <LucideCloudOff size={16} />
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>云同步未登录</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>登录后可跨设备同步数据</p>
                  </div>
                </div>
              </div>
              <MenuItem
                isDark={isDark}
                icon={<Icons.Login />}
                label="登录云同步账号"
                onClick={() => { void handleOpenCloudSync(); }}
              />
            </>
          )}

          <Divider isDark={isDark} />

          {/* 退出程序 */}
          <MenuItem
            isDark={isDark}
            icon={<Icons.Exit />}
            label="退出程序"
            onClick={() => { void handleQuit(); }}
            danger
          />
        </div>

        {/* 底部渐变装饰条 */}
        <div className="h-0.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 opacity-80" />
      </div>
    </div>
  );
}
