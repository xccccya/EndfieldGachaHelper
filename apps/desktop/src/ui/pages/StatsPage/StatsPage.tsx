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
  Gift,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, CharacterAvatar, WeaponAvatar, HelpTooltip } from '../../components';
import { useAccounts, useGachaRecordsData } from '../../../hooks/useEndfield';
import { charRecordToUnified, weaponRecordToUnified, calculateUnifiedStats, getPoolTypePrefix, type UnifiedGachaRecord } from '../../../lib/storage';
import { formatDateShort, getTimestamp } from '../../../lib/dateUtils';
import type { GachaCategory } from '@efgachahelper/shared';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import {
  loadPoolConfig,
  isUpCharacter,
  calculateSharedPityStatus,
  aggregateWeaponRecordsToSessions,
  calculateWeaponPoolStatus,
  sortRecordsByTimeAndSeq,
} from '../../../lib/poolUtils';

// 导入类型
import type { PoolTab, PoolGroupedData, WeaponPoolGroupStats, PoolSummaries } from './types';
import { POOL_TAB_LABEL_KEYS } from './types';

// 导入工具函数
import { getRarityCounts, formatMaybeNumber, groupRecordsByPool } from './utils';

// 导入池卡片组件
import {
  FiveStarSwitch,
  SharedSpecialPityCard,
  WeaponPoolCard,
  PoolGroupCard,
  FixedPoolCard,
} from './PoolCards';

// 导入统计组件
import { StatCard, RarityDistRow, PoolSummaryTile } from './StatComponents';

/** 每抽消耗常量 */
const CRYSTAL_PER_CHARACTER_PULL = 500;
const ARMORY_QUOTA_PER_WEAPON_SESSION = 1980;

export function StatsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { activeUid, activeAccount, loading: accountsLoading } = useAccounts();
  const { gachaRecords, weaponRecords, loading: recordsLoading } = useGachaRecordsData(activeUid);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // 类别筛选
  const [categoryFilter, setCategoryFilter] = useState<GachaCategory | 'all'>('all');
  
  // 卡池标签
  const [activePoolTab, setActivePoolTab] = useState<PoolTab>('special');
  const [showFiveStars, setShowFiveStars] = useState(false);
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
    
    // 按时间和 seqId 排序（最新的在前）
    all.sort((a, b) => {
      const timeA = getTimestamp(a.gachaTs);
      const timeB = getTimestamp(b.gachaTs);
      if (timeA !== timeB) return timeB - timeA;
      
      const seqA = Number(a.seqId);
      const seqB = Number(b.seqId);
      if (Number.isFinite(seqA) && Number.isFinite(seqB)) {
        return seqB - seqA;
      }
      return 0;
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
  
  // 顶部面板：累计消耗
  const characterCrystalConsumedAll = useMemo(() => {
    const nonFreeCharPulls = allRecords.filter((r) => r.category === 'character' && !r.isFree).length;
    return nonFreeCharPulls * CRYSTAL_PER_CHARACTER_PULL;
  }, [allRecords]);

  const weaponSessionsAll = useMemo(() => {
    const weaponRecs = allRecords.filter((r) => r.category === 'weapon' && !r.isFree);
    const groups: Map<string, UnifiedGachaRecord[]> = new Map();
    for (const r of weaponRecs) {
      if (!groups.has(r.poolId)) groups.set(r.poolId, []);
      groups.get(r.poolId)!.push(r);
    }
    let totalSessions = 0;
    for (const [, poolRecords] of groups) {
      totalSessions += aggregateWeaponRecordsToSessions(poolRecords, null).length;
    }
    return totalSessions;
  }, [allRecords]);

  const weaponQuotaConsumedAll = useMemo(() => weaponSessionsAll * ARMORY_QUOTA_PER_WEAPON_SESSION, [weaponSessionsAll]);

  // 特许寻访共享保底
  const specialSharedPityStatus = useMemo(() => {
    const sharedRecords = allRecords.filter(
      (r) =>
        r.category === 'character' &&
        getPoolTypePrefix(r.poolId) === 'special' &&
        !r.isFree
    );
    return calculateSharedPityStatus(sharedRecords);
  }, [allRecords]);

  // 按卡池类型分组的记录（异步加载）
  const [poolGroupedData, setPoolGroupedData] = useState<PoolGroupedData>({
    special: [],
    weapon: [],
    standard: [],
    beginner: [],
  });
  
  useEffect(() => {
    const loadPoolData = async () => {
      // 限定池（角色，poolId 前缀 special_*）
      const specialRecords = allRecords.filter(
        r => r.category === 'character' && 
             getPoolTypePrefix(r.poolId) === 'special'
      );
      
      // 武器池
      const weaponPoolRecords = allRecords.filter(
        r => r.category === 'weapon'
      );
      
      // 常驻池
      const standardRecords = allRecords.filter(
        r => r.category === 'character' && getPoolTypePrefix(r.poolId) === 'standard'
      );
      
      // 新手池
      const beginnerRecords = allRecords.filter(
        r => r.category === 'character' && getPoolTypePrefix(r.poolId) === 'beginner'
      );

      const special = await groupRecordsByPool(specialRecords);
      
      // 武器池分组
      const weaponGroups: Map<string, UnifiedGachaRecord[]> = new Map();
      for (const record of weaponPoolRecords) {
        const poolId = record.poolId;
        if (!weaponGroups.has(poolId)) {
          weaponGroups.set(poolId, []);
        }
        weaponGroups.get(poolId)!.push(record);
      }
      
      const weapon: WeaponPoolGroupStats[] = [];
      for (const [poolId, poolRecords] of weaponGroups) {
        const poolConfig = await loadPoolConfig(poolId);
        const sessions = aggregateWeaponRecordsToSessions(poolRecords, poolConfig);
        const status = calculateWeaponPoolStatus(sessions, poolConfig);

        weapon.push({
          poolId,
          poolName: poolRecords[0]?.poolName || poolId,
          poolConfig,
          itemCount: poolRecords.length,
          sessions,
          status,
        });
      }
      
      weapon.sort((a, b) => b.status.totalSessions - a.status.totalSessions);
      
      setPoolGroupedData({
        special,
        weapon,
        standard: standardRecords,
        beginner: beginnerRecords,
      });
    };
    
    void loadPoolData();
  }, [allRecords]);

  // 最近的6星记录
  const recent6Stars = useMemo(() => {
    return records
      .filter((r) => r.rarity === 6)
      .slice(0, 5);
  }, [records]);

  // 顶部：限定/武器/常驻三列汇总
  const poolSummaries: PoolSummaries = useMemo(() => {
    const specialPoolConfigs = new Map<string, ReturnType<typeof loadPoolConfig> extends Promise<infer T> ? T : never>();
    for (const g of poolGroupedData.special) {
      specialPoolConfigs.set(g.poolId, g.poolConfig);
    }

    const specialRecordsAll = allRecords.filter(
      (r) => r.category === 'character' && getPoolTypePrefix(r.poolId) === 'special'
    );
    const weaponRecordsAll = allRecords.filter((r) => r.category === 'weapon');
    const standardRecordsAll = allRecords.filter(
      (r) => r.category === 'character' && getPoolTypePrefix(r.poolId) === 'standard'
    );

    const specialCounts = getRarityCounts(specialRecordsAll);
    const weaponCounts = getRarityCounts(weaponRecordsAll);
    const standardCounts = getRarityCounts(standardRecordsAll);

    const specialSix = specialCounts[6];
    const weaponSix = weaponCounts[6];
    const standardSix = standardCounts[6];

    const computeSpecialUpOff = () => {
      let up = 0;
      let off = 0;
      for (const r of specialRecordsAll) {
        if (r.rarity !== 6) continue;
        const cfg = specialPoolConfigs.get(r.poolId) ?? null;
        const isUp = cfg ? isUpCharacter(r.itemName, cfg) : false;
        if (isUp) up += 1;
        else off += 1;
      }
      return { up, off };
    };

    const computeSpecialUpAvg = () => {
      const sorted = sortRecordsByTimeAndSeq(specialRecordsAll);
      let pulls = 0;
      const segments: number[] = [];
      for (const r of sorted) {
        if (r.isFree) continue;
        pulls += 1;
        if (r.rarity === 6) {
          const cfg = specialPoolConfigs.get(r.poolId) ?? null;
          const isUp = cfg ? isUpCharacter(r.itemName, cfg) : false;
          if (isUp) {
            segments.push(pulls);
            pulls = 0;
          }
        }
      }
      if (segments.length === 0) return null;
      return segments.reduce((a, b) => a + b, 0) / segments.length;
    };

    const computeWeaponUpOff = () => {
      let up = 0;
      let off = 0;
      for (const g of poolGroupedData.weapon) {
        const upName = g.poolConfig?.pool?.up6_name;
        for (const s of g.sessions) {
          for (const r of s.sixStars) {
            if (upName && r.itemName === upName) up += 1;
            else off += 1;
          }
        }
      }
      return { up, off };
    };

    const computeWeaponUpAvg = () => {
      const segments: number[] = [];
      for (const g of poolGroupedData.weapon) {
        const upName = g.poolConfig?.pool?.up6_name;
        if (!upName) continue;
        let pulls = 0;
        for (const s of g.sessions) {
          for (const r of s.records) {
            if (r.isFree) continue;
            pulls += 1;
            if (r.rarity === 6 && r.itemName === upName) {
              segments.push(pulls);
              pulls = 0;
            }
          }
        }
      }
      if (segments.length === 0) return null;
      return segments.reduce((a, b) => a + b, 0) / segments.length;
    };

    const { up: specialUp, off: specialOff } = computeSpecialUpOff();
    const { up: weaponUp, off: weaponOff } = computeWeaponUpOff();

    const specialUpAvg = computeSpecialUpAvg();
    const weaponUpAvg = computeWeaponUpAvg();
    const standardSixAvg = standardSix > 0 ? standardRecordsAll.length / standardSix : null;

    return {
      special: {
        total: specialRecordsAll.length,
        six: specialSix,
        up: specialUp,
        off: specialOff,
        upAvg: specialUpAvg,
        counts: specialCounts,
      },
      weapon: {
        total: weaponRecordsAll.length,
        six: weaponSix,
        up: weaponUp,
        off: weaponOff,
        upAvg: weaponUpAvg,
        counts: weaponCounts,
      },
      standard: {
        total: standardRecordsAll.length,
        six: standardSix,
        sixAvg: standardSixAvg,
        counts: standardCounts,
      },
    };
  }, [allRecords, poolGroupedData.special, poolGroupedData.weapon]);

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
        return poolGroupedData.weapon.reduce((sum, g) => sum + g.status.totalSessions, 0);
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
                <Sword size={16} className={categoryFilter === 'weapon' ? 'text-amber-500' : 'text-fg-2'} />
                {t('stats.weaponCategory')}
              </button>
            </div>

            {/* 分类别统计快速预览 */}
            <div className="flex-1 flex justify-end gap-3 text-sm items-center">
              <span className="text-fg-2">{t('stats.ui.cumulativeConsume')}</span>
              {(categoryFilter === 'all' || categoryFilter === 'character') && (
                <span className="flex items-center gap-1.5 text-fg-1 tabular-nums">
                  <img
                    src="/efimg/gameEntryId=926.png"
                    alt={t('stats.ui.originium')}
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {characterCrystalConsumedAll.toLocaleString(i18n.language)}
                  <HelpTooltip text={t('stats.ui.calcMayDifferHint')} />
                </span>
              )}
              {(categoryFilter === 'all' || categoryFilter === 'weapon') && (
                <span className="flex items-center gap-1.5 text-fg-1 tabular-nums">
                  <img
                    src="/efimg/gameEntryId=930.png"
                    alt={t('stats.ui.armoryQuota')}
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {weaponQuotaConsumedAll.toLocaleString(i18n.language)}
                  <HelpTooltip text={t('stats.ui.calcMayDifferHint')} />
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              icon={<Hash size={24} />}
              iconBg="bg-brand/20"
              iconColor="text-brand"
              value={stats.total}
              label={t('stats.totalPulls')}
            />
            <StatCard
              icon={<Star size={24} />}
              iconBg="bg-orange-500/20"
              iconColor="text-orange-500"
              value={stats.byRarity[6] || 0}
              label={t('stats.total6Star')}
              subValue={`${rate6}%`}
            />
            <StatCard
              icon={<Sparkles size={24} />}
              iconBg="bg-amber-500/20"
              iconColor="text-amber-400"
              value={stats.byRarity[5] || 0}
              label={t('stats.total5Star')}
              subValue={`${rate5}%`}
            />
          </div>

          {/* 限定/武器/常驻累计抽数与关键指标 */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <PoolSummaryTile
              title={t('stats.ui.poolTabs.special')}
              subtitle={t('stats.ui.poolSummary.subtitle', { count: poolSummaries.special.total })}
              metricLeft={t('stats.ui.poolSummary.metricSpecialLeft', { six: poolSummaries.special.six, off: poolSummaries.special.off })}
              metricRight={t('stats.ui.poolSummary.metricSpecialRight', { avg: formatMaybeNumber(poolSummaries.special.upAvg) })}
              counts={{ 6: poolSummaries.special.counts[6], 5: poolSummaries.special.counts[5], 4: poolSummaries.special.counts[4] }}
              prefersReducedMotion={prefersReducedMotion}
              accentClassName="text-purple-400"
            />

            <PoolSummaryTile
              title={t('stats.ui.poolTabs.weapon')}
              subtitle={t('stats.ui.poolSummary.subtitle', { count: poolSummaries.weapon.total })}
              metricLeft={t('stats.ui.poolSummary.metricWeaponLeft', { six: poolSummaries.weapon.six, off: poolSummaries.weapon.off })}
              metricRight={t('stats.ui.poolSummary.metricWeaponRight', { avg: formatMaybeNumber(poolSummaries.weapon.upAvg) })}
              counts={{ 6: poolSummaries.weapon.counts[6], 5: poolSummaries.weapon.counts[5], 4: poolSummaries.weapon.counts[4] }}
              prefersReducedMotion={prefersReducedMotion}
              accentClassName="text-amber-500"
            />

            <PoolSummaryTile
              title={t('stats.ui.poolTabs.standard')}
              subtitle={t('stats.ui.poolSummary.subtitle', { count: poolSummaries.standard.total })}
              metricLeft={t('stats.ui.poolSummary.metricStandardLeft', { six: poolSummaries.standard.six })}
              metricRight={t('stats.ui.poolSummary.metricStandardRight', { avg: formatMaybeNumber(poolSummaries.standard.sixAvg) })}
              counts={{ 6: poolSummaries.standard.counts[6], 5: poolSummaries.standard.counts[5], 4: poolSummaries.standard.counts[4] }}
              prefersReducedMotion={prefersReducedMotion}
              accentClassName="text-blue-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* 卡池统计 - 标签卡切换 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <BarChart3 size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.poolStats')}</h2>
                <p className="text-sm text-fg-1">{t('stats.poolStatsDesc')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <FiveStarSwitch value={showFiveStars} onToggle={() => setShowFiveStars((v) => !v)} />
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
                {t(POOL_TAB_LABEL_KEYS[tab])}
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
                    <p>{t('stats.ui.poolEmpty.special')}</p>
                  </div>
                ) : (
                  <>
                    <SharedSpecialPityCard pityStatus={specialSharedPityStatus} />
                    {poolGroupedData.special.map((group) => (
                      <PoolGroupCard key={group.poolId} group={group} showFiveStars={showFiveStars} />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* 武器池 - 分池展示 */}
            {activePoolTab === 'weapon' && (
              <div className={`space-y-3 ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                {poolGroupedData.weapon.length === 0 ? (
                  <div className="text-center py-8 text-fg-2">
                    <Sword size={32} className="mx-auto mb-2 opacity-30" />
                    <p>{t('stats.ui.poolEmpty.weapon')}</p>
                  </div>
                ) : (
                  poolGroupedData.weapon.map((group) => (
                    <WeaponPoolCard key={group.poolId} group={group} showFiveStars={showFiveStars} />
                  ))
                )}
              </div>
            )}

            {/* 常驻池 - 直接展示 */}
            {activePoolTab === 'standard' && (
              <div className={`ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                <FixedPoolCard
                  poolName={t('stats.ui.poolTabs.standard')}
                  records={poolGroupedData.standard}
                  showFiveStars={showFiveStars}
                  showTitle={false}
                  isStandardPool={true}
                />
              </div>
            )}

            {/* 新手池 - 直接展示 */}
            {activePoolTab === 'beginner' && (
              <div className={`ef-tab-panel ${tabDir > 0 ? 'ef-tab-panel--from-right' : 'ef-tab-panel--from-left'}`}>
                <FixedPoolCard
                  poolName={t('stats.ui.poolTabs.beginner')}
                  records={poolGroupedData.beginner}
                  showFiveStars={showFiveStars}
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
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Star size={20} className="text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.recent6Star')}</h2>
                <p className="text-sm text-fg-1">
                  {categoryFilter === 'character'
                    ? t('stats.recent6StarDescChar')
                    : categoryFilter === 'weapon'
                      ? t('stats.recent6StarDescWeapon')
                      : t('stats.recent6StarDesc')}
                </p>
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
                    <div className="w-10 h-10 flex items-center justify-center">
                      {record.category === 'weapon' ? (
                        <WeaponAvatar weaponId={record.weaponId} rarity={6} size="md" />
                      ) : (
                        <CharacterAvatar charId={record.charId} rarity={6} size="md" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-orange-500 truncate flex items-center gap-1">
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
                <TrendingUp size={20} className="text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('stats.rarityDist')}</h2>
                <p className="text-sm text-fg-1">
                  {categoryFilter === 'character'
                    ? t('stats.rarityDistDescChar')
                    : categoryFilter === 'weapon'
                      ? t('stats.rarityDistDescWeapon')
                      : t('stats.rarityDistDesc')}
                </p>
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
                    6: { bar: 'bg-orange-500', text: 'text-orange-500' },
                    5: { bar: 'bg-amber-500', text: 'text-amber-400' },
                    4: { bar: 'bg-purple-500', text: 'text-purple-500' },
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

export default StatsPage;
