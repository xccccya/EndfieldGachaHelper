/**
 * 统计页面
 * 支持角色和武器统计，包含四种卡池类型的标签卡切换
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Star,
  Hash,
  AlertCircle,
  Sparkles,
  User,
  Sword,
  ChevronDown,
  Gift,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, RarityBadge } from '../components';
import { useAccounts, useGachaRecordsData } from '../../hooks/useEndfield';
import { charRecordToUnified, weaponRecordToUnified, calculateUnifiedStats, type UnifiedGachaRecord } from '../../lib/storage';
import { formatDateShort, getTimestamp } from '../../lib/dateUtils';
import type { GachaCategory } from '@efgachahelper/shared';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';

/** 卡池类型标签 */
type PoolTab = 'special' | 'weapon' | 'standard' | 'beginner';

/** 卡池标签名称 */
const POOL_TAB_NAMES: Record<PoolTab, string> = {
  special: '限定池',
  weapon: '武器池',
  standard: '常驻池',
  beginner: '新手池',
};

/** 6星进度条段 - 记录抽到6星的过程 */
type PitySegment = {
  pulls: number;          // 抽数
  sixStar?: UnifiedGachaRecord; // 抽到的6星（如果有）
  isFree?: boolean;       // 是否包含免费十连
  freeCount?: number;     // 免费十连抽数
};

/** 分池统计数据 */
type PoolGroupStats = {
  poolId: string;
  poolName: string;
  records: UnifiedGachaRecord[];
  segments: PitySegment[];
  total: number;
  currentPity: number;    // 当前保底（距离上次6星的抽数）
  sixStarCount: number;
  fiveStarCount: number;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedNumber({
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

function RarityDistRow({
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

/**
 * 计算单个池的6星进度条数据
 * 将记录按时间排序，每抽到一个6星为一段
 * 返回的 segments 顺序为：新的在前，旧的在后
 */
function calculatePoolSegments(records: UnifiedGachaRecord[]): PitySegment[] {
  if (records.length === 0) return [];

  // 按时间正序排列（最早的在前）用于计算
  const sorted = [...records].sort((a, b) => 
    getTimestamp(a.gachaTs) - getTimestamp(b.gachaTs)
  );

  const segments: PitySegment[] = [];
  let currentPulls = 0;
  let currentFreeCount = 0;
  let hasFree = false;

  for (const record of sorted) {
    currentPulls++;
    
    // 检查是否是免费十连
    if (record.isFree) {
      hasFree = true;
      currentFreeCount++;
    }

    if (record.rarity === 6) {
      segments.push({
        pulls: currentPulls,
        sixStar: record,
        isFree: hasFree,
        freeCount: currentFreeCount,
      });
      currentPulls = 0;
      currentFreeCount = 0;
      hasFree = false;
    }
  }

  // 如果还有未出6星的抽数，添加一个未完成段
  if (currentPulls > 0) {
    segments.push({
      pulls: currentPulls,
      isFree: hasFree,
      freeCount: currentFreeCount,
    });
  }

  // 反转数组，使新的在前（UI 显示新的在上）
  return segments.reverse();
}

/**
 * 按 poolId 分组统计记录
 */
function groupRecordsByPool(records: UnifiedGachaRecord[]): PoolGroupStats[] {
  const groups: Map<string, UnifiedGachaRecord[]> = new Map();

  for (const record of records) {
    const poolId = record.poolId;
    if (!groups.has(poolId)) {
      groups.set(poolId, []);
    }
    groups.get(poolId)!.push(record);
  }

  const result: PoolGroupStats[] = [];

  for (const [poolId, poolRecords] of groups) {
    const segments = calculatePoolSegments(poolRecords);
    const sixStars = poolRecords.filter(r => r.rarity === 6);
    const fiveStars = poolRecords.filter(r => r.rarity === 5);
    
    // 当前保底：第一段（最新）如果没有6星，就是当前保底数
    const firstSegment = segments[0];
    const currentPity = firstSegment && !firstSegment.sixStar ? firstSegment.pulls : 0;

    result.push({
      poolId,
      poolName: poolRecords[0]?.poolName || poolId,
      records: poolRecords,
      segments,
      total: poolRecords.length,
      currentPity,
      sixStarCount: sixStars.length,
      fiveStarCount: fiveStars.length,
    });
  }

  // 按总抽数排序
  result.sort((a, b) => b.total - a.total);

  return result;
}

/**
 * 进度条组件 - 显示单个6星进度
 */
function PityProgressBar({
  segment,
  maxPulls = 80,
}: {
  segment: PitySegment;
  maxPulls?: number;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const percentage = Math.min((segment.pulls / maxPulls) * 100, 100);
  const hasSixStar = !!segment.sixStar;
  const [animatedPct, setAnimatedPct] = useState(0);
  
  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimatedPct(percentage);
      return;
    }
    // 下一帧触发，确保从 0 → 目标值有过渡
    const id = window.requestAnimationFrame(() => setAnimatedPct(percentage));
    return () => window.cancelAnimationFrame(id);
  }, [percentage, prefersReducedMotion]);
  
  // 根据抽数决定颜色
  const getBarColor = () => {
    if (segment.pulls <= 50) return 'bg-green-500';
    if (segment.pulls <= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* 左侧：6星名称或问号 */}
      <div className="w-24 flex-shrink-0">
        {hasSixStar ? (
          <div className="flex items-center gap-1">
            <span className="text-red-400 font-medium truncate text-sm">
              {segment.sixStar!.itemName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-fg-2">
            <HelpCircle size={14} />
            <span className="text-sm">未出</span>
          </div>
        )}
      </div>
      
      {/* 进度条 */}
      <div className="flex-1 h-4 bg-bg-3 rounded-sm overflow-hidden relative">
        <div
          className={`h-full ${getBarColor()} ef-progress-fill`}
          style={{ width: `${animatedPct}%` }}
        />
      </div>
      
      {/* 抽数 */}
      <div className="w-16 text-right flex-shrink-0">
        <span className={`text-sm font-medium ${hasSixStar ? 'text-red-400' : 'text-fg-1'}`}>
          {segment.pulls} 抽
        </span>
      </div>
      
      {/* 免费标记 */}
      {segment.isFree && segment.freeCount && segment.freeCount > 0 && (
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
            <Gift size={10} />
            {segment.freeCount}免
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 单个池子的展示组件
 */
function PoolGroupCard({ group }: { group: PoolGroupStats }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* 池名称和概要 */}
      <button
        className="w-full px-4 py-3 bg-bg-2 flex items-center justify-between hover:bg-bg-3 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-fg-0">{group.poolName}</span>
          <span className="text-sm text-fg-1">
            共 {group.total} 抽
          </span>
          {group.sixStarCount > 0 && (
            <span className="text-sm text-red-400">
              {group.sixStarCount} 个6星
            </span>
          )}
          {group.currentPity > 0 && (
            <span className="text-sm text-purple-400">
              当前 {group.currentPity} 抽
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-fg-2 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      
      {/* 进度条列表 */}
      <div
        className="ef-collapse"
        data-expanded={expanded ? 'true' : 'false'}
      >
        <div className="ef-collapse__inner px-4 py-2 bg-bg-1 divide-y divide-border/50">
          {group.segments.map((segment, idx) => (
            <PityProgressBar key={idx} segment={segment} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 固定池（常驻/新手）的展示组件
 */
function FixedPoolCard({
  poolName,
  records,
  showTitle = true,
}: {
  poolName: string;
  records: UnifiedGachaRecord[];
  showTitle?: boolean;
}) {
  const segments = calculatePoolSegments(records);
  const sixStarCount = records.filter(r => r.rarity === 6).length;
  // 当前保底：第一段（最新）如果没有6星，就是当前保底数
  const firstSegment = segments[0];
  const currentPity = firstSegment && !firstSegment.sixStar ? firstSegment.pulls : 0;

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-fg-2">
        <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
        <p>暂无抽卡记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showTitle && (
        <div className="text-sm font-medium text-fg-0 px-1">{poolName}</div>
      )}
      {/* 概要信息 */}
      <div className="flex items-center gap-4 px-1 py-2">
        <span className="text-fg-1">
          共 <span className="font-medium text-fg-0">{records.length}</span> 抽
        </span>
        <span className="text-fg-1">
          <span className="font-medium text-red-400">{sixStarCount}</span> 个6星
        </span>
        {currentPity > 0 && (
          <span className="text-fg-1">
            当前 <span className="font-medium text-purple-400">{currentPity}</span> 抽
          </span>
        )}
      </div>
      
      {/* 进度条列表 */}
      <div className="space-y-1">
        {segments.map((segment, idx) => (
          <PityProgressBar key={idx} segment={segment} />
        ))}
      </div>
    </div>
  );
}

export function StatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeUid, activeAccount, loading: accountsLoading } = useAccounts();
  const { gachaRecords, weaponRecords, loading: recordsLoading } = useGachaRecordsData(activeUid);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // 类别筛选
  const [categoryFilter, setCategoryFilter] = useState<GachaCategory | 'all'>('all');
  
  // 卡池标签
  const [activePoolTab, setActivePoolTab] = useState<PoolTab>('special');
  const tabs: readonly PoolTab[] = useMemo(() => ['special', 'weapon', 'standard', 'beginner'] as const, []);
  const prevTabRef = useRef<PoolTab>(activePoolTab);
  const tabDir = useMemo(() => {
    const prevIdx = tabs.indexOf(prevTabRef.current);
    const nextIdx = tabs.indexOf(activePoolTab);
    return nextIdx >= prevIdx ? 1 : -1;
  }, [activePoolTab, tabs]);

  useEffect(() => {
    prevTabRef.current = activePoolTab;
  }, [activePoolTab]);

  // 将记录转换为统一格式
  const allRecords = useMemo(() => {
    const charUnified = gachaRecords.map(charRecordToUnified);
    const weaponUnified = weaponRecords.map(weaponRecordToUnified);
    const all = [...charUnified, ...weaponUnified];
    
    // 按时间排序（最新的在前）
    all.sort((a, b) => {
      const timeA = getTimestamp(a.gachaTs);
      const timeB = getTimestamp(b.gachaTs);
      return timeB - timeA;
    });
    
    return all;
  }, [gachaRecords, weaponRecords]);

  // 根据类别筛选记录
  const records = useMemo(() => {
    if (categoryFilter === 'all') return allRecords;
    return allRecords.filter((r) => r.category === categoryFilter);
  }, [allRecords, categoryFilter]);

  // 计算统计
  const stats = useMemo(() => calculateUnifiedStats(records), [records]);
  
  // 分类别统计
  const charStats = useMemo(() => 
    calculateUnifiedStats(allRecords, { category: 'character' }), 
  [allRecords]);
  
  const weaponStats = useMemo(() => 
    calculateUnifiedStats(allRecords, { category: 'weapon' }), 
  [allRecords]);

  // 按卡池类型分组的记录
  const poolGroupedData = useMemo(() => {
    // 限定池（角色，poolId 不是 standard 或 beginner）
    const specialRecords = allRecords.filter(
      r => r.category === 'character' && 
           r.poolId !== 'standard' && 
           r.poolId !== 'beginner'
    );
    
    // 武器池（所有武器记录，按池分组展示）
    const weaponPoolRecords = allRecords.filter(
      r => r.category === 'weapon'
    );
    
    // 常驻池（角色，poolId === "standard"）
    const standardRecords = allRecords.filter(
      r => r.category === 'character' && r.poolId === 'standard'
    );
    
    // 新手池（角色，poolId === "beginner"）
    const beginnerRecords = allRecords.filter(
      r => r.category === 'character' && r.poolId === 'beginner'
    );

    return {
      special: groupRecordsByPool(specialRecords),
      weapon: groupRecordsByPool(weaponPoolRecords),
      standard: standardRecords,
      beginner: beginnerRecords,
    };
  }, [allRecords]);

  // 最近的6星记录
  const recent6Stars = useMemo(() => {
    return records
      .filter((r) => r.rarity === 6)
      .slice(0, 5);
  }, [records]);

  // 加载状态
  if (accountsLoading || recordsLoading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <Loader2 size={48} className="mx-auto mb-4 text-brand animate-spin" />
            <h3 className="text-lg font-semibold mb-2">{t('common.loading')}</h3>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeAccount) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto mb-4 text-fg-2/50" />
            <h3 className="text-lg font-semibold mb-2">{t('stats.noAccount')}</h3>
            <p className="text-fg-2 mb-4">{t('stats.noAccountHint')}</p>
            <Button variant="accent" onClick={() => { void navigate('/account'); }}>
              {t('stats.goAddAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allRecords.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 size={48} className="mx-auto mb-4 text-fg-2/30" />
            <h3 className="text-lg font-semibold mb-2">{t('stats.noData')}</h3>
            <p className="text-fg-2 mb-4">{t('stats.noDataHint')}</p>
            <Button variant="accent" onClick={() => { void navigate('/sync'); }}>
              {t('stats.goSync')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 计算概率
  const rate6 = stats.total > 0 ? ((stats.byRarity[6] || 0) / stats.total * 100).toFixed(2) : '0';
  const rate5 = stats.total > 0 ? ((stats.byRarity[5] || 0) / stats.total * 100).toFixed(2) : '0';

  // 获取各标签的记录数
  const getTabCount = (tab: PoolTab): number => {
    switch (tab) {
      case 'special':
        return poolGroupedData.special.reduce((sum, g) => sum + g.total, 0);
      case 'weapon':
        return poolGroupedData.weapon.reduce((sum, g) => sum + g.total, 0);
      case 'standard':
        return poolGroupedData.standard.length;
      case 'beginner':
        return poolGroupedData.beginner.length;
    }
  };

  return (
    <div className="space-y-4">
      {/* 筛选 + 概览（合并为一个卡片） */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-3">
            {/* 三段式筛选按钮（全部 / 角色 / 武器） */}
            <div
              className="ef-seg-filter relative grid grid-cols-3 rounded-md p-1 text-sm"
              role="tablist"
              aria-label={t('stats.filterBy')}
            >
              {/* 滑动高亮底座 */}
              <div
                aria-hidden="true"
                className={[
                  'ef-seg-filter__indicator absolute inset-y-1 w-1/3 rounded-md',
                  prefersReducedMotion ? '' : 'transition-transform duration-300 ease-out',
                ].join(' ')}
                style={{
                  transform:
                    categoryFilter === 'all'
                      ? 'translateX(0%)'
                      : categoryFilter === 'character'
                        ? 'translateX(100%)'
                        : 'translateX(200%)',
                }}
              />

              <button
                type="button"
                role="tab"
                aria-selected={categoryFilter === 'all'}
                onClick={() => setCategoryFilter('all')}
                className={[
                  'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5',
                  'transition-all duration-200',
                  categoryFilter === 'all' ? 'text-fg-0 font-semibold' : 'text-fg-1 hover:text-fg-0',
                  prefersReducedMotion ? '' : 'active:scale-[0.98]',
                ].join(' ')}
              >
                <BarChart3 size={16} className={categoryFilter === 'all' ? 'text-brand' : 'text-fg-2'} />
                {t('stats.allCategories')}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={categoryFilter === 'character'}
                onClick={() => setCategoryFilter('character')}
                className={[
                  'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5',
                  'transition-all duration-200',
                  categoryFilter === 'character' ? 'text-fg-0 font-semibold' : 'text-fg-1 hover:text-fg-0',
                  prefersReducedMotion ? '' : 'active:scale-[0.98]',
                ].join(' ')}
              >
                <User size={16} className={categoryFilter === 'character' ? 'text-blue-400' : 'text-fg-2'} />
                {t('stats.characterCategory')}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={categoryFilter === 'weapon'}
                onClick={() => setCategoryFilter('weapon')}
                className={[
                  'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5',
                  'transition-all duration-200',
                  categoryFilter === 'weapon' ? 'text-fg-0 font-semibold' : 'text-fg-1 hover:text-fg-0',
                  prefersReducedMotion ? '' : 'active:scale-[0.98]',
                ].join(' ')}
              >
                <Sword size={16} className={categoryFilter === 'weapon' ? 'text-orange-400' : 'text-fg-2'} />
                {t('stats.weaponCategory')}
              </button>
            </div>

            {/* 分类别统计快速预览 */}
            <div className="flex-1 flex justify-end gap-4 text-sm">
              <span className="flex items-center gap-1 text-blue-400">
                <User size={16} /> {charStats.total} {t('stats.pulls')}
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <Sword size={16} /> {weaponStats.total} {t('stats.pulls')}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Hash size={24} />}
              iconBg="bg-brand/20"
              iconColor="text-brand"
              value={stats.total}
              label={t('stats.totalPulls')}
            />
            <StatCard
              icon={<Star size={24} />}
              iconBg="bg-red-500/20"
              iconColor="text-red-400"
              value={stats.byRarity[6] || 0}
              label={t('stats.total6Star')}
              subValue={`${rate6}%`}
            />
            <StatCard
              icon={<Sparkles size={24} />}
              iconBg="bg-yellow-500/20"
              iconColor="text-yellow-400"
              value={stats.byRarity[5] || 0}
              label={t('stats.total5Star')}
              subValue={`${rate5}%`}
            />
            <StatCard
              icon={<TrendingUp size={24} />}
              iconBg="bg-purple-500/20"
              iconColor="text-purple-400"
              value={stats.pity}
              label={t('stats.currentPity')}
              subValue={t('stats.pityHint')}
            />
          </div>
        </CardContent>
      </Card>

      {/* 卡池统计 - 标签卡切换 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <BarChart3 size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('stats.poolStats')}</h2>
              <p className="text-sm text-fg-1">{t('stats.poolStatsDesc')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 标签栏 */}
          <div className="flex border-b border-border mb-4">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activePoolTab === tab
                    ? 'border-brand text-brand'
                    : 'border-transparent text-fg-1 hover:text-fg-0'
                }`}
                onClick={() => setActivePoolTab(tab)}
              >
                {POOL_TAB_NAMES[tab]}
                <span className="ml-1.5 text-xs text-fg-2">
                  ({getTabCount(tab)})
                </span>
              </button>
            ))}
          </div>

          {/* 标签内容 */}
          <div className="min-h-[200px]">
            {/* 限定池 - 分池展示 */}
            {activePoolTab === 'special' && (
              <div className={`space-y-3 ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                {poolGroupedData.special.length === 0 ? (
                  <div className="text-center py-8 text-fg-2">
                    <User size={32} className="mx-auto mb-2 opacity-30" />
                    <p>暂无限定池抽卡记录</p>
                  </div>
                ) : (
                  poolGroupedData.special.map((group) => (
                    <PoolGroupCard key={group.poolId} group={group} />
                  ))
                )}
              </div>
            )}

            {/* 武器池 - 分池展示 */}
            {activePoolTab === 'weapon' && (
              <div className={`space-y-3 ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                {poolGroupedData.weapon.length === 0 ? (
                  <div className="text-center py-8 text-fg-2">
                    <Sword size={32} className="mx-auto mb-2 opacity-30" />
                    <p>暂无武器池抽卡记录</p>
                  </div>
                ) : (
                  poolGroupedData.weapon.map((group) => (
                    <PoolGroupCard key={group.poolId} group={group} />
                  ))
                )}
              </div>
            )}

            {/* 常驻池 - 直接展示 */}
            {activePoolTab === 'standard' && (
              <div className={`ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                <FixedPoolCard
                poolName="常驻池"
                records={poolGroupedData.standard}
                  showTitle={false}
              />
              </div>
            )}

            {/* 新手池 - 直接展示 */}
            {activePoolTab === 'beginner' && (
              <div className={`ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                <FixedPoolCard
                poolName="新手池"
                records={poolGroupedData.beginner}
                  showTitle={false}
              />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最近6星和稀有度分布 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 最近6星 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Star size={20} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.recent6Star')}</h2>
                <p className="text-sm text-fg-1">{t('stats.recent6StarDesc')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recent6Stars.length === 0 ? (
              <div className="text-center py-8 text-fg-2">
                <Star size={32} className="mx-auto mb-2 opacity-30" />
                <p>{t('stats.no6Star')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recent6Stars.map((record) => (
                  <div key={record.recordUid} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm">
                      {record.category === 'weapon' ? (
                        <Sword size={18} />
                      ) : (
                        record.itemName.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-red-400 truncate flex items-center gap-1">
                        {record.category === 'weapon' && <Sword size={14} className="text-fg-1/60" />}
                        {record.category === 'character' && <User size={14} className="text-fg-1/60" />}
                        {record.itemName}
                        {record.isFree && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs bg-green-500/20 text-green-400 ml-1">
                            <Gift size={10} />
                            免费
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-fg-1 truncate">
                        {record.poolName}
                      </div>
                    </div>
                    <div className="text-xs text-fg-1 text-right">
                      {formatDateShort(record.gachaTs)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 稀有度分布 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.rarityDist')}</h2>
                <p className="text-sm text-fg-1">{t('stats.rarityDistDesc')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const distTotal = stats.total - (stats.byRarity[3] || 0);
                return [6, 5, 4].map((rarity) => {
                  const count = stats.byRarity[rarity] || 0;
                  const percentage = distTotal > 0 ? (count / distTotal * 100) : 0;
                  const colors: Record<number, { bar: string; text: string }> = {
                    6: { bar: 'bg-red-500', text: 'text-red-400' },
                    5: { bar: 'bg-yellow-500', text: 'text-yellow-400' },
                    4: { bar: 'bg-purple-500', text: 'text-purple-400' },
                  };

                  const colorConfig = colors[rarity] ?? { bar: 'bg-gray-500', text: 'text-gray-400' };

                  return (
                    <RarityDistRow
                      key={rarity}
                      rarity={rarity}
                      count={count}
                      percentage={percentage}
                      barClassName={colorConfig.bar}
                      textClassName={colorConfig.text}
                      unitsLabel={t('stats.units')}
                    />
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
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

export default StatsPage;
