/**
 * StatsPage 统计相关组件
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RarityBadge } from '../../components';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import type { RarityCountMap } from './types';
import { easeOutCubic } from './utils';

/** 动画数字组件 */
export function AnimatedNumber({
  value,
  durationMs = 700,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(value);

  useEffect(() => {
    toRef.current = value;

    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    fromRef.current = display;

    const tick = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(elapsed / durationMs, 1);
      const eased = easeOutCubic(p);
      const next = Math.round(fromRef.current + (toRef.current - fromRef.current) * eased);
      setDisplay(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, prefersReducedMotion]);

  return <span className={className}>{display}</span>;
}

/** 稀有度分布行 */
export function RarityDistRow({
  rarity,
  count,
  percentage,
  barClassName,
  textClassName,
  unitsLabel,
}: {
  rarity: number;
  count: number;
  percentage: number;
  barClassName: string;
  textClassName: string;
  unitsLabel: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimatedPct(percentage);
      return;
    }
    const id = window.requestAnimationFrame(() => setAnimatedPct(percentage));
    return () => window.cancelAnimationFrame(id);
  }, [percentage, prefersReducedMotion]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <RarityBadge rarity={rarity} />
          <span className="text-sm text-fg-1">{count} {unitsLabel}</span>
        </div>
        <span className={`text-sm font-medium ${textClassName}`}>
          {percentage.toFixed(2)}%
        </span>
      </div>
      <div className="h-3 bg-bg-3 rounded-sm overflow-hidden">
        <div
          className={`h-full ${barClassName} ef-progress-fill`}
          style={{ width: `${animatedPct}%` }}
        />
      </div>
    </div>
  );
}

/** 统计卡片 */
export function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  subValue,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: number | string;
  label: string;
  subValue?: string;
}) {
  return (
    <div className="ef-stat-tile p-4">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-md ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-fg-0 tabular-nums">
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </div>
          <div className="text-sm text-fg-1 truncate">{label}</div>
          {subValue && (
            <div className="text-xs text-fg-2 mt-0.5">{subValue}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 稀有度堆叠条 */
export function RarityStackBar({
  counts,
  prefersReducedMotion,
  className,
}: {
  counts: Pick<RarityCountMap, 4 | 5 | 6>;
  prefersReducedMotion: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const total = counts[6] + counts[5] + counts[4];
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<null | { rarity: 4 | 5 | 6; count: number; pct: number; left: number }>(null);

  const segments: Array<{ rarity: 4 | 5 | 6; color: string; label: string; count: number }> = [
    { rarity: 6 as const, color: 'bg-orange-500', label: '6★', count: counts[6] },
    { rarity: 5 as const, color: 'bg-amber-500', label: '5★', count: counts[5] },
    { rarity: 4 as const, color: 'bg-purple-500', label: '4★', count: counts[4] },
  ].filter((s) => s.count > 0);

  if (total <= 0 || segments.length === 0) return null;

  const onEnter = (seg: { rarity: 4 | 5 | 6; count: number; label: string }) => (e: React.MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const segRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const left = segRect.left - wrapRect.left + segRect.width / 2;
    const pct = (seg.count / total) * 100;
    setHover({ rarity: seg.rarity, count: seg.count, pct, left });
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`} aria-label={t('stats.ui.rarityAria')}>
      {hover && (
        <div
          className="
            pointer-events-none absolute -top-8 z-10
            -translate-x-1/2
            whitespace-nowrap rounded-md border border-border px-2 py-1
            text-xs leading-none text-fg-0 shadow-lg
            transition-opacity duration-150
          "
          style={{ left: hover.left, opacity: 1, backgroundColor: 'var(--bg-1)' }}
        >
          {t('stats.ui.rarityTooltip', { rarity: hover.rarity, count: hover.count, pct: hover.pct.toFixed(2) })}
        </div>
      )}

      <div className="h-3 rounded-sm overflow-hidden bg-bg-3 flex">
        {segments.map((s) => {
          const pct = (s.count / total) * 100;
          return (
            <div
              key={s.rarity}
              className={[
                'h-full',
                prefersReducedMotion ? '' : 'transition-[width] duration-700',
              ].join(' ')}
              style={{ width: `${pct}%` }}
              onMouseEnter={onEnter(s)}
              onMouseLeave={() => setHover(null)}
              role="presentation"
            >
              <div className={`h-full ${s.color}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 池汇总磁贴 */
export function PoolSummaryTile({
  title,
  subtitle,
  metricLeft,
  metricRight,
  counts,
  prefersReducedMotion,
  accentClassName,
}: {
  title: string;
  subtitle: string;
  metricLeft: string;
  metricRight: string;
  counts: Pick<RarityCountMap, 4 | 5 | 6>;
  prefersReducedMotion: boolean;
  accentClassName: string;
}) {
  return (
    <div className="ef-stat-tile p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${accentClassName}`}>{title}</div>
          <div className="mt-0.5 text-xs text-fg-2">{subtitle}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-fg-1">
        <span className="truncate">{metricLeft}</span>
        <span className="shrink-0 text-fg-2">{metricRight}</span>
      </div>

      <RarityStackBar counts={counts} prefersReducedMotion={prefersReducedMotion} className="mt-2" />
    </div>
  );
}
