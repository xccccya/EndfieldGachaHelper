import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorEl: HTMLElement | null;
  children: React.ReactNode;
  className?: string;
  placement?: Placement;
  /** 自动根据空间在 top/bottom 间切换（默认 true） */
  autoFlip?: boolean;
  offset?: number;
  matchAnchorWidth?: boolean;
  /** 指定宽度（优先级高于 matchAnchorWidth） */
  width?: number | string;
  /** 视口边距，用于限制最大高度等 */
  viewportPadding?: number;
};

type Pos = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  maxHeight?: number;
  maxWidth?: number;
  placement: Placement;
};

function getViewport(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight };
}

export function Popover({
  open,
  onOpenChange,
  anchorEl,
  children,
  className = '',
  placement = 'bottom-start',
  autoFlip = true,
  offset = 8,
  matchAnchorWidth = false,
  width,
  viewportPadding = 12,
}: PopoverProps) {
  const [pos, setPos] = useState<Pos | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(open);

  const portalRoot = useMemo(() => document.body, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const t = window.setTimeout(() => setPresent(false), 160);
    return () => window.clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const { w, h } = getViewport();

      const preferTop = placement.startsWith('top');
      const alignEnd = placement.endsWith('end');

      const spaceBelow = Math.max(0, h - (rect.bottom + offset) - viewportPadding);
      const spaceAbove = Math.max(0, rect.top - offset - viewportPadding);

      // 小窗口时优先选择空间更大的方向
      const useTop =
        autoFlip
          ? (preferTop ? (spaceAbove >= 160 || spaceAbove >= spaceBelow) : (spaceBelow < 200 && spaceAbove > spaceBelow))
          : preferTop;

      const actualPlacement: Placement = useTop
        ? (alignEnd ? 'top-end' : 'top-start')
        : (alignEnd ? 'bottom-end' : 'bottom-start');

      const next: Pos = { placement: actualPlacement };

      const anchorWidth = Math.max(0, rect.width);
      const popWidth =
        width !== undefined
          ? undefined
          : matchAnchorWidth
            ? anchorWidth
            : undefined;

      if (popWidth !== undefined) next.width = popWidth;

      // 方向对应的可用高度，强制可滚动避免“显示不全”
      const available = Math.max(160, useTop ? spaceAbove : spaceBelow);
      next.maxHeight = available;
      next.maxWidth = Math.max(240, w - viewportPadding * 2);

      // 位置：start 用 left，end 用 right（避免依赖 popover 实际宽度）
      if (alignEnd) {
        next.right = Math.max(viewportPadding, w - rect.right);
      } else {
        next.left = Math.max(viewportPadding, Math.min(rect.left, w - viewportPadding));
      }

      // 垂直：bottom 用 top，top 用 bottom（避免依赖 popover 实际高度）
      if (useTop) {
        next.bottom = Math.max(viewportPadding, h - rect.top + offset);
      } else {
        next.top = Math.min(rect.bottom + offset, h - viewportPadding);
      }

      setPos(next);
    };

    update();

    let raf = 0;
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, anchorEl, placement, autoFlip, offset, matchAnchorWidth, width, viewportPadding]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };

    // 捕获阶段更稳定（避免内部 stopPropagation 导致外部无法关闭）
    const onPointerDownCapture = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // anchor 及 popover 本体都不应触发关闭
      if (anchorEl?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
    };
  }, [open, onOpenChange, anchorEl]);

  if (!present || !anchorEl || !pos) return null;

  const { w: vw } = getViewport();
  const resolvedWidth =
    typeof width === 'number'
      ? Math.max(240, Math.min(width, vw - viewportPadding * 2))
      : width;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: pos.top,
    bottom: pos.bottom,
    left: pos.left,
    right: pos.right,
    width: resolvedWidth ?? pos.width,
    maxHeight: pos.maxHeight,
    maxWidth: pos.maxWidth,
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className={`
        z-[9999]
        rounded-xl border border-border bg-bg-1/95 shadow-xl backdrop-blur-md
        overflow-hidden
        transition-all duration-150
        ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] translate-y-1 pointer-events-none'}
        ${className}
      `}
      role="dialog"
      aria-modal="false"
    >
      <div className="max-h-full overflow-y-auto">{children}</div>
    </div>,
    portalRoot
  );
}

export default Popover;
