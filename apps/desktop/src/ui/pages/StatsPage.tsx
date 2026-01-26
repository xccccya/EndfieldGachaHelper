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
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, RarityBadge, CharacterAvatar, WeaponAvatar, PityStatusPanel, HelpTooltip } from '../components';
import { useAccounts, useGachaRecordsData } from '../../hooks/useEndfield';
import { charRecordToUnified, weaponRecordToUnified, calculateUnifiedStats, getPoolTypePrefix, type UnifiedGachaRecord } from '../../lib/storage';
import { formatDateShort, getTimestamp } from '../../lib/dateUtils';
import type { GachaCategory } from '@efgachahelper/shared';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';
import {
  loadPoolConfig,
  isUpCharacter,
  getCharacterId,
  calculateArmoryQuota,
  calculatePityStatus,
  calculateSharedPityStatus,
  calculateFreeSegmentStats,
  aggregateWeaponRecordsToSessions,
  calculateWeaponPoolStatus,
  type WeaponDrawSession,
  type WeaponPoolStatus,
  formatArmoryQuota,
  type PoolConfig,
  type PityStatus,
  type FreeSegmentStats,
} from '../../lib/poolUtils';

/** 卡池类型标签 */
type PoolTab = 'special' | 'weapon' | 'standard' | 'beginner';

/** 卡池标签名称 */
const POOL_TAB_NAMES: Record<PoolTab, string> = {
  special: '限定池',
  weapon: '武器池',
  standard: '常驻池',
  beginner: '新手池',
};

const CALC_MAY_DIFFER_HINT = '计算方式可能和实际情况有出入，仅供参考。';

/** 6星进度条段 - 记录抽到6星的过程 */
type PitySegment = {
  pulls: number;          // 抽数（不含免费十连）
  sixStar?: UnifiedGachaRecord | undefined; // 抽到的6星（如果有）
  charId?: string | undefined;        // 角色ID
  isUp?: boolean | undefined;         // 是否为UP角色
  /** 本段内的 5★ 条目（用于“展示 5 星”） */
  fiveStars?: UnifiedGachaRecord[] | undefined;
  isFree?: boolean | undefined;       // 是否包含免费十连（已弃用）
  freeCount?: number | undefined;     // 免费十连抽数（已弃用）
};

/** 分池统计数据 */
type SpecialMilestones = {
  /** 当期累计抽数（不含免费十连） */
  nonFreePulls: number;
  /** 是否已获得当期UP 6星 */
  hasUp6: boolean;
  /** 距离当期UP大保底（120抽）还差多少抽（不含免费十连） */
  pullsToUp120: number;
  /** 是否已获得“寻访情报书”（60抽里程碑，一期一次；不含免费十连） */
  hasInfoBook60: boolean;
  /** 距离 60 还差多少抽（不含免费十连） */
  pullsToInfoBook60: number;
  /** 240 信物次数（不含免费十连） */
  token240Times: number;
  /** 距离下一次 240 还差多少抽（不含免费十连） */
  pullsToNextToken240: number;
};

type PoolGroupStats = {
  poolId: string;
  poolName: string;
  records: UnifiedGachaRecord[];
  segments: PitySegment[];
  total: number;
  currentPity: number;    // 当前保底（距离上次6星的抽数，不含免费十连）
  sixStarCount: number;
  fiveStarCount: number;
  // 新增字段
  poolConfig: PoolConfig | null;  // 池子配置
  armoryQuota: number;            // 武库配额总计
  pityStatus: PityStatus;         // 保底状态
  freeSegment: FreeSegmentStats;  // 免费十连统计
  specialMilestones?: SpecialMilestones;
};

type WeaponPoolGroupStats = {
  poolId: string;
  poolName: string;
  poolConfig: PoolConfig | null;
  /** 原始武器记录条目数（每把武器一条记录） */
  itemCount: number;
  /** 十连申领会话（按时间正序，sessionNo 从 1 开始） */
  sessions: WeaponDrawSession[];
  /** 计算后的状态 */
  status: WeaponPoolStatus;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

type RarityCountMap = Record<3 | 4 | 5 | 6, number>;

function getRarityCounts(records: UnifiedGachaRecord[]): RarityCountMap {
  const result: RarityCountMap = { 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const r of records) {
    if (r.rarity === 3 || r.rarity === 4 || r.rarity === 5 || r.rarity === 6) {
      result[r.rarity] += 1;
    }
  }
  return result;
}

function formatMaybeNumber(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

type CountedItem = {
  id: string;
  name: string;
  count: number;
  isUp?: boolean | undefined;
};

function groupById(items: Array<{ id?: string | undefined; name: string; isUp?: boolean | undefined }>): CountedItem[] {
  const map = new Map<string, CountedItem>();
  for (const it of items) {
    if (!it.id) continue;
    const key = it.id;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      prev.isUp = prev.isUp || it.isUp;
    } else {
      map.set(key, { id: key, name: it.name, count: 1, isUp: it.isUp });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function CountBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  const label = count >= 100 ? '99+' : String(count);
  return (
    <span
      className="absolute -top-1 -right-1 px-1.5 h-[16px] rounded-[6px] bg-amber-500 text-black text-[11px] font-extrabold leading-[16px] shadow-md"
      aria-label={`次数 ${count}`}
      title={`次数 ${count}`}
    >
      {label}
    </span>
  );
}

function resolveWeaponId(record: UnifiedGachaRecord, poolConfig: PoolConfig | null): string | undefined {
  if (record.weaponId) return record.weaponId;
  const hit = poolConfig?.pool?.all?.find((x) => x.name === record.itemName);
  return hit?.id;
}

function FiveStarSwitch({
  value,
  onToggle,
  className,
}: {
  value: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const isOn = value;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOn}
      title={isOn ? '关闭 5 星展示' : '开启 5 星展示'}
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
        5星展示
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

function SharedSpecialPityCard({ pityStatus }: { pityStatus: PityStatus }) {
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
          <span className="font-medium text-fg-0">特许寻访共享保底</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-purple-500">
            当前 {pityStatus.pityTo6Star} 抽
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

function WeaponPoolCard({ group, showFiveStars }: { group: WeaponPoolGroupStats; showFiveStars: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const panelId = `weapon-pool-${group.poolId}`;

  const bgImagePath = `/content/${group.poolId}/up6_image.png`;
  const showBgImage = !imgError;

  const { status } = group;
  const upName = group.poolConfig?.pool?.up6_name;
  const boxName = group.poolConfig?.pool?.gift_weapon_box_name || '补充武库箱';
  const giftName = group.poolConfig?.pool?.gift_weapon_reward_name || '赠礼';

  const recentSessions = [...group.sessions].slice(-20).reverse();

  const nextRewardText = status.nextCumulativeReward
    ? `${status.nextCumulativeReward.type === 'box' ? boxName : giftName}：还差 ${status.nextCumulativeReward.remainingSessions} 次（第 ${status.nextCumulativeReward.atSessionNo} 次）`
    : '无';

  return (
    <div className="border border-border rounded-md overflow-hidden relative group">
      {showBgImage && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none overflow-hidden">
            <img
              src={bgImagePath}
              alt=""
              className="w-full h-auto object-contain transition-opacity duration-700 ease-out"
              style={{
                objectPosition: 'center top',
              opacity: imgLoaded ? 0.4 : 0,
                minHeight: '120px',
              }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </div>
          {/* 方案 A：固定遮罩层，保证背景图压暗一致 */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none bg-bg-2/0 backdrop-blur-sm transition-colors group-hover:bg-bg-3/0"
          />
        </>
      )}

      <button
        className={[
          'relative w-full px-4 py-3 flex items-center justify-between transition-colors',
          showBgImage ? 'bg-transparent' : 'bg-bg-2/80 backdrop-blur-sm hover:bg-bg-3/90',
        ].join(' ')}
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-fg-0 drop-shadow-sm flex items-center gap-2">
            <Sword size={16} className="text-fg-1/70" />
            {group.poolName}
          </span>
          <span className="text-sm text-fg-1 drop-shadow-sm">
            共 {status.totalSessions} 次申领
          </span>
          <span className="text-sm text-fg-2 drop-shadow-sm">
            {group.itemCount} 件武器
          </span>
          {status.sixStarCount > 0 && (
            <span className="text-sm text-orange-500 drop-shadow-sm">
              {status.sixStarCount} 把6星
            </span>
          )}
          {upName && (
            <span className="text-sm text-orange-500 drop-shadow-sm">
              UP：{upName}（{status.up6Count}）
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-fg-2 transition-transform drop-shadow-sm ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={panelId}
        className="ef-collapse relative"
        data-expanded={expanded ? 'true' : 'false'}
      >
        <div className="ef-collapse__inner relative">
          {/* 内容区背景：从背景图下缘开始铺底，避免再次压暗背景图 */}
          <div
            aria-hidden="true"
            className={[
              'absolute inset-x-0 bottom-0 pointer-events-none',
              showBgImage ? 'top-[120px]' : 'top-0',
              'bg-bg-1/90 backdrop-blur-sm',
            ].join(' ')}
          />
          <div className="relative px-4 pt-6 pb-3 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-md border border-border/50 bg-bg-2/40 px-3 py-2 text-sm">
                <div className="text-fg-1 font-medium">保底</div>
                <div className="mt-1 space-y-1 text-xs text-fg-2">
                  <div className="flex items-center justify-between">
                    <span>距6★保底（4次申领）</span>
                    <span className="text-orange-400 font-medium">
                      {status.sessionsSinceLastSixStar}/4（还差 {status.sessionsToSixStarHardPity} 次）
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>距UP保底（8次申领，一期一次）</span>
                    {status.hasUp6 ? (
                      <span className="text-green-400 font-medium">已获得UP</span>
                    ) : (
                      <span className="text-purple-400 font-medium">
                        还差 {status.sessionsToUp6HardPity} 次
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/50 bg-bg-2/40 px-3 py-2 text-sm">
                <div className="text-fg-1 font-medium">累计奖励</div>
                <div className="mt-1 space-y-1 text-xs text-fg-2">
                  <div className="flex items-center justify-between">
                    <span>下一次</span>
                    <span className="text-cyan-400 font-medium">{nextRewardText}</span>
                  </div>
                  <div className="text-fg-2">
                    说明：按十连申领次数计数（第10次箱子、第18次赠礼，之后每16次循环）。
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border/50 bg-bg-2/20 px-3 py-2">
              <div className="text-sm font-medium text-fg-0">最近申领（最多20次）</div>
              <div className="mt-2 space-y-1 divide-y divide-border/30 text-sm">
                {recentSessions.length === 0 ? (
                  <div className="text-fg-2 text-sm">暂无记录</div>
                ) : (
                  recentSessions.map((s) => {
                    const rewardLabel = s.cumulativeReward
                      ? (s.cumulativeReward === 'box' ? boxName : giftName)
                      : undefined;
                    const sixStarWeapons = s.sixStars.map((r) => ({
                      id: resolveWeaponId(r, group.poolConfig),
                      name: r.itemName,
                      isUp: upName ? r.itemName === upName : false,
                    }));
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-fg-1">
                            第 <span className="font-medium text-fg-0">{s.sessionNo}</span> 次申领
                            {rewardLabel && (
                              <span className="ml-2 text-xs text-cyan-400">累计奖励：{rewardLabel}</span>
                            )}
                          </div>
                          <div className="text-fg-2">
                            {s.sixStars.length === 0 ? (
                              <span>未出6★</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-orange-400 font-medium">6★：</span>
                                <span className="inline-flex flex-wrap items-center gap-1">
                                  {sixStarWeapons.map((w) => (
                                    <span key={`${w.id ?? w.name}`} className="relative inline-flex">
                                      <WeaponAvatar weaponId={w.id} rarity={6} size="sm" isUp={w.isUp} />
                                    </span>
                                  ))}
                                </span>
                                {upName && s.sixStars.some((r) => r.itemName === upName) && (
                                  <span className="text-purple-400 text-xs">（含UP）</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {showFiveStars && countedFiveStarWeapons.length > 0 && (
                          <div className="mt-1 pl-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {countedFiveStarWeapons.slice(0, 14).map((w) => (
                                <span key={w.id} className="relative inline-flex" title={`${w.name}（${w.count}）`}>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
 * 注意：免费十连不计入保底，所以pulls中不包含免费十连
 */
function calculatePoolSegments(
  records: UnifiedGachaRecord[], 
  poolConfig: PoolConfig | null
): PitySegment[] {
  if (records.length === 0) return [];

  // 按时间正序排列（最早的在前）用于计算
  const sorted = [...records].sort((a, b) => 
    getTimestamp(a.gachaTs) - getTimestamp(b.gachaTs)
  );

  const segments: PitySegment[] = [];
  let currentPulls = 0;
  let currentFiveStars: UnifiedGachaRecord[] = [];

  for (const record of sorted) {
    // 免费十连不计入保底
    if (!record.isFree) {
      currentPulls++;
    }

    // 仅统计非免费段内的 5★（免费十连统一在下方“免费十连结果”中展示）
    if (!record.isFree && record.rarity === 5) {
      currentFiveStars.push(record);
    }

    if (record.rarity === 6) {
      const isUp = poolConfig ? isUpCharacter(record.itemName, poolConfig) : false;
      const charId = poolConfig ? getCharacterId(record.itemName, poolConfig) : record.charId;
      
      segments.push({
        pulls: currentPulls,
        sixStar: record,
        charId,
        isUp,
        fiveStars: currentFiveStars,
      });
      currentPulls = 0;
      currentFiveStars = [];
    }
  }

  // 如果还有未出6星的抽数，添加一个未完成段
  if (currentPulls > 0) {
    segments.push({
      pulls: currentPulls,
      fiveStars: currentFiveStars,
    });
  }

  // 反转数组，使新的在前（UI 显示新的在上）
  return segments.reverse();
}

/**
 * 按 poolId 分组统计记录
 */
async function groupRecordsByPool(records: UnifiedGachaRecord[]): Promise<PoolGroupStats[]> {
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
    // 加载池子配置
    const poolConfig = await loadPoolConfig(poolId);
    
    // 计算进度条段（需要池子配置来判断UP）
    const segments = calculatePoolSegments(poolRecords, poolConfig);
    
    // 过滤出非免费十连的记录用于保底计算
    const nonFreeRecords = poolRecords.filter(r => !r.isFree);
    const isSpecialPool = poolId.startsWith('special');
    
    // 统计数量
    const sixStars = poolRecords.filter(r => r.rarity === 6);
    const fiveStars = poolRecords.filter(r => r.rarity === 5);
    
    // 当前保底：第一段（最新）如果没有6星，就是当前保底数
    const firstSegment = segments[0];
    const currentPity = firstSegment && !firstSegment.sixStar ? firstSegment.pulls : 0;
    
    // 计算武库配额（免费十连不计入）
    const armoryQuota = calculateArmoryQuota(nonFreeRecords);
    
    // 计算保底状态
    const pityStatus = calculatePityStatus(nonFreeRecords, poolConfig);
    
    // 计算免费十连统计
    const freeSegment = calculateFreeSegmentStats(poolRecords, poolConfig);

    // 限定池里程碑（当期，不含免费十连）
    const specialMilestones: SpecialMilestones | undefined = (isSpecialPool && poolConfig)
      ? (() => {
          const nonFreePulls = nonFreeRecords.length;
          const hasUp6 = nonFreeRecords.some(
            (r) => r.rarity === 6 && isUpCharacter(r.itemName, poolConfig)
          );
          const pullsToUp120 = hasUp6 ? 0 : Math.max(0, 120 - nonFreePulls);
          const hasInfoBook60 = nonFreePulls >= 60;
          const pullsToInfoBook60 = hasInfoBook60 ? 0 : Math.max(0, 60 - nonFreePulls);
          const token240Times = Math.floor(nonFreePulls / 240);
          const nextTokenAt = (token240Times + 1) * 240;
          const pullsToNextToken240 = Math.max(0, nextTokenAt - nonFreePulls);
          return {
            nonFreePulls,
            hasUp6,
            pullsToUp120,
            hasInfoBook60,
            pullsToInfoBook60,
            token240Times,
            pullsToNextToken240,
          };
        })()
      : undefined;

    result.push({
      poolId,
      poolName: poolRecords[0]?.poolName || poolId,
      records: poolRecords,
      segments,
      total: poolRecords.length,
      currentPity,
      sixStarCount: sixStars.length,
      fiveStarCount: fiveStars.length,
      poolConfig,
      armoryQuota,
      pityStatus,
      freeSegment,
      ...(specialMilestones ? { specialMilestones } : {}),
    });
  }

  // 按总抽数排序
  result.sort((a, b) => b.total - a.total);

  return result;
}

/**
 * 免费十连展示组件（仅在有免费十连数据时显示）
 */
function FreeSegmentDisplay({
  freeSegment,
  poolConfig,
}: {
  freeSegment: FreeSegmentStats;
  poolConfig: PoolConfig | null;
}) {
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
          <span className="text-fg-2 text-sm">未出UP</span>
        )}
      </div>
      
      {/* 说明文字 */}
      <div className="flex-1 text-sm text-fg-1">
        免费十连结果
      </div>
      
      {/* 免费标记 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-green-400">
          {freeCount} 抽
        </span>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
          <Gift size={10} />
          免费
        </span>
      </div>
    </div>
  );
}

/**
 * 进度条组件 - 显示单个6星进度
 */
function PityProgressBar({
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
    return 'bg-orange-500';
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
            <span className="text-fg-2 text-sm">未出</span>
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
          <span className={`text-sm font-medium ${hasSixStar ? 'text-orange-500' : 'text-fg-1'}`}>
            {segment.pulls} 抽
          </span>
        </div>
      </div>

      {showFiveStars && countedFiveStars.length > 0 && (
        <div className="mt-1 pl-36 pr-16">
          <div className="flex flex-wrap items-center gap-1.5">
            {countedFiveStars.slice(0, 14).map((c) => (
              <span key={c.id} className="relative inline-flex" title={`${c.name}（${c.count}）`}>
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
function PoolGroupCard({ group, showFiveStars }: { group: PoolGroupStats; showFiveStars: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [pityExpanded, setPityExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const panelId = `pool-group-${group.poolId}`;
  
  // 构建背景图片路径
  const bgImagePath = `/content/${group.poolId}/up6_image.png`;
  const showBgImage = !imgError;
  
  // 判断是否为限定池
  const isSpecialPool = group.poolId.startsWith('special');

  return (
    <div className="border border-border rounded-md overflow-hidden relative group">
      {/* 背景图片层（不拉伸，保持原始比例，只显示标题区域） */}
      {showBgImage && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none overflow-hidden">
            {/* 背景图片 */}
            <img
              src={bgImagePath}
              alt=""
              className="w-full h-auto object-contain transition-opacity duration-700 ease-out"
              style={{
                objectPosition: 'center top',
                opacity: imgLoaded ? 0.4 : 0,
                minHeight: '120px',
              }}
              onLoad={() => {
                setImgLoaded(true);
              }}
              onError={() => {
                setImgError(true);
              }}
            />
          </div>
          {/* 方案 A：固定遮罩层，保证背景图压暗一致 */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-[120px] pointer-events-none bg-bg-2/0 backdrop-blur-sm transition-colors group-hover:bg-bg-3/0"
          />
        </>
      )}
      
      {/* 池名称和概要 */}
      <button
        className={[
          'relative w-full px-4 py-3 flex items-center justify-between transition-colors',
          showBgImage ? 'bg-transparent' : 'bg-bg-2/80 backdrop-blur-sm hover:bg-bg-3/90',
        ].join(' ')}
        onClick={() => setExpanded(!expanded)}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-fg-0 drop-shadow-sm">{group.poolName}</span>
          <span className="text-sm text-fg-1 drop-shadow-sm">
            共 {group.total} 抽
          </span>
          {group.sixStarCount > 0 && (
            <span className="text-sm text-orange-500 drop-shadow-sm">
              {group.sixStarCount} 个6星
            </span>
          )}
          {!isSpecialPool && group.currentPity > 0 && (
            <span className="text-sm text-purple-500 drop-shadow-sm">
              当前 {group.currentPity} 抽
            </span>
          )}
          {/* 武库配额 */}
          {group.armoryQuota > 0 && (
            <span className="flex items-center gap-1 text-sm text-cyan-400 drop-shadow-sm">
              <img 
                src="/efimg/gameEntryId=930.png" 
                alt="武库配额" 
                className="w-4 h-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-fg-2">累计产出</span>
              {formatArmoryQuota(group.armoryQuota)}
              <HelpTooltip text={CALC_MAY_DIFFER_HINT} />
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-fg-2 transition-transform drop-shadow-sm ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      
      {/* 展开内容 */}
      <div
        id={panelId}
        className="ef-collapse relative"
        data-expanded={expanded ? 'true' : 'false'}
      >
        <div className="ef-collapse__inner relative">
          {/* 内容区背景：从背景图下缘开始铺底，避免再次压暗背景图 */}
          <div
            aria-hidden="true"
            className={[
              'absolute inset-x-0 bottom-0 pointer-events-none',
              showBgImage ? 'top-[120px]' : 'top-0',
              'bg-bg-1/90 backdrop-blur-sm',
            ].join(' ')}
          />
          <div className="relative px-4 pt-6 pb-3 space-y-3">
            {/* 6星进度条列表 */}
            <div className="space-y-1 divide-y divide-border/30">
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

            {/* 限定池当期里程碑（不含免费十连） */}
            {isSpecialPool && group.specialMilestones && (
              <div className="rounded-md border border-border/50 bg-bg-2/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-fg-1">
                    当期累计（不含免费）：
                    <span className="ml-1 font-medium text-fg-0">
                      {group.specialMilestones.nonFreePulls}
                    </span>
                    抽
                  </div>
                  <div className="text-fg-2 text-xs">
                    60/120/240 里程碑按当期独立计算
                  </div>
                </div>

                <div className="mt-2 grid gap-1.5 text-xs text-fg-2">
                  <div className="flex items-center justify-between">
                    <span>60 抽：寻访情报书（一期一次）</span>
                    {group.specialMilestones.hasInfoBook60 ? (
                      <span className="text-green-400 font-medium">已获得</span>
                    ) : (
                      <span className="text-amber-400 font-medium">
                        还差 {group.specialMilestones.pullsToInfoBook60} 抽
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span>120 抽：必得当期UP 6★（一期一次）</span>
                    {group.specialMilestones.hasUp6 ? (
                      <span className="text-green-400 font-medium">已获得UP</span>
                    ) : (
                      <span className="text-purple-400 font-medium">
                        还差 {group.specialMilestones.pullsToUp120} 抽
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span>240 抽：信物（可重复）</span>
                    <span className="text-cyan-400 font-medium">
                      {group.specialMilestones.token240Times} 次
                      {group.specialMilestones.pullsToNextToken240 > 0 && (
                        <span className="text-fg-2 font-normal">
                          （下次还差 {group.specialMilestones.pullsToNextToken240} 抽）
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* 保底状态面板（默认折叠） */}
            <div className="border-t border-border/50 pt-3">
              {isSpecialPool ? (
                <div className="text-xs text-fg-2">
                  6★/5★保底为「特许寻访」跨池继承，已在上方“特许寻访共享保底”卡片中展示；本池卡片仅展示当期里程碑与本池内出货记录。
                </div>
              ) : (
                <>
                  <button
                    className="w-full flex items-center justify-between text-sm font-medium text-fg-0 hover:text-brand transition-colors"
                    onClick={() => setPityExpanded(!pityExpanded)}
                    type="button"
                    aria-expanded={pityExpanded}
                  >
                    <span>保底状态详情</span>
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
 * 固定池（常驻/新手）的展示组件
 */
function FixedPoolCard({
  poolName,
  records,
  showTitle = true,
  showFiveStars,
}: {
  poolName: string;
  records: UnifiedGachaRecord[];
  showTitle?: boolean;
  showFiveStars: boolean;
}) {
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
          <span className="font-medium text-orange-500">{sixStarCount}</span> 个6星
        </span>
        {currentPity > 0 && (
          <span className="text-fg-1">
            当前 <span className="font-medium text-purple-500">{currentPity}</span> 抽
          </span>
        )}
      </div>
      
      {/* 进度条列表（常驻和新手池不显示"歪"标签） */}
      {isLoading ? (
        <div className="text-center py-4 text-fg-2">
          <Loader2 size={24} className="mx-auto animate-spin" />
        </div>
      ) : (
        <div className="space-y-1">
          {segments.map((segment, idx) => (
            <div key={idx} className="py-1.5">
              <div className="flex items-center gap-3">
                {/* 左侧：角色头像（不显示歪标签） */}
                <div className="flex items-center gap-2 w-32 flex-shrink-0">
                  <CharacterAvatar
                    charId={segment.charId}
                    rarity={6}
                    size="md"
                    isUp={false}
                    showOffBanner={false}
                    isEmpty={!segment.sixStar}
                    emptyType="unknown"
                  />
                  {segment.sixStar ? (
                    <span className="text-orange-500 font-medium truncate text-sm">
                      {segment.sixStar.itemName}
                    </span>
                  ) : (
                    <span className="text-fg-2 text-sm">未出</span>
                  )}
                </div>
                
                {/* 进度条 */}
                <div className="flex-1 h-4 bg-bg-3 rounded-sm overflow-hidden relative">
                  <div
                    className={`h-full ${
                      segment.pulls <= 50 ? 'bg-green-500' : 
                      segment.pulls <= 70 ? 'bg-yellow-500' : 
                      'bg-orange-500'
                    } ef-progress-fill`}
                    style={{ 
                      width: `${Math.min((segment.pulls / 80) * 100, 100)}%`,
                      transition: 'width 0.3s ease-out'
                    }}
                  />
                </div>
                
                {/* 抽数 */}
                <div className="w-16 text-right flex-shrink-0">
                  <span className={`text-sm font-medium ${segment.sixStar ? 'text-orange-500' : 'text-fg-1'}`}>
                    {segment.pulls} 抽
                  </span>
                </div>
              </div>

              {showFiveStars && (segment.fiveStars?.length ?? 0) > 0 && (
                <div className="mt-1 pl-36 pr-16">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {groupById(
                      (segment.fiveStars ?? []).map((r) => ({
                        id: r.charId,
                        name: r.itemName,
                        isUp: false,
                      }))
                    )
                      .slice(0, 14)
                      .map((c) => (
                        <span key={c.id} className="relative inline-flex" title={`${c.name}（${c.count}）`}>
                          <CharacterAvatar charId={c.id} rarity={5} size="sm" />
                          <CountBadge count={c.count} />
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
  
  // 顶部面板：累计消耗（按你的口径）
  // - 干员寻访：每抽消耗 嵌晶玉 * 500（免费十连不计）
  // - 武器申领：每次十连申领消耗 武库配额 * 1980（按“申领次数”计；免费不计）
  const CRYSTAL_PER_CHARACTER_PULL = 500;
  const ARMORY_QUOTA_PER_WEAPON_SESSION = 1980;

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
      // 这里传 null：累计消耗仅需要会话数量，不依赖 UP 判断
      totalSessions += aggregateWeaponRecordsToSessions(poolRecords, null).length;
    }
    return totalSessions;
  }, [allRecords]);

  const weaponQuotaConsumedAll = useMemo(() => weaponSessionsAll * ARMORY_QUOTA_PER_WEAPON_SESSION, [weaponSessionsAll]);

  // 特许寻访共享保底（跨 special_* 继承；免费十连不计入）
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
  const [poolGroupedData, setPoolGroupedData] = useState<{
    special: PoolGroupStats[];
    weapon: WeaponPoolGroupStats[];
    standard: UnifiedGachaRecord[];
    beginner: UnifiedGachaRecord[];
  }>({
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
      
      // 武器池（所有武器记录，按池简单分组，不使用复杂的保底计算）
      const weaponPoolRecords = allRecords.filter(
        r => r.category === 'weapon'
      );
      
      // 常驻池（角色，poolId 前缀 standard_*）
      const standardRecords = allRecords.filter(
        r => r.category === 'character' && getPoolTypePrefix(r.poolId) === 'standard'
      );
      
      // 新手池（角色，poolId 前缀 beginner_*）
      const beginnerRecords = allRecords.filter(
        r => r.category === 'character' && getPoolTypePrefix(r.poolId) === 'beginner'
      );

      // 只对限定池进行详细的保底计算
      const special = await groupRecordsByPool(specialRecords);
      
      // 武器池使用简单分组（不计算保底状态等限定池独有逻辑）
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

  // 顶部：限定/武器/常驻三列汇总（按全量记录，不受 categoryFilter 影响）
  // 注意：必须放在任何早返回之前，避免 Hooks 顺序变化
  const poolSummaries = useMemo(() => {
    const specialPoolConfigs = new Map<string, PoolConfig | null>();
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
      // 以“抽”为单位：忽略免费十连（不计保底），按时间正序统计每次 UP 6★ 的间隔抽数
      const sorted = [...specialRecordsAll].sort((a, b) => getTimestamp(a.gachaTs) - getTimestamp(b.gachaTs));
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
      // 以“抽”为单位：忽略免费十连（不计保底），按每个武器池独立统计 UP 6★ 的间隔抽数，再合并取总体均值
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
              <span className="text-fg-2">累计消耗</span>
              {(categoryFilter === 'all' || categoryFilter === 'character') && (
                <span className="flex items-center gap-1.5 text-fg-1 tabular-nums">
                  <img
                    src="/efimg/gameEntryId=926.png"
                    alt="嵌晶玉"
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {characterCrystalConsumedAll.toLocaleString('zh-CN')}
                  <HelpTooltip text={CALC_MAY_DIFFER_HINT} />
                </span>
              )}
              {(categoryFilter === 'all' || categoryFilter === 'weapon') && (
                <span className="flex items-center gap-1.5 text-fg-1 tabular-nums">
                  <img
                    src="/efimg/gameEntryId=930.png"
                    alt="武库配额"
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {weaponQuotaConsumedAll.toLocaleString('zh-CN')}
                  <HelpTooltip text={CALC_MAY_DIFFER_HINT} />
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

          {/* 新增：限定/武器/常驻累计抽数与关键指标 */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <PoolSummaryTile
              title="限定池"
              subtitle={`累计 ${poolSummaries.special.total} 抽`}
              metricLeft={`6★：${poolSummaries.special.six} / 歪：${poolSummaries.special.off}`}
              metricRight={`UP平均：${formatMaybeNumber(poolSummaries.special.upAvg)} 抽`}
              counts={{ 6: poolSummaries.special.counts[6], 5: poolSummaries.special.counts[5], 4: poolSummaries.special.counts[4] }}
              prefersReducedMotion={prefersReducedMotion}
              accentClassName="text-purple-400"
            />

            <PoolSummaryTile
              title="武器池"
              subtitle={`累计 ${poolSummaries.weapon.total} 抽`}
              metricLeft={`6★：${poolSummaries.weapon.six} / 歪：${poolSummaries.weapon.off}`}
              metricRight={`UP平均：${formatMaybeNumber(poolSummaries.weapon.upAvg)} 抽`}
              counts={{ 6: poolSummaries.weapon.counts[6], 5: poolSummaries.weapon.counts[5], 4: poolSummaries.weapon.counts[4] }}
              prefersReducedMotion={prefersReducedMotion}
              accentClassName="text-amber-500"
            />

            <PoolSummaryTile
              title="常驻池"
              subtitle={`累计 ${poolSummaries.standard.total} 抽`}
              metricLeft={`6★：${poolSummaries.standard.six}`}
              metricRight={`6★平均：${formatMaybeNumber(poolSummaries.standard.sixAvg)} 抽`}
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
                    <p>暂无武器池抽卡记录</p>
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
                poolName="常驻池"
                records={poolGroupedData.standard}
                showFiveStars={showFiveStars}
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

function RarityStackBar({
  counts,
  prefersReducedMotion,
  className,
}: {
  counts: Pick<RarityCountMap, 4 | 5 | 6>;
  prefersReducedMotion: boolean;
  className?: string;
}) {
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
    <div ref={wrapRef} className={`relative ${className ?? ''}`} aria-label="6/5/4★分布">
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
          {hover.rarity}★：{hover.count}（{hover.pct.toFixed(2)}%）
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

function PoolSummaryTile({
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
