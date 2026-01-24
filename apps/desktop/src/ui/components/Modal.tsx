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
  const backdropClass = {
    normal: 'bg-black/60 backdrop-blur-sm',
    light: 'bg-black/10 backdrop-blur-md',
    none: 'bg-transparent',
  }[backdrop];

  return createPortal(
    <div className={`fixed inset-0 ${backdrop === 'light' ? 'z-[10001]' : 'z-[10000]'}`}>
      {/* Backdrop */}
      <button
        type="button"
        className={`
          absolute inset-0 ${backdropClass}
          transition-opacity duration-150
          ${open ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={() => onOpenChange(false)}
        aria-label="关闭"
      />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`
            w-full ${maxWidthClassName}
            rounded-2xl border border-border bg-bg-1 shadow-2xl overflow-hidden
            transition-all duration-150
            ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] translate-y-1'}
          `}
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
