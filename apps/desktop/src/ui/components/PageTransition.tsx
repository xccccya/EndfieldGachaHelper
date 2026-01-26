import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';

type PageTransitionVariant = 'fade-slide' | 'fade-scale' | 'fade-blur';
type Phase = 'idle' | 'exit' | 'enter';

const VARIANTS: readonly PageTransitionVariant[] = ['fade-slide', 'fade-scale', 'fade-blur'] as const;
const EXIT_MS = 160;
const ENTER_MS = 240;

function pickRandomVariant(prev?: PageTransitionVariant): PageTransitionVariant {
  if (VARIANTS.length <= 1) return VARIANTS[0]!;
  let next = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]!;
  // 尽量避免连续两次相同动效
  if (prev && next === prev) {
    next = VARIANTS[(VARIANTS.indexOf(prev) + 1) % VARIANTS.length]!;
  }
  return next;
}

export function PageTransition({
  children,
  locationKey,
  className,
}: {
  children: React.ReactNode;
  locationKey: string;
  className?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [variant, setVariant] = useState<PageTransitionVariant>(() => pickRandomVariant());
  const [displayChildren, setDisplayChildren] = useState<React.ReactNode>(children);

  // 记录“已完成切换/已提交展示”的 locationKey。
  // 注意：在 React.StrictMode 的开发环境下，effect 可能被执行/清理两次；
  // 如果这里在动画开始时就更新 key，会导致第二次 effect 直接 return，从而把 phase 卡在 exit/enter。
  const lastLocationKeyRef = useRef(locationKey);
  const transitionIdRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    // 初次渲染：确保与 children 同步
    setDisplayChildren(children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 同一路由下：保持内容同步（避免 outlet/子树更新时 displayChildren 停留在旧值）
    if (lastLocationKeyRef.current === locationKey) {
      setDisplayChildren(children);
      return;
    }

    clearTimers();
    transitionIdRef.current += 1;
    const transitionId = transitionIdRef.current;

    if (prefersReducedMotion) {
      setPhase('idle');
      setDisplayChildren(children);
      lastLocationKeyRef.current = locationKey;
      return;
    }

    setVariant((prev) => pickRandomVariant(prev));
    setPhase('exit');

    const exitTimer = window.setTimeout(() => {
      if (transitionIdRef.current !== transitionId) return;
      setDisplayChildren(children);
      setPhase('enter');

      const enterTimer = window.setTimeout(() => {
        if (transitionIdRef.current !== transitionId) return;
        setPhase('idle');
        lastLocationKeyRef.current = locationKey;
      }, ENTER_MS);

      timeoutsRef.current.push(enterTimer);
    }, EXIT_MS);

    timeoutsRef.current.push(exitTimer);

    return () => {
      clearTimers();
    };
  }, [children, locationKey, prefersReducedMotion]);

  const classes = useMemo(() => {
    const base = ['ef-page-transition', className].filter(Boolean).join(' ');
    if (phase === 'idle') return base;
    return `${base} ef-page-transition--${phase} ef-page-transition--${variant}`;
  }, [className, phase, variant]);

  return <div className={classes}>{displayChildren}</div>;
}

