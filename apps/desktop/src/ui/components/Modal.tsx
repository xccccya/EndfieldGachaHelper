/**
 * 模态框组件
 * 基于设计系统圆角规范（Design Tokens）
 * 
 * 圆角: rounded-lg (12px) - 与卡片保持一致
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  /** 最大宽度 tailwind max-w-*（默认 max-w-3xl） */
  maxWidthClassName?: string;
  /** 背景遮罩模式：normal(默认), light(浅色，用于嵌套弹窗), none(无遮罩) */
  backdrop?: 'normal' | 'light' | 'none';
};

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  maxWidthClassName = 'max-w-3xl',
  backdrop = 'normal',
}: ModalProps) {
  const portalRoot = useMemo(() => document.body, []);
  const [present, setPresent] = useState(open);

  // backdrop blur 在 WebView2 上开销较高：为了减少“打开瞬间卡顿”，这里延后一帧再开启 blur。
  // 视觉上几乎无感，但能显著降低首帧合成压力。
  const [blurActive, setBlurActive] = useState(false);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const t = window.setTimeout(() => setPresent(false), 160);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!present) return;

    if (open) {
      setBlurActive(false);
      const raf = window.requestAnimationFrame(() => setBlurActive(true));
      return () => window.cancelAnimationFrame(raf);
    }

    const t = window.setTimeout(() => setBlurActive(false), 160);
    return () => window.clearTimeout(t);
  }, [open, present]);

  useEffect(() => {
    if (!present) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [present, onOpenChange]);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [present]);

  if (!present) return null;

  // 背景遮罩样式
  const blurClass = blurActive
    ? {
        normal: 'backdrop-blur-sm',
        // 与 CloseConfirmModal 保持一致：light 模式使用更明显的虚化
        light: 'backdrop-blur-md',
        none: '',
      }[backdrop]
    : '';

  const backdropClass = {
    normal: 'bg-black/60',
    light: 'bg-black/10',
    none: 'bg-transparent',
  }[backdrop];

  return createPortal(
    <div className={`fixed inset-0 ${backdrop === 'light' ? 'z-[10001]' : 'z-[10000]'}`}>
      {/* Backdrop */}
      <button
        type="button"
        className={`
          absolute inset-0 ${backdropClass} ${blurClass}
          transition-opacity duration-150
          ${open ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ willChange: 'opacity' }}
        onClick={() => onOpenChange(false)}
        aria-label="关闭"
      />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`
            w-full ${maxWidthClassName}
            rounded-lg border border-border bg-bg-1 shadow-xl overflow-hidden
            transition-all duration-150
            ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] translate-y-1'}
          `}
          style={{ willChange: 'transform, opacity' }}
        >
          {title ? (
            <div className="px-6 py-4 border-b border-border bg-bg-3/40">
              <div className="text-lg font-semibold text-fg-0">{title}</div>
            </div>
          ) : null}
          <div className="max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>,
    portalRoot
  );
}

export default Modal;
