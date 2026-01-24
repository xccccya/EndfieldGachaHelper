import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const portalRoot = useMemo(() => document.body, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel, onConfirm]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="关闭"
      />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-bg-1 shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-bg-3/40">
            <div className="flex items-start gap-3">
              {icon ? (
                <div
                  className={`
                    mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${danger ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-brand/15 text-brand border border-brand/30'}
                  `}
                >
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <div className={`text-lg font-semibold ${danger ? 'text-red-400' : 'text-fg-0'}`}>
                  {title}
                </div>
                {description ? (
                  <div className="mt-1 text-sm text-fg-1 leading-relaxed">{description}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 bg-bg-2/20">
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onCancel}>
                {cancelText}
              </Button>
              <Button
                variant={danger ? 'ghost' : 'accent'}
                onClick={onConfirm}
                className={danger ? 'text-red-400 hover:bg-red-500/10 border border-red-500/30' : ''}
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot
  );
}

export default ConfirmDialog;
