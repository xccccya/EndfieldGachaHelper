import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { useInteractionLock } from '../../hooks/useInteractionLock';
import { Button } from './Button';

export function InteractionLockOverlay() {
  const { t } = useTranslation();
  const lock = useInteractionLock();

  const title = useMemo(() => {
    if (!lock.locked) return '';
    if (lock.titleKey) return t(lock.titleKey, lock.title ?? '');
    return lock.title ?? '';
  }, [lock.locked, lock.title, lock.titleKey, t]);

  const cancelLabel = useMemo(() => {
    if (!lock.locked) return '';
    if (lock.cancelling) return t('sync.cancelling', '正在取消...');
    if (lock.cancelLabelKey) return t(lock.cancelLabelKey, lock.cancelLabel ?? '');
    return lock.cancelLabel ?? t('common.cancel', '取消');
  }, [lock.cancelLabel, lock.cancelLabelKey, lock.cancelling, lock.locked, t]);

  // ESC 触发取消（若可取消）
  useEffect(() => {
    if (!lock.locked || !lock.onCancel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (!lock.cancelling) lock.onCancel?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [lock.cancelling, lock.locked, lock.onCancel]);

  if (!lock.locked) return null;

  return (
    <div
      // 需要高于自定义标题栏（titlebar 的 z-index=9999），否则标题栏仍可被点击
      className="fixed inset-0 z-[10000]"
      aria-live="polite"
      aria-label={title || t('sync.lockTitle', '正在同步')}
    >
      {/* 透明拦截层：锁定交互但不遮挡页面进度 */}
      <div className="absolute inset-0 z-0 bg-transparent cursor-not-allowed" aria-hidden="true" />

      {/* 右上角锁定提示（小弹窗） */}
      <div className="absolute right-4 top-[calc(38px+1rem)] z-10 w-[360px] max-w-[calc(100vw-2rem)]">
        <div
          className={[
            'rounded-xl overflow-hidden',
            'border border-border/80',
            'bg-bg-1/95 backdrop-blur-md',
            'shadow-[0_12px_30px_rgba(0,0,0,0.45)]',
          ].join(' ')}
          role="status"
        >
          {/* 顶部强调条 */}
          <div className="h-0.5 bg-brand/80" />

          <div className="px-4 py-3 border-b border-border/70 bg-bg-2/50">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="text-brand animate-spin shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-fg-0 truncate">
                  {title || t('sync.lockTitle', '正在同步抽卡记录')}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-brand/35 bg-brand/12 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    {t('sync.locked', '已锁定')}
                  </span>
                  <span className="text-[11px] text-fg-2 truncate">
                    {t('sync.lockDesc', '同步期间将暂时锁定操作，避免误触与数据冲突。')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {lock.onCancel ? (
            <div className="px-4 py-3">
              <Button
                variant="secondary"
                size="sm"
                className="w-full border-red-500/35 text-red-300 hover:bg-red-500/10"
                disabled={!!lock.cancelling}
                onClick={() => lock.onCancel?.()}
                icon={<X size={16} />}
              >
                {cancelLabel}
              </Button>
              <div className="mt-2 text-[11px] text-fg-2">
                {t('sync.cancelHint', '提示：可按 ESC 取消')}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default InteractionLockOverlay;

