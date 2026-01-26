import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Popover } from './Popover';

export type HelpTooltipPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export type HelpTooltipProps = {
  text: string;
  className?: string;
  /**
   * 默认会根据按钮在屏幕左右自动选择 start/end，避免贴边挤压换行。
   * 若你希望固定位置，可显式传入 placement。
   */
  placement?: HelpTooltipPlacement;
};

function computeAutoPlacement(el: HTMLElement | null): HelpTooltipPlacement {
  if (!el) return 'top-start';
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth || 0;
  // 右侧空间紧张时改用 end 对齐，让气泡往左“长”，不贴边
  const align: 'start' | 'end' = rect.right > vw * 0.66 ? 'end' : 'start';
  return `top-${align}`;
}

export function HelpTooltip({ text, className, placement }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [autoPlacement, setAutoPlacement] = useState<HelpTooltipPlacement>('top-start');

  const cancelClose = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => cancelClose(), []);
  useEffect(() => {
    if (!open || placement) return;
    setAutoPlacement(computeAutoPlacement(btnRef.current));
  }, [open, placement]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={text}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        className={[
          'inline-flex items-center justify-center',
          'w-4 h-4',
          'rounded-full border border-border/70',
          'text-[11px] font-bold leading-none',
          'text-fg-2 hover:text-fg-0 hover:bg-bg-2/70',
          'cursor-help select-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-border/70',
          className ?? '',
        ].join(' ')}
      >
        ?
      </button>

      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorEl={btnRef.current}
        placement={placement ?? autoPlacement}
        offset={10}
        viewportPadding={16}
        width={300}
        className="rounded-md"
      >
        <div
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          className="px-3 py-2 text-xs text-fg-1 whitespace-nowrap"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="mt-[1px] text-amber-400 shrink-0" />
            <span>{text}</span>
          </div>
        </div>
      </Popover>
    </>
  );
}

export default HelpTooltip;
