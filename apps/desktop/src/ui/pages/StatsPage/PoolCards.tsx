/**
 * StatsPage 池卡片相关组件
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  Star,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Gift,
  Loader2,
} from 'lucide-react';
import { CharacterAvatar, WeaponAvatar, PityStatusPanel, HelpTooltip } from '../../components';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import {
  getCharacterId,
  sortRecordsByTimeAndSeq,
  calculateArmoryQuota,
  formatArmoryQuota,
  type PoolConfig,
  type PityStatus,
  type FreeSegmentStats,
} from '../../../lib/poolUtils';
import type { UnifiedGachaRecord } from '../../../lib/storage';
import type { PitySegment, PoolGroupStats, WeaponPoolGroupStats, SpecialMilestones } from './types';
import { groupById, resolveWeaponId, calculatePoolSegments } from './utils';

/** 计数徽章 */
export function CountBadge({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= 1) return null;
  const label = count >= 100 ? '99+' : String(count);
  return (
    <span
      className="absolute -top-1 -right-1 px-1.5 h-[16px] rounded-[6px] bg-amber-500 text-black text-[11px] font-extrabold leading-[16px] shadow-md"
      aria-label={t('stats.ui.countTimes', { count })}
      title={t('stats.ui.countTimes', { count })}
    >
      {label}
    </span>
  );
}

/** 五星展示开关 */
export function FiveStarSwitch({
  value,
  onToggle,
  className,
}: {
  value: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const isOn = value;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOn}
      title={isOn ? t('stats.ui.fiveStarSwitchOnTitle') : t('stats.ui.fiveStarSwitchOffTitle')}
      className={`
        group inline-flex items-center gap-2
        rounded-full
        px-2.5 py-1.5
        backdrop-blur-sm
        transition-all duration-200
        hover:shadow-lg hover:scale-[1.01]
        focus:outline-none focus:ring-2
        active:scale-[0.98]
        ${
          isOn
            ? 'bg-amber-500/20 hover:bg-amber-500/30 border-[1.5px] border-amber-500/45 hover:border-amber-500/65 focus:ring-amber-500/50 shadow-md shadow-amber-500/15'
            : 'bg-bg-2/70 hover:bg-bg-2/90 border-[1.5px] border-border/70 hover:border-border focus:ring-border/60 shadow-md shadow-black/10'
        }
        ${className ?? ''}
      `}
    >
      <Sparkles
        size={14}
        className={`
          shrink-0 transition-all duration-200 group-hover:scale-110
          ${isOn ? 'text-amber-400' : 'text-fg-2'}
        `}
      />

      <span
        className={`
          text-xs font-bold whitespace-nowrap select-none
          transition-colors duration-200
          ${isOn ? 'text-amber-400' : 'text-fg-1'}
        `}
      >
        {t('stats.ui.fiveStarSwitch')}
      </span>

      <span
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full
          shadow-inner
          transition-colors duration-250 ease-out
          ${isOn ? 'bg-amber-500/35' : 'bg-bg-3/60'}
        `}
      >
        <span
          className={`
            pointer-events-none absolute inset-0 rounded-full
            bg-gradient-to-b from-white/25 to-transparent
            opacity-80 group-hover:opacity-100
            transition-opacity duration-200
          `}
        />
        <span
          className={`
            absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow-lg
            transition-all duration-250 ease-out
            group-active:scale-95
            ${isOn ? 'translate-x-4 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]' : 'translate-x-0 bg-fg-2/70'}
          `}
        />
      </span>
    </button>
  );
}

/** 共享保底卡片 */
export function SharedSpecialPityCard({ pityStatus }: { pityStatus: PityStatus }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const panelId = 'shared-special-pity-panel';

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 bg-bg-2/80 backdrop-blur-sm flex items-center justify-between hover:bg-bg-3/90 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-fg-0">{t('stats.ui.sharedPityTitle')}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-purple-500">
            {t('stats.ui.currentPityLabel', { count: pityStatus.pityTo6Star })}
          </span>
          <ChevronDown
            size={16}
            className={`text-fg-2 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <div
        id={panelId}
        className="ef-collapse relative"
        data-expanded={expanded ? 'true' : 'false'}
      >
        <div className="ef-collapse__inner">
          <div className="px-4 py-3 bg-bg-1/60">
            <PityStatusPanel pityStatus={pityStatus} isSpecialPool={false} borderless />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 武器池卡片 */
export function WeaponPoolCard({ group, showFiveStars }: { group: WeaponPoolGroupStats; showFiveStars: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [imgError, setImgError] = useState(false);
  const panelId = `weapon-pool-${group.poolId}`;

  const bgImagePath = `/content/${group.poolId}/up6_image.png`;
  const showBgImage = !imgError;

  const { status } = group;
  const upName = group.poolConfig?.pool?.up6_name;
  
  // 获取 UP 武器的 ID（用于标题头像）
  const upWeaponId = useMemo(() => {
    if (!group.poolConfig || !upName) return undefined;
    const weapon = group.poolConfig.pool.all.find(w => w.name === upName);
    return weapon?.id;
  }, [group.poolConfig, upName]);
  const boxName = group.poolConfig?.pool?.gift_weapon_box_name || t('stats.ui.weaponPool.fallbackBox');
  const giftName = group.poolConfig?.pool?.gift_weapon_reward_name || t('stats.ui.weaponPool.fallbackGift');

  // 所有申领记录（倒序，最新的在前）
  const allSessions = [...group.sessions].reverse();

  const nextRewardText = status.nextCumulativeReward
    ? t('stats.ui.weaponPool.nextRewardText', {
        reward: status.nextCumulativeReward.type === 'box' ? boxName : giftName,
        remaining: t('stats.ui.weaponPool.remainingSessions', { count: status.nextCumulativeReward.remainingSessions }),
        session: t('stats.ui.weaponPool.sessionNo', { no: status.nextCumulativeReward.atSessionNo }),
      })
    : t('stats.ui.weaponPool.none');

  // 武器池保底进度条动画
  const prefersReducedMotion = usePrefersReducedMotion();
  const pct6Star = Math.min((status.sessionsSinceLastSixStar / 4) * 100, 100);
  const pctUp = status.hasUp6 ? 100 : Math.min(((8 - status.sessionsToUp6HardPity) / 8) * 100, 100);
  
  const [animated6Star, setAnimated6Star] = useState(0);
  const [animatedUp, setAnimatedUp] = useState(0);
  
  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimated6Star(pct6Star);
      setAnimatedUp(pctUp);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setAnimated6Star(pct6Star);
      setAnimatedUp(pctUp);
    });
    return () => window.cancelAnimationFrame(id);
  }, [pct6Star, pctUp, prefersReducedMotion]);

  return (
    <div className="border border-border rounded-md overflow-hidden relative group">
      {/* 背景图片层 */}
      {showBgImage && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none overflow-hidden">
            <img
              src={bgImagePath}
              alt=""
              className="w-full h-auto object-contain"
              style={{
                objectPosition: 'center top',
                opacity: 0.4,
                minHeight: '120px',
              }}
              onError={() => setImgError(true)}
            />
          </div>
          {/* 遮罩层 */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none bg-bg-2/0 backdrop-blur-sm transition-colors group-hover:bg-bg-3/0"
          />
        </>
      )}

      <button
        className={[
          'relative w-full px-4 py-3 flex items-start justify-between transition-all duration-300',
          showBgImage ? 'bg-transparent' : 'bg-bg-2/80 backdrop-blur-sm hover:bg-bg-3/90',
          // 展开时扩展到背景图高度，折叠时保持紧凑
          showBgImage && expanded ? 'min-h-[120px] items-center' : 'items-center',
        ].join(' ')}
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        {/* 展开状态：纵向布局，文字更大 */}
        {showBgImage && expanded ? (
          <div className="flex flex-col justify-center gap-2 py-1">
            {/* 卡池名 - 展开时更大更醒目 */}
            <div className="flex items-center gap-2.5">
              <WeaponAvatar 
                weaponId={upWeaponId} 
                rarity={6} 
                size="md" 
                isUp 
                className="drop-shadow-lg"
              />
              <span className="text-lg font-semibold text-fg-0 drop-shadow-md">
                {group.poolName}
              </span>
            </div>
            {/* 统计数据行 - 展开时字体稍大 */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-base text-fg-1 drop-shadow-sm font-medium">
                {t('stats.ui.weaponPool.totalSessions', { count: status.totalSessions })}
              </span>
              {status.sixStarCount > 0 && (
                <span className="text-base text-orange-500 drop-shadow-sm font-medium">
                  {t('stats.ui.poolSummary.sixStarLabel', { count: status.sixStarCount })}
                </span>
              )}
              {showFiveStars && (() => {
                const fiveStarCount = group.sessions.reduce((sum, s) => sum + s.records.filter(r => r.rarity === 5).length, 0);
                return fiveStarCount > 0 ? (
                  <span className="text-base text-amber-400 drop-shadow-sm font-medium">
                    {t('stats.ui.poolSummary.fiveStarLabel', { count: fiveStarCount })}
                  </span>
                ) : null;
              })()}
              {/* 歪的数量 */}
              {(() => {
                const offBannerCount = status.sixStarCount - status.up6Count;
                return offBannerCount > 0 ? (
                  <span className="text-base text-red-400 drop-shadow-sm font-medium">
                    {t('stats.ui.poolSummary.offBannerLabel', { count: offBannerCount })}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        ) : (
          /* 折叠状态：保持原有的横向紧凑布局 */
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-fg-0 drop-shadow-sm flex items-center gap-2">
              <WeaponAvatar 
                weaponId={upWeaponId} 
                rarity={6} 
                size="sm" 
                isUp 
                className="drop-shadow-md"
              />
              {group.poolName}
            </span>
            <span className="text-sm text-fg-1 drop-shadow-sm">
              {t('stats.ui.weaponPool.totalSessions', { count: status.totalSessions })}
            </span>
            {status.sixStarCount > 0 && (
              <span className="text-sm text-orange-500 drop-shadow-sm">
                {t('stats.ui.poolSummary.sixStarLabel', { count: status.sixStarCount })}
              </span>
            )}
            {showFiveStars && (() => {
              const fiveStarCount = group.sessions.reduce((sum, s) => sum + s.records.filter(r => r.rarity === 5).length, 0);
              return fiveStarCount > 0 ? (
                <span className="text-sm text-amber-400 drop-shadow-sm">
                  {t('stats.ui.poolSummary.fiveStarLabel', { count: fiveStarCount })}
                </span>
              ) : null;
            })()}
            {/* 歪的数量 */}
            {(() => {
              const offBannerCount = status.sixStarCount - status.up6Count;
              return offBannerCount > 0 ? (
                <span className="text-sm text-red-400 drop-shadow-sm">
                  {t('stats.ui.poolSummary.offBannerLabel', { count: offBannerCount })}
                </span>
              ) : null;
            })()}
          </div>
        )}
        <ChevronDown
          size={expanded && showBgImage ? 18 : 16}
          className={`text-fg-2 transition-transform drop-shadow-sm flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={panelId}
        className="ef-collapse"
        data-expanded={expanded ? 'true' : 'false'}
      >
        <div className="ef-collapse__inner">
          {/* 分割线：图片和内容之间的美观分隔 */}
          <div 
            className="ef-pool-card-divider mx-4"
            aria-hidden="true"
          />
          
          {/* 内容区域 */}
          <div className="px-4 pt-4 pb-3 space-y-3 bg-bg-1/95 ef-pool-card-content">
            {/* 申领记录 */}
            <div className="space-y-1 divide-y divide-border/30">
              {allSessions.length === 0 ? (
                <div className="text-fg-2 text-sm py-2">{t('stats.ui.weaponPool.noRecords')}</div>
              ) : (
                allSessions.map((s) => {
                  const rewardLabel = s.cumulativeReward
                    ? (s.cumulativeReward === 'box' ? boxName : giftName)
                    : undefined;
                  const sixStarWeapons = s.sixStars.map((r) => ({
                    id: resolveWeaponId(r, group.poolConfig),
                    name: r.itemName,
                    isUp: upName ? r.itemName === upName : false,
                  }));
                  const hasSixStar = s.sixStars.length > 0;
                  const fiveStarWeapons = showFiveStars
                    ? s.records
                        .filter((r) => r.rarity === 5)
                        .map((r) => ({
                          id: resolveWeaponId(r, group.poolConfig),
                          name: r.itemName,
                          isUp: false,
                        }))
                    : [];
                  const countedFiveStarWeapons = showFiveStars ? groupById(fiveStarWeapons) : [];
                  
                  return (
                    <div key={`${group.poolId}_${s.sessionNo}_${s.gachaTs}`} className="py-1.5">
                      <div className="flex items-center gap-3">
                        {/* 左侧：武器头像区域 */}
                        <div className="flex items-center gap-2 w-36 flex-shrink-0">
                          {hasSixStar ? (
                            <>
                              <div className="flex items-center gap-1">
                                {sixStarWeapons.map((w, idx) => (
                                  <span key={`${w.id ?? w.name}_${idx}`} className="relative inline-flex">
                                    <WeaponAvatar 
                                      weaponId={w.id} 
                                      rarity={6} 
                                      size="md" 
                                      isUp={w.isUp}
                                      showOffBanner={!w.isUp && !!upName}
                                    />
                                  </span>
                                ))}
                              </div>
                              <span className="text-orange-500 font-medium truncate text-sm min-w-0">
                                {sixStarWeapons.map(w => w.name).join('、')}
                              </span>
                            </>
                          ) : (
                            <>
                              <WeaponAvatar rarity={6} size="md" isEmpty emptyType="failed" />
                              <span className="text-fg-2 text-sm">{t('stats.ui.weaponPool.noSixStar')}</span>
                            </>
                          )}
                        </div>

                        {/* 右侧：申领次数标签 */}
                        <div className="flex-1 flex items-center justify-end gap-2">
                          {rewardLabel && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">
                              <Gift size={10} />
                              {rewardLabel}
                            </span>
                          )}
                          <span className={`text-sm font-medium ${hasSixStar ? 'text-orange-500' : 'text-fg-1'}`}>
                            {t('stats.ui.weaponPool.sessionNo', { no: s.sessionNo })}
                          </span>
                        </div>
                      </div>

                      {/* 五星武器展示 */}
                      {showFiveStars && countedFiveStarWeapons.length > 0 && (
                        <div className="mt-1.5 pl-10">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {countedFiveStarWeapons.slice(0, 14).map((w) => (
                              <span key={w.id} className="relative inline-flex" title={`${w.name} (${w.count})`}>
                                <WeaponAvatar weaponId={w.id} rarity={5} size="sm" />
                                <CountBadge count={w.count} />
                              </span>
                            ))}
                            {countedFiveStarWeapons.length > 14 && (
                              <span className="text-xs text-fg-2">+{countedFiveStarWeapons.length - 14}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* 武器池保底状态进度条（放在底部） */}
            <div className="rounded-md border border-border/50 bg-bg-2/40 px-3 py-3 space-y-3">
              {/* 标题 */}
              <div className="flex items-center gap-2 text-sm font-medium text-fg-0">
                <TrendingUp size={14} className="text-blue-400" />
                <span>{t('stats.ui.weaponPool.pityTitle')}</span>
              </div>
              
              {/* 6星保底进度 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-fg-1">{t('stats.ui.weaponPool.pitySixStar')}</span>
                  </div>
                  <span className={`font-medium ${status.sessionsSinceLastSixStar >= 4 ? 'text-red-400' : 'text-fg-1'}`}>
                    {status.sessionsSinceLastSixStar}/4
                  </span>
                </div>
                <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ef-progress-fill ${status.sessionsSinceLastSixStar >= 4 ? 'bg-red-500' : 'bg-orange-500'}`}
                    style={{ width: `${animated6Star}%` }}
                  />
                </div>
              </div>
              
              {/* UP保底进度 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-fg-1">{t('stats.ui.weaponPool.pityUp')}</span>
                  </div>
                  <span className={`font-medium ${status.hasUp6 ? 'text-green-400' : 'text-fg-1'}`}>
                    {status.hasUp6 ? t('stats.ui.weaponPool.hasUp') : `${8 - status.sessionsToUp6HardPity}/8`}
                  </span>
                </div>
                <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ef-progress-fill ${status.hasUp6 ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${animatedUp}%` }}
                  />
                </div>
                {status.hasUp6 && (
                  <div className="text-xs text-green-400 font-medium">{t('stats.ui.weaponPool.hasUp')}</div>
                )}
              </div>
              
              {/* 累计奖励信息 */}
              <div className="pt-2 border-t border-border/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <Gift size={12} className="text-cyan-400" />
                  <span className="text-fg-1 font-medium">{t('stats.ui.weaponPool.cumulativeRewardsTitle')}</span>
                </div>
                <div className="text-xs text-fg-2">
                  <span className="text-fg-1">{t('stats.ui.weaponPool.next')}</span>
                  <span className="text-cyan-400 font-medium ml-1">{nextRewardText}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 免费十连展示组件（仅在有免费十连数据时显示）
 */
export function FreeSegmentDisplay({
  freeSegment,
  poolConfig,
}: {
  freeSegment: FreeSegmentStats;
  poolConfig: PoolConfig | null;
}) {
  const { t } = useTranslation();
  const { hasFree, freeSixStar, freeSixStarIsUp, freeCount } = freeSegment;
  
  // 只在有免费十连数据时显示
  if (!hasFree || freeCount === 0) return null;
  
  const charId: string | undefined = freeSixStar && poolConfig 
    ? getCharacterId(freeSixStar.itemName, poolConfig) 
    : undefined;
  
  return (
    <div className="flex items-center gap-3 py-1.5 bg-green-500/5 rounded-md px-2 border border-green-500/20">
      {/* 左侧：角色头像或叉号 */}
      <div className="flex items-center gap-2 w-32 flex-shrink-0">
        <CharacterAvatar
          charId={charId}
          size="md"
          isUp={freeSixStarIsUp}
          showOffBanner={!!freeSixStar && !freeSixStarIsUp}
          isEmpty={!freeSixStar}
          emptyType="failed"
        />
        {freeSixStar ? (
          <span className="text-orange-500 font-medium truncate text-sm">
            {freeSixStar.itemName}
          </span>
        ) : (
          <span className="text-fg-2 text-sm">{t('stats.ui.freeSegment.noUp')}</span>
        )}
      </div>
      
      {/* 说明文字 */}
      <div className="flex-1 text-sm text-fg-1">
        {t('stats.ui.freeSegment.title')}
      </div>
      
      {/* 免费标记 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-green-400">
          {freeCount} {t('stats.pulls')}
        </span>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
          <Gift size={10} />
          {t('stats.ui.freeSegment.free')}
        </span>
      </div>
    </div>
  );
}

/**
 * 里程碑进度条面板 - 显示 60/120/240 三个里程碑进度
 */
export function MilestoneProgressPanel({ milestones }: { milestones: SpecialMilestones }) {
  const { t } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // 动画状态
  const [animated60, setAnimated60] = useState(0);
  const [animated120, setAnimated120] = useState(0);
  const [animated240, setAnimated240] = useState(0);
  
  // 计算各进度条百分比
  const pct60 = Math.min((milestones.nonFreePulls / 60) * 100, 100);
  const pct120 = Math.min((milestones.nonFreePulls / 120) * 100, 100);
  // 240 抽可以重复获取，显示当前周期的进度
  const currentCycle240 = milestones.nonFreePulls % 240;
  const pct240 = milestones.token240Times > 0 && currentCycle240 === 0 
    ? 100 
    : Math.min((currentCycle240 / 240) * 100, 100);
  
  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimated60(pct60);
      setAnimated120(pct120);
      setAnimated240(pct240);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setAnimated60(pct60);
      setAnimated120(pct120);
      setAnimated240(pct240);
    });
    return () => window.cancelAnimationFrame(id);
  }, [pct60, pct120, pct240, prefersReducedMotion]);

  return (
    <div className="rounded-md border border-border/50 bg-bg-2/40 px-3 py-3 space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-fg-0">
          <Gift size={14} className="text-purple-400" />
          <span>{t('stats.ui.milestones.currentPeriod')}</span>
          <span className="text-fg-1 font-normal">
            {milestones.nonFreePulls} {t('stats.pulls')}
          </span>
        </div>
        <span className="text-xs text-fg-2">{t('stats.ui.milestones.note')}</span>
      </div>
      
      {/* 60抽 寻访情报书 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-fg-1">{t('stats.ui.milestones.infoBook')}</span>
          </div>
          <span className={`font-medium ${milestones.hasInfoBook60 ? 'text-green-400' : 'text-fg-1'}`}>
            {Math.min(milestones.nonFreePulls, 60)}/60
          </span>
        </div>
        <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ef-progress-fill ${milestones.hasInfoBook60 ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${animated60}%` }}
          />
        </div>
        {milestones.hasInfoBook60 && (
          <div className="text-xs text-green-400 font-medium">{t('stats.ui.milestones.obtained')}</div>
        )}
      </div>
      
      {/* 120抽 UP大保底 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-fg-1">{t('stats.ui.milestones.up120')}</span>
          </div>
          <span className={`font-medium ${milestones.hasUp6 ? 'text-green-400' : 'text-fg-1'}`}>
            {Math.min(milestones.nonFreePulls, 120)}/120
          </span>
        </div>
        <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ef-progress-fill ${milestones.hasUp6 ? 'bg-green-500' : 'bg-purple-500'}`}
            style={{ width: `${animated120}%` }}
          />
        </div>
        {milestones.hasUp6 && (
          <div className="text-xs text-green-400 font-medium">{t('stats.ui.weaponPool.hasUp')}</div>
        )}
      </div>
      
      {/* 240抽 自选信物 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-fg-1">{t('stats.ui.milestones.token240')}</span>
            {milestones.token240Times > 0 && (
              <span className="text-cyan-400 text-[10px] px-1 py-0.5 rounded bg-cyan-500/15">
                ×{milestones.token240Times}
              </span>
            )}
          </div>
          <span className="font-medium text-fg-1">
            {milestones.token240Times > 0 && currentCycle240 === 0 
              ? '240/240' 
              : `${currentCycle240}/240`}
          </span>
        </div>
        <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ef-progress-fill ${milestones.token240Times > 0 && currentCycle240 === 0 ? 'bg-green-500' : 'bg-cyan-500'}`}
            style={{ width: `${animated240}%` }}
          />
        </div>
        {milestones.token240Times > 0 && (
          <div className="text-xs text-cyan-400">
            {t('stats.ui.milestones.times', { count: milestones.token240Times })}
            {milestones.pullsToNextToken240 > 0 && currentCycle240 > 0 && (
              <span className="text-fg-2 ml-1">
                {t('stats.ui.milestones.nextRemaining', { count: milestones.pullsToNextToken240 })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 进度条组件 - 显示单个6星进度
 */
export function PityProgressBar({
  segment,
  poolConfig,
  showFiveStars,
  maxPulls = 80,
}: {
  segment: PitySegment;
  poolConfig: PoolConfig | null;
  showFiveStars: boolean;
  maxPulls?: number;
}) {
  const { t } = useTranslation();
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
  
  // 根据抽数决定颜色（抽数越多越倒霉）
  const getBarColor = () => {
    if (segment.pulls <= 20) return 'bg-green-500';
    if (segment.pulls <= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const countedFiveStars = (() => {
    if (!showFiveStars) return [];
    const items = (segment.fiveStars ?? []).map((r) => ({
      id: r.charId ?? getCharacterId(r.itemName, poolConfig),
      name: r.itemName,
      isUp: false,
    }));
    return groupById(items);
  })();

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-3">
        {/* 左侧：角色头像或问号 */}
        <div className="flex items-center gap-2 w-32 flex-shrink-0">
          <CharacterAvatar
            charId={segment.charId}
            rarity={6}
            size="md"
            isUp={segment.isUp}
            showOffBanner={hasSixStar && !segment.isUp}
            isEmpty={!hasSixStar}
            emptyType="unknown"
          />
          {hasSixStar ? (
            <span className="text-orange-500 font-medium truncate text-sm">
              {segment.sixStar!.itemName}
            </span>
          ) : (
          <span className="text-fg-2 text-sm">{t('stats.ui.progress.notObtained')}</span>
          )}
        </div>
        
        {/* 进度条和抽数一起 */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-4 bg-bg-3 rounded-md overflow-hidden relative">
            <div
              className={`h-full ${getBarColor()} ef-progress-fill rounded-md`}
              style={{ width: `${animatedPct}%` }}
            />
          </div>
          {/* 抽数跟随进度条一起动画 */}
          <span
            className="text-sm font-medium text-fg-1 whitespace-nowrap ef-pulls-label"
            style={{
              opacity: animatedPct > 0 ? 1 : 0,
              transform: `translateX(${animatedPct > 0 ? 0 : -8}px)`,
            }}
          >
            {segment.pulls} {t('stats.pulls')}
          </span>
        </div>
      </div>

      {showFiveStars && countedFiveStars.length > 0 && (
        <div className="mt-1 pl-36">
          <div className="flex flex-wrap items-center gap-1.5">
            {countedFiveStars.slice(0, 14).map((c) => (
              <span key={c.id} className="relative inline-flex" title={`${c.name} (${c.count})`}>
                <CharacterAvatar charId={c.id} rarity={5} size="sm" />
                <CountBadge count={c.count} />
              </span>
            ))}
            {countedFiveStars.length > 14 && (
              <span className="text-xs text-fg-2">+{countedFiveStars.length - 14}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 单个池子的展示组件
 */
export function PoolGroupCard({ group, showFiveStars }: { group: PoolGroupStats; showFiveStars: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [pityExpanded, setPityExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const panelId = `pool-group-${group.poolId}`;
  
  // 构建背景图片路径
  const bgImagePath = `/content/${group.poolId}/up6_image.png`;
  const showBgImage = !imgError;
  
  // 判断是否为限定池
  const isSpecialPool = group.poolId.startsWith('special');
  
  // 获取 UP 角色的 ID（用于标题头像）
  const upCharId = useMemo(() => {
    if (!group.poolConfig) return undefined;
    const upName = group.poolConfig.pool.up6_name;
    return getCharacterId(upName, group.poolConfig);
  }, [group.poolConfig]);

  return (
    <div className="border border-border rounded-md overflow-hidden relative group">
      {/* 背景图片层 */}
      {showBgImage && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none overflow-hidden">
            {/* 背景图片 */}
            <img
              src={bgImagePath}
              alt=""
              className="w-full h-auto object-contain"
              style={{
                objectPosition: 'center top',
                opacity: 0.4,
                minHeight: '120px',
              }}
              onError={() => {
                setImgError(true);
              }}
            />
          </div>
          {/* 遮罩层 */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none bg-bg-2/0 backdrop-blur-sm transition-colors group-hover:bg-bg-3/0"
          />
        </>
      )}
      
      {/* 池名称和概要 */}
      <button
        className={[
          'relative w-full px-4 py-3 flex items-start justify-between transition-all duration-300',
          showBgImage ? 'bg-transparent' : 'bg-bg-2/80 backdrop-blur-sm hover:bg-bg-3/90',
          // 展开时扩展到背景图高度，折叠时保持紧凑
          showBgImage && expanded ? 'min-h-[120px] items-center' : 'items-center',
        ].join(' ')}
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        {/* 展开状态：纵向布局，文字更大 */}
        {showBgImage && expanded ? (
          <div className="flex flex-col justify-center gap-2 py-1">
            {/* 卡池名 - 展开时更大更醒目 */}
            <div className="flex items-center gap-2.5">
              <CharacterAvatar 
                charId={upCharId} 
                rarity={6} 
                size="md" 
                isUp 
                className="drop-shadow-lg"
              />
              <span className="text-lg font-semibold text-fg-0 drop-shadow-md">
                {group.poolName}
              </span>
            </div>
            {/* 统计数据行 - 展开时字体稍大 */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-base text-fg-1 drop-shadow-sm font-medium">
                {t('stats.ui.poolSummary.subtitle', { count: group.total })}
              </span>
              {group.sixStarCount > 0 && (
                <span className="text-base text-orange-500 drop-shadow-sm font-medium">
                  {t('stats.ui.poolSummary.sixStarLabel', { count: group.sixStarCount })}
                </span>
              )}
              {showFiveStars && group.fiveStarCount > 0 && (
                <span className="text-base text-amber-400 drop-shadow-sm font-medium">
                  {t('stats.ui.poolSummary.fiveStarLabel', { count: group.fiveStarCount })}
                </span>
              )}
              {/* 歪的数量 */}
              {(() => {
                const offBannerCount = group.segments.filter(s => s.sixStar && s.isUp === false).length;
                return offBannerCount > 0 ? (
                  <span className="text-base text-red-400 drop-shadow-sm font-medium">
                    {t('stats.ui.poolSummary.offBannerLabel', { count: offBannerCount })}
                  </span>
                ) : null;
              })()}
              {/* 武库配额 */}
              {group.armoryQuota > 0 && (
                <span className="flex items-center gap-1.5 text-base drop-shadow-sm">
                  <img 
                    src="/efimg/gameEntryId=930.png" 
                    alt={t('stats.ui.armoryQuota')} 
                    className="w-5 h-5"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="ef-armory-quota-label font-medium">{t('stats.ui.armoryQuotaProduced')}</span>
                  <span className="ef-armory-quota-value font-medium">{formatArmoryQuota(group.armoryQuota)}</span>
                  <HelpTooltip text={t('stats.ui.calcMayDifferHint')} />
                </span>
              )}
            </div>
          </div>
        ) : (
          /* 折叠状态：保持原有的横向紧凑布局 */
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-fg-0 drop-shadow-sm flex items-center gap-2">
              <CharacterAvatar 
                charId={upCharId} 
                rarity={6} 
                size="sm" 
                isUp 
                className="drop-shadow-md"
              />
              {group.poolName}
            </span>
            <span className="text-sm text-fg-1 drop-shadow-sm">
              {t('stats.ui.poolSummary.subtitle', { count: group.total })}
            </span>
            {group.sixStarCount > 0 && (
              <span className="text-sm text-orange-500 drop-shadow-sm">
                {t('stats.ui.poolSummary.sixStarLabel', { count: group.sixStarCount })}
              </span>
            )}
            {showFiveStars && group.fiveStarCount > 0 && (
              <span className="text-sm text-amber-400 drop-shadow-sm">
                {t('stats.ui.poolSummary.fiveStarLabel', { count: group.fiveStarCount })}
              </span>
            )}
            {/* 歪的数量 */}
            {(() => {
              const offBannerCount = group.segments.filter(s => s.sixStar && s.isUp === false).length;
              return offBannerCount > 0 ? (
                <span className="text-sm text-red-400 drop-shadow-sm">
                  {t('stats.ui.poolSummary.offBannerLabel', { count: offBannerCount })}
                </span>
              ) : null;
            })()}
            {/* 武库配额 */}
            {group.armoryQuota > 0 && (
              <span className="flex items-center gap-1 text-sm drop-shadow-sm">
                <img 
                  src="/efimg/gameEntryId=930.png" 
                  alt={t('stats.ui.armoryQuota')} 
                  className="w-4 h-4"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="ef-armory-quota-label">{t('stats.ui.armoryQuotaProduced')}</span>
                <span className="ef-armory-quota-value">{formatArmoryQuota(group.armoryQuota)}</span>
                <HelpTooltip text={t('stats.ui.calcMayDifferHint')} />
              </span>
            )}
          </div>
        )}
        <ChevronDown
          size={expanded && showBgImage ? 18 : 16}
          className={`text-fg-2 transition-transform drop-shadow-sm flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      
      {/* 展开内容 */}
      <div
        id={panelId}
        className="ef-collapse"
        data-expanded={expanded ? 'true' : 'false'}
      >
        <div className="ef-collapse__inner">
          {/* 分割线：图片和内容之间的美观分隔 */}
          <div 
            className="ef-pool-card-divider mx-4"
            aria-hidden="true"
          />
          
          {/* 内容区域 */}
          <div className="px-4 pt-4 pb-3 space-y-3 bg-bg-1/95 ef-pool-card-content">
            {/* 6星进度条列表 */}
            <div className="space-y-1">
              {group.segments.map((segment, idx) => (
                <PityProgressBar
                  key={idx}
                  segment={segment}
                  poolConfig={group.poolConfig}
                  showFiveStars={showFiveStars}
                />
              ))}
            </div>
            
            {/* 免费十连展示（仅在有数据时显示，在进度条之后） */}
            <FreeSegmentDisplay freeSegment={group.freeSegment} poolConfig={group.poolConfig} />

            {/* 限定池当期里程碑进度条（不含免费十连） */}
            {isSpecialPool && group.specialMilestones && (
              <MilestoneProgressPanel milestones={group.specialMilestones} />
            )}
            
            {/* 保底状态面板（默认折叠） */}
            <div className="border-t border-border/50 pt-3">
              {isSpecialPool ? (
                <div className="text-xs text-fg-2">
                  {t('stats.ui.pityDetailsDesc')}
                </div>
              ) : (
                <>
                  <button
                    className="w-full flex items-center justify-between text-sm font-medium text-fg-0 hover:text-brand transition-colors"
                    onClick={() => setPityExpanded(!pityExpanded)}
                    type="button"
                    aria-expanded={pityExpanded}
                  >
                    <span>{t('stats.ui.pityDetailsTitle')}</span>
                    <ChevronDown
                      size={16}
                      className={`text-fg-2 transition-transform ${pityExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  <div
                    className="ef-collapse"
                    data-expanded={pityExpanded ? 'true' : 'false'}
                  >
                    <div className="ef-collapse__inner pt-3">
                      <PityStatusPanel pityStatus={group.pityStatus} isSpecialPool={isSpecialPool} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 固定池进度条组件（带动画）
 */
function FixedPoolProgressBar({
  segment,
  showFiveStars,
  maxPulls = 80,
}: {
  segment: PitySegment;
  showFiveStars: boolean;
  maxPulls?: number;
}) {
  const { t } = useTranslation();
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
  
  // 根据抽数决定颜色（抽数越多越倒霉）
  const getBarColor = () => {
    if (segment.pulls <= 20) return 'bg-green-500';
    if (segment.pulls <= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const countedFiveStars = (() => {
    if (!showFiveStars) return [];
    const items = (segment.fiveStars ?? []).map((r) => ({
      id: r.charId,
      name: r.itemName,
      isUp: false,
    }));
    return groupById(items);
  })();

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-3">
        {/* 左侧：角色头像（不显示歪标签） */}
        <div className="flex items-center gap-2 w-32 flex-shrink-0">
          <CharacterAvatar
            charId={segment.charId}
            rarity={6}
            size="md"
            isUp={false}
            showOffBanner={false}
            isEmpty={!hasSixStar}
            emptyType="unknown"
          />
          {hasSixStar ? (
            <span className="text-orange-500 font-medium truncate text-sm">
              {segment.sixStar!.itemName}
            </span>
          ) : (
            <span className="text-fg-2 text-sm">{t('stats.ui.progress.notObtained')}</span>
          )}
        </div>
        
        {/* 进度条和抽数一起 */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-4 bg-bg-3 rounded-md overflow-hidden relative">
            <div
              className={`h-full ${getBarColor()} ef-progress-fill rounded-md`}
              style={{ width: `${animatedPct}%` }}
            />
          </div>
          {/* 抽数跟随进度条一起动画 */}
          <span
            className="text-sm font-medium text-fg-1 whitespace-nowrap ef-pulls-label"
            style={{
              opacity: animatedPct > 0 ? 1 : 0,
              transform: `translateX(${animatedPct > 0 ? 0 : -8}px)`,
            }}
          >
            {segment.pulls} {t('stats.pulls')}
          </span>
        </div>
      </div>

      {showFiveStars && countedFiveStars.length > 0 && (
        <div className="mt-1 pl-36">
          <div className="flex flex-wrap items-center gap-1.5">
            {countedFiveStars.slice(0, 14).map((c) => (
              <span key={c.id} className="relative inline-flex" title={`${c.name} (${c.count})`}>
                <CharacterAvatar charId={c.id} rarity={5} size="sm" />
                <CountBadge count={c.count} />
              </span>
            ))}
            {countedFiveStars.length > 14 && (
              <span className="text-xs text-fg-2">+{countedFiveStars.length - 14}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 固定池（常驻/新手）的展示组件
 */
export function FixedPoolCard({
  poolName,
  records,
  showTitle = true,
  showFiveStars,
  isStandardPool = false,
}: {
  poolName: string;
  records: UnifiedGachaRecord[];
  showTitle?: boolean;
  showFiveStars: boolean;
  isStandardPool?: boolean;
}) {
  const { t } = useTranslation();
  const [segments, setSegments] = useState<PitySegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadSegments = () => {
      setIsLoading(true);
      // 固定池通常没有配置文件，传null
      const segs = calculatePoolSegments(records, null);
      setSegments(segs);
      setIsLoading(false);
    };
    
    loadSegments();
  }, [records]);
  
  const sixStarCount = records.filter(r => r.rarity === 6).length;
  const fiveStarCount = records.filter(r => r.rarity === 5).length;
  // 当前保底：第一段（最新）如果没有6星，就是当前保底数
  const firstSegment = segments[0];
  const currentPity6Star = firstSegment && !firstSegment.sixStar ? firstSegment.pulls : 0;
  
  // 计算武库配额（常驻池专用）
  const armoryQuota = useMemo(() => {
    if (!isStandardPool) return 0;
    return calculateArmoryQuota(records);
  }, [records, isStandardPool]);
  
  // 计算5星保底进度（10抽保底）
  const pityTo5Star = useMemo(() => {
    if (records.length === 0) return 0;
    // 按时间正序排列
    const sorted = sortRecordsByTimeAndSeq(records);
    let count = 0;
    // 从最新的记录往前数
    for (let i = sorted.length - 1; i >= 0; i--) {
      const r = sorted[i];
      if (!r || r.rarity >= 5) break;
      count++;
    }
    return count;
  }, [records]);
  
  // 计算300抽自选进度（常驻池专用）
  const selectProgress = useMemo(() => {
    if (!isStandardPool) return { total: 0, times: 0, remaining: 300 };
    const total = records.length;
    const times = Math.floor(total / 300);
    const remaining = 300 - (total % 300);
    return { total, times, remaining: remaining === 300 ? 0 : remaining };
  }, [records, isStandardPool]);
  
  // 常驻池保底进度条动画
  const prefersReducedMotion = usePrefersReducedMotion();
  const pct6Star = Math.min((currentPity6Star / 80) * 100, 100);
  const pct5Star = Math.min((pityTo5Star / 10) * 100, 100);
  const pct300 = selectProgress.times >= 1 ? 100 : Math.min(((records.length % 300) / 300) * 100, 100);
  
  const [animated6Star, setAnimated6Star] = useState(0);
  const [animated5Star, setAnimated5Star] = useState(0);
  const [animated300, setAnimated300] = useState(0);
  
  useEffect(() => {
    if (!isStandardPool) return;
    if (prefersReducedMotion) {
      setAnimated6Star(pct6Star);
      setAnimated5Star(pct5Star);
      setAnimated300(pct300);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setAnimated6Star(pct6Star);
      setAnimated5Star(pct5Star);
      setAnimated300(pct300);
    });
    return () => window.cancelAnimationFrame(id);
  }, [isStandardPool, pct6Star, pct5Star, pct300, prefersReducedMotion]);

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-fg-2">
        <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
        <p>{t('stats.ui.poolEmpty.fixed')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="text-sm font-medium text-fg-0 px-1">{poolName}</div>
      )}
      
      {/* 概要信息 */}
      <div className="flex items-center gap-4 px-1 py-2 flex-wrap">
        <span className="text-fg-1">
          {t('stats.ui.poolSummary.subtitle', { count: records.length })}
        </span>
        <span className="text-sm text-orange-500">
          {t('stats.ui.poolSummary.sixStarLabel', { count: sixStarCount })}
        </span>
        {showFiveStars && fiveStarCount > 0 && (
          <span className="text-sm text-amber-400">
            {t('stats.ui.poolSummary.fiveStarLabel', { count: fiveStarCount })}
          </span>
        )}
        {/* 武库配额（常驻池专用） */}
        {isStandardPool && armoryQuota > 0 && (
          <span className="flex items-center gap-1 text-sm">
            <img 
              src="/efimg/gameEntryId=930.png" 
              alt={t('stats.ui.armoryQuota')} 
              className="w-4 h-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="ef-armory-quota-label">{t('stats.ui.armoryQuotaProduced')}</span>
            <span className="text-cyan-400">{formatArmoryQuota(armoryQuota)}</span>
          </span>
        )}
      </div>
      
      {/* 非常驻池的当前保底显示 */}
      {!isStandardPool && currentPity6Star > 0 && (
        <div className="px-1 text-sm text-fg-1">
          {t('stats.ui.currentPityLabel', { count: currentPity6Star })}
        </div>
      )}
      
      {/* 进度条列表（常驻和新手池不显示"歪"标签） */}
      {isLoading ? (
        <div className="text-center py-4 text-fg-2">
          <Loader2 size={24} className="mx-auto animate-spin" />
        </div>
      ) : (
        <div className="space-y-1">
          {segments.map((segment, idx) => (
            <FixedPoolProgressBar
              key={idx}
              segment={segment}
              showFiveStars={showFiveStars}
            />
          ))}
        </div>
      )}
      
      {/* 常驻池保底状态面板（放在底部） */}
      {isStandardPool && (
        <div className="rounded-md border border-border/50 bg-bg-2/50 p-4 space-y-3">
          {/* 标题 */}
          <div className="flex items-center gap-2 text-sm font-medium text-fg-0">
            <TrendingUp size={16} className="text-blue-400" />
            <span>{t('stats.ui.standardPool.pityTitle')}</span>
          </div>
          
          {/* 保底进度 */}
          <div className="space-y-3">
            {/* 6星保底进度（抽数越多越倒霉） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Star size={14} className={currentPity6Star > 40 ? 'text-red-500' : currentPity6Star > 20 ? 'text-yellow-500' : 'text-green-500'} />
                  <span className="text-fg-1">{t('stats.ui.standardPool.pity6Star')}</span>
                </div>
                <span className={`font-medium ${currentPity6Star > 40 ? 'text-red-500' : currentPity6Star > 20 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {currentPity6Star}/80 {t('stats.pulls')}
                </span>
              </div>
              <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ef-progress-fill ${currentPity6Star > 40 ? 'bg-red-500' : currentPity6Star > 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${animated6Star}%` }}
                />
              </div>
            </div>
            
            {/* 5星保底进度 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  <span className="text-fg-1">{t('stats.ui.standardPool.pity5Star')}</span>
                </div>
                <span className={`font-medium ${pityTo5Star >= 10 ? 'text-red-500' : 'text-amber-400'}`}>
                  {pityTo5Star}/10 {t('stats.pulls')}
                </span>
              </div>
              <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ef-progress-fill ${pityTo5Star >= 10 ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${animated5Star}%` }}
                />
              </div>
            </div>
            
            {/* 300抽自选进度 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Gift size={14} className="text-purple-400" />
                  <span className="text-fg-1">{t('stats.ui.standardPool.select300')}</span>
                </div>
                {selectProgress.times >= 1 ? (
                  <span className="text-green-400 font-medium">
                    {t('stats.ui.standardPool.obtained')}
                  </span>
                ) : (
                  <span className="text-purple-400 font-medium">
                    {records.length % 300}/300 {t('stats.pulls')}
                  </span>
                )}
              </div>
              <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ef-progress-fill ${selectProgress.times >= 1 ? 'bg-green-500' : 'bg-purple-500'}`}
                  style={{ width: `${animated300}%` }}
                />
              </div>
              {selectProgress.times >= 1 && selectProgress.remaining > 0 && (
                <div className="text-xs text-fg-2">
                  {t('stats.ui.standardPool.nextRemaining', { count: selectProgress.remaining })}
                </div>
              )}
            </div>
          </div>
          
          {/* 保底说明 */}
          <div className="pt-2 border-t border-border/50 space-y-1 text-xs text-fg-2">
            <div className="flex items-center gap-1">
              <AlertCircle size={12} className="text-blue-400 flex-shrink-0" />
              <span>{t('stats.ui.standardPool.pityNote')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
