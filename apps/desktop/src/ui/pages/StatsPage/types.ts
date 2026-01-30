/**
 * StatsPage 类型定义
 */

import type { UnifiedGachaRecord } from '../../../lib/storage';
import type { PoolConfig, PityStatus, FreeSegmentStats, WeaponDrawSession, WeaponPoolStatus } from '../../../lib/poolUtils';

/** 卡池类型标签 */
export type PoolTab = 'special' | 'weapon' | 'standard' | 'beginner';

/** 卡池标签名称 */
export const POOL_TAB_LABEL_KEYS: Record<PoolTab, string> = {
  special: 'stats.ui.poolTabs.special',
  weapon: 'stats.ui.poolTabs.weapon',
  standard: 'stats.ui.poolTabs.standard',
  beginner: 'stats.ui.poolTabs.beginner',
};

/** 6星进度条段 - 记录抽到6星的过程 */
export type PitySegment = {
  pulls: number;          // 抽数（不含免费十连）
  sixStar?: UnifiedGachaRecord | undefined; // 抽到的6星（如果有）
  charId?: string | undefined;        // 角色ID
  isUp?: boolean | undefined;         // 是否为UP角色
  /** 本段内的 5★ 条目（用于"展示 5 星"） */
  fiveStars?: UnifiedGachaRecord[] | undefined;
  isFree?: boolean | undefined;       // 是否包含免费十连（已弃用）
  freeCount?: number | undefined;     // 免费十连抽数（已弃用）
};

/** 分池统计数据 */
export type SpecialMilestones = {
  /** 当期累计抽数（不含免费十连） */
  nonFreePulls: number;
  /** 是否已获得当期UP 6星 */
  hasUp6: boolean;
  /** 距离当期UP大保底（120抽）还差多少抽（不含免费十连） */
  pullsToUp120: number;
  /** 是否已获得"寻访情报书"（60抽里程碑，一期一次；不含免费十连） */
  hasInfoBook60: boolean;
  /** 距离 60 还差多少抽（不含免费十连） */
  pullsToInfoBook60: number;
  /** 240 信物次数（不含免费十连） */
  token240Times: number;
  /** 距离下一次 240 还差多少抽（不含免费十连） */
  pullsToNextToken240: number;
};

export type PoolGroupStats = {
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

export type WeaponPoolGroupStats = {
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

export type RarityCountMap = Record<3 | 4 | 5 | 6, number>;

export type CountedItem = {
  id: string;
  name: string;
  count: number;
  isUp?: boolean | undefined;
};

/** 池分组数据 */
export type PoolGroupedData = {
  special: PoolGroupStats[];
  weapon: WeaponPoolGroupStats[];
  standard: UnifiedGachaRecord[];
  beginner: UnifiedGachaRecord[];
};

/** 池汇总数据 */
export type PoolSummaries = {
  special: {
    total: number;
    six: number;
    up: number;
    off: number;
    upAvg: number | null;
    counts: RarityCountMap;
  };
  weapon: {
    total: number;
    six: number;
    up: number;
    off: number;
    upAvg: number | null;
    counts: RarityCountMap;
  };
  standard: {
    total: number;
    six: number;
    sixAvg: number | null;
    counts: RarityCountMap;
  };
};
