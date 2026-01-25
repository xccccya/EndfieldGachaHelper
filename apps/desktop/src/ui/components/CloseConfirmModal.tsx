/**
 * 窗口关闭确认弹窗
 * 用户点击关闭按钮时显示，提供退出/最小化到托盘选项
 * 支持记住用户选择
 * 样式与 SyncAuthModal 保持一致
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Minimize2, LogOut, X, Monitor } from 'lucide-react';
import type { CloseBehavior } from '../../lib/storage';

export type CloseConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (behavior: CloseBehavior, remember: boolean) => void;
};

export function CloseConfirmModal({ open, onClose, onConfirm }: CloseConfirmModalProps) {
  const { t } = useTranslation();
  const portalRoot = useMemo(() => document.body, []);
  const [remember, setRemember] = useState(false);
  const [present, setPresent] = useState(open);

  // 控制弹窗的显示/隐藏动画
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), 160);
    return () => window.clearTimeout(timer);
  }, [open]);

  // 重置记住选项当弹窗关闭时
  useEffect(() => {
    if (!open) {
      setRemember(false);
    }
  }, [open]);

  // ESC 关闭弹窗
  useEffect(() => {
    if (!present) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [present, onClose]);

  // 防止滚动
  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [present]);

  const handleExit = useCallback(() => {
    onConfirm('exit', remember);
  }, [onConfirm, remember]);

  const handleMinimize = useCallback(() => {
    onConfirm('minimize', remember);
  }, [onConfirm, remember]);

  if (!present) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10001]">
      {/* Backdrop - 与 Modal light 模式一致 */}
      <button
        type="button"
        className={`
          absolute inset-0 bg-black/10 backdrop-blur-md
          transition-opacity duration-150
          ${open ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={onClose}
        aria-label={t('common.cancel')}
      />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div 
          className={`
            w-full max-w-md rounded-lg border border-border bg-bg-1 shadow-xl overflow-hidden
            transition-all duration-150
            ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] translate-y-1'}
          `}
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-confirm-title"
        >
          {/* Header - 与 SyncAuthModal 一致的样式 */}
          <div className="p-6 bg-bg-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-md bg-brand/20 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="close-confirm-title" className="text-lg font-bold text-fg-0">
                  {t('closeConfirm.title')}
                </h2>
                <p className="text-sm text-fg-1">
                  {t('closeConfirm.description')}
                </p>
              </div>
              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-md flex items-center justify-center text-fg-2 hover:text-fg-0 hover:bg-bg-2 transition-colors"
                aria-label={t('common.cancel')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* 选项按钮 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 最小化到托盘 */}
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="group relative flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-bg-2/50 hover:bg-bg-2 hover:border-blue-500/40 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform">
                    <Minimize2 size={24} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-fg-0">{t('closeConfirm.minimize')}</div>
                    <div className="text-xs text-fg-2 mt-0.5">{t('closeConfirm.minimizeDesc')}</div>
                  </div>
                </button>

                {/* 退出程序 */}
                <button
                  type="button"
                  onClick={handleExit}
                  className="group relative flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-bg-2/50 hover:bg-bg-2 hover:border-red-500/40 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30 group-hover:scale-110 transition-transform">
                    <LogOut size={24} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-fg-0">{t('closeConfirm.exit')}</div>
                    <div className="text-xs text-fg-2 mt-0.5">{t('closeConfirm.exitDesc')}</div>
                  </div>
                </button>
              </div>

              {/* 记住选择 */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded border-2 border-border bg-bg-2 flex items-center justify-center transition-all peer-checked:bg-brand peer-checked:border-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50 group-hover:border-fg-2">
                  {remember && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-fg-1 group-hover:text-fg-0 transition-colors">
                  {t('closeConfirm.remember')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot
  );
}

export default CloseConfirmModal;
