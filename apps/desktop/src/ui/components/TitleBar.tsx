/**
 * 自定义窗口标题栏组件
 * 替代系统默认标题栏，提供拖拽、最小化、最大化、关闭功能
 * 设计风格：工业科幻，与应用整体视觉一致
 */

import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X, Copy, Hexagon } from 'lucide-react';

const appWindow = getCurrentWindow();

export type TitleBarProps = {
  /** 点击关闭按钮的回调，用于触发关闭确认逻辑 */
  onCloseClick?: () => void;
};

export function TitleBar({ onCloseClick }: TitleBarProps = {}) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  // 监听窗口最大化状态变化
  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        console.error('[TitleBar] Failed to check maximized state:', e);
      }
    };

    void checkMaximized();

    // 监听窗口 resize 事件来更新状态
    const unlisten = appWindow.onResized(() => {
      void (async () => {
        try {
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
        } catch (e) {
          console.error('[TitleBar] Failed to check maximized state on resize:', e);
        }
      })();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // 拖拽窗口 - Tauri v2 需要手动调用 startDragging
  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    // 只响应鼠标左键
    if (e.button !== 0) return;
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.error('[TitleBar] Failed to start dragging:', err);
    }
  }, []);

  // 双击最大化/还原
  const handleDoubleClick = useCallback(async () => {
    try {
      await appWindow.toggleMaximize();
    } catch (err) {
      console.error('[TitleBar] Failed to toggle maximize:', err);
    }
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error('[TitleBar] Failed to minimize:', err);
    }
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      await appWindow.toggleMaximize();
    } catch (err) {
      console.error('[TitleBar] Failed to toggle maximize:', err);
    }
  }, []);

  // 处理关闭按钮点击
  // 如果提供了 onCloseClick 回调，则调用它（用于显示确认弹窗）
  // 否则触发原生窗口关闭事件（会被 Rust 端拦截并发送事件到前端）
  const handleClose = useCallback(async () => {
    if (onCloseClick) {
      onCloseClick();
    } else {
      try {
        await appWindow.close();
      } catch (err) {
        console.error('[TitleBar] Failed to close:', err);
      }
    }
  }, [onCloseClick]);

  return (
    <header className="titlebar">
      {/* 拖拽区域 - 整个标题栏 */}
      <div
        className="titlebar-drag-region"
        onMouseDown={(e) => void handleDragStart(e)}
        onDoubleClick={() => void handleDoubleClick()}
      >
        {/* Logo 和标题 */}
        <div className="titlebar-brand">
          <div className="titlebar-logo">
            <Hexagon size={14} strokeWidth={2.5} />
          </div>
          <span className="titlebar-title">{t('app.title')}</span>
        </div>
      </div>

      {/* 窗口控制按钮 */}
      <div className="titlebar-controls">
        {/* 最小化 */}
        <button
          type="button"
          className="titlebar-button titlebar-button-minimize"
          onClick={() => void handleMinimize()}
          aria-label={t('titlebar.minimize')}
        >
          <Minus size={14} strokeWidth={2} />
        </button>

        {/* 最大化/还原 */}
        <button
          type="button"
          className="titlebar-button titlebar-button-maximize"
          onClick={() => void handleToggleMaximize()}
          aria-label={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={2} className="rotate-180" />
          ) : (
            <Square size={11} strokeWidth={2} />
          )}
        </button>

        {/* 关闭 */}
        <button
          type="button"
          className="titlebar-button titlebar-button-close"
          onClick={() => void handleClose()}
          aria-label={t('titlebar.close')}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

export default TitleBar;
