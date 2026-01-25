/**
 * 系统托盘事件监听 Hook
 * 处理托盘菜单事件和窗口关闭请求
 */

import { useEffect, useCallback, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import {
  getCloseBehavior,
  setCloseBehavior,
  type CloseBehavior,
} from '../lib/storage';
import { updateSyncConfig, getSyncConfig, notifySyncChange } from './sync';

const appWindow = getCurrentWindow();

export type UseTrayOptions = {
  /** 窗口关闭请求回调（当需要显示确认弹窗时） */
  onCloseRequested?: () => void;
};

export type UseTrayReturn = {
  /** 是否显示关闭确认弹窗 */
  showCloseConfirm: boolean;
  /** 设置是否显示关闭确认弹窗 */
  setShowCloseConfirm: (show: boolean) => void;
  /** 处理用户选择的关闭行为 */
  handleCloseBehavior: (behavior: CloseBehavior, remember: boolean) => Promise<void>;
  /** 强制退出应用 */
  forceQuit: () => Promise<void>;
  /** 隐藏窗口到托盘 */
  hideToTray: () => Promise<void>;
};

/**
 * 系统托盘事件监听 Hook
 */
export function useTray(options: UseTrayOptions = {}): UseTrayReturn {
  const { onCloseRequested } = options;
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // 隐藏窗口到托盘
  const hideToTray = useCallback(async () => {
    try {
      await appWindow.hide();
    } catch (err) {
      console.error('[useTray] Failed to hide window:', err);
    }
  }, []);

  // 强制退出应用
  const forceQuit = useCallback(async () => {
    try {
      await exit(0);
    } catch (err) {
      console.error('[useTray] Failed to exit:', err);
      // 作为备选，尝试销毁窗口
      try {
        await appWindow.destroy();
      } catch (destroyErr) {
        console.error('[useTray] Failed to destroy window:', destroyErr);
      }
    }
  }, []);

  // 处理用户选择的关闭行为
  const handleCloseBehavior = useCallback(
    async (behavior: CloseBehavior, remember: boolean) => {
      // 如果选择记住，保存偏好
      if (remember) {
        setCloseBehavior(behavior);
      }

      // 关闭弹窗
      setShowCloseConfirm(false);

      // 执行相应行为
      if (behavior === 'minimize') {
        await hideToTray();
      } else {
        await forceQuit();
      }
    },
    [hideToTray, forceQuit]
  );

  // 处理窗口关闭请求
  const handleCloseRequest = useCallback(async () => {
    // 检查是否已记住选择
    const savedBehavior = getCloseBehavior();

    if (savedBehavior) {
      // 已记住选择，直接执行
      if (savedBehavior === 'minimize') {
        await hideToTray();
      } else {
        await forceQuit();
      }
    } else {
      // 未记住选择，显示确认弹窗
      setShowCloseConfirm(true);
      onCloseRequested?.();
    }
  }, [hideToTray, forceQuit, onCloseRequested]);

  // 处理切换同步状态（来自托盘菜单的事件）
  const handleToggleSync = useCallback(() => {
    const config = getSyncConfig();
    // 只有登录后才能切换同步状态
    if (config.user && config.accessToken) {
      const newAutoSync = !config.autoSync;
      updateSyncConfig({ autoSync: newAutoSync });
      // 通知同步状态变化，让托盘菜单窗口更新
      notifySyncChange();
      console.log('[useTray] Sync toggled:', newAutoSync);
    } else {
      console.log('[useTray] Cannot toggle sync: not logged in');
    }
  }, []);

  // 处理设置自动同步状态（来自托盘菜单的事件，带目标值）
  const handleSetAutoSync = useCallback((enabled: boolean) => {
    const config = getSyncConfig();
    if (config.user && config.accessToken) {
      updateSyncConfig({ autoSync: enabled });
      notifySyncChange();
      console.log('[useTray] Auto sync set:', enabled);
    } else {
      console.log('[useTray] Cannot set auto sync: not logged in');
    }
  }, []);

  // 监听托盘事件（仅在主窗口中监听）
  useEffect(() => {
    // 只在主窗口中监听这些事件
    if (appWindow.label !== 'main') {
      return;
    }

    const unlisteners: (() => void)[] = [];

    // 监听窗口关闭请求
    void listen('window-close-requested', () => {
      void handleCloseRequest();
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    // 监听托盘退出事件
    void listen('tray-quit', () => {
      void forceQuit();
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    // 监听托盘切换同步状态事件
    void listen('tray-toggle-sync', () => {
      handleToggleSync();
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    // 监听托盘设置自动同步事件（带 enabled payload）
    void listen<{ enabled: boolean }>('tray-set-auto-sync', (event) => {
      handleSetAutoSync(!!event.payload?.enabled);
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [handleCloseRequest, forceQuit, handleToggleSync, handleSetAutoSync]);

  return {
    showCloseConfirm,
    setShowCloseConfirm,
    handleCloseBehavior,
    forceQuit,
    hideToTray,
  };
}

export default useTray;
