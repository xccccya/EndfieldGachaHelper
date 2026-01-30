/**
 * 卡池配置工具函数
 * 用于加载池子配置、判断UP角色、计算武库配额等
 */

import type { UnifiedGachaRecord } from './storage';
import { getTimestamp } from './dateUtils';

/** 池子配置数据结构 */
export type PoolConfig = {
  pool: {
    pool_gacha_type: 'char' | 'weapon';
    pool_name: string;
    /**
     * 角色池类型（武器池配置里可能不存在该字段）
     */
    pool_type?: 'special' | 'weapon' | 'standard' | 'beginner';
    up6_name: string;
    up6_image: string;
    /**
     * 角色池字段（武器池配置里可能不存在）
     */
    up5_name?: string;
    up5_image?: string;
    up6_item_name?: string;
    rotate_image?: string;
    ticket_name?: string;
    ticket_ten_name?: string;
    rotate_list?: Array<{ name: string; times: number }>;
    /**
     * 武器池字段（角色池配置里可能不存在）
     */
    link_char_pool_name?: string;
    gift_weapon_name?: string;
    gift_weapon_box_name?: string;
    gift_weapon_reward_name?: string;
    gift_content?: Array<{ type: number; name: string }>;
    all: Array<{
      id: string;
      name: string;
      rarity: number;
      type?: number;
    }>;
  };
};

/** 池子配置缓存 */
const poolConfigCache = new Map<string, PoolConfig | null>();

/**
 * 加载池子配置数据
 * @param poolId 池子ID
 * @returns 池子配置，加载失败返回 null
 */
export async function loadPoolConfig(poolId: string): Promise<PoolConfig | null> {
  // 检查缓存
  if (poolConfigCache.has(poolId)) {
    return poolConfigCache.get(poolId) || null;
  }

  try {
    const response = await fetch(`/content/${poolId}/data.json`);
    if (!response.ok) {
      console.warn(`[poolUtils] 无法加载池子配置: ${poolId}`);
      poolConfigCache.set(poolId, null);
      return null;
    }
    
    const data = await response.json() as { code: number; data: PoolConfig };
    if (data.code === 0 && data.data) {
      poolConfigCache.set(poolId, data.data);
      return data.data;
    }
    
    poolConfigCache.set(poolId, null);
    return null;
  } catch (error) {
    console.error(`[poolUtils] 加载池子配置失败: ${poolId}`, error);
    poolConfigCache.set(poolId, null);
    return null;
  }
}

/**
 * 判断角色是否为UP角色
 * @param itemName 角色名称
 * @param poolConfig 池子配置
 * @returns 是否为UP角色
 */
export function isUpCharacter(itemName: string, poolConfig: PoolConfig | null): boolean {
  if (!poolConfig) return false;
  return poolConfig.pool.up6_name === itemName;
}

/**
 * 判断条目是否为UP（角色/武器通用：均对比配置中的 up6_name）
 */
export function isUpItem(itemName: string, poolConfig: PoolConfig | null): boolean {
  if (!poolConfig) return false;
  return poolConfig.pool.up6_name === itemName;
}

/**
 * 获取角色ID
 * @param itemName 角色名称
 * @param poolConfig 池子配置
 * @returns 角色ID，找不到返回 undefined
 */
export function getCharacterId(itemName: string, poolConfig: PoolConfig | null): string | undefined {
  if (!poolConfig) return undefined;
  const char = poolConfig.pool.all.find(c => c.name === itemName);
  return char?.id;
}

/**
 * 计算武库配额总量
 * 规则：6星2000，5星200，4星20
 * @param records 抽卡记录列表
 * @returns 武库配额总量
 */
export function calculateArmoryQuota(records: UnifiedGachaRecord[]): number {
  let total = 0;
  
  for (const record of records) {
    // 所有记录（包括免费十连）都计入武库配额
    switch (record.rarity) {
      case 6:
        total += 2000;
        break;
      case 5:
        total += 200;
        break;
      case 4:
        total += 20;
        break;
      default:
        break;
    }
  }
  
  return total;
}

/** 保底状态 */
export type PityStatus = {
  /** 距离6星小保底的抽数（最大80） */
  pityTo6Star: number;
  /** 距离5星保底的抽数（最大10） */
  pityTo5Star: number;
  /** 距离UP大保底的抽数（最大120，仅限当前池） */
  pityToUp6Star: number;
  /** 已垫抽数（从上次6星起） */
  currentStreak: number;
  /** 是否在概率提升区（65抽后） */
  isInProbBoostZone: boolean;
  /** 是否已触发小保底 */
  isHardPity: boolean;
  /** 上次6星是否为UP（undefined表示本池还没出过6星） */
  lastSixStarWasUp: boolean | undefined;
  /** 本池是否有6星记录 */
  hasSixStarInPool: boolean;
};

// ==============================
// 通用排序工具
// ==============================

/**
 * 解析 seqId 为数字（用于排序）
 * @param seqId 序列ID字符串
 * @returns 数字形式的 seqId，解析失败返回 NaN
 */
function parseSeqId(seqId: string | undefined): number {
  if (!seqId) return Number.NaN;
  const n = Number(seqId);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * 按时间戳和 seqId 排序记录（时间正序）
 * 
 * 排序规则：
 * 1. 首先按 gachaTs 时间戳升序排列
 * 2. 时间戳相同时，按 seqId 升序排列（保证同一十连内的顺序正确）
 * 3. seqId 也相同时，按 recordUid 字典序排列（兜底）
 * 
 * @param records 待排序的记录列表
 * @returns 排序后的新数组（不修改原数组）
 */
export function sortRecordsByTimeAndSeq(records: UnifiedGachaRecord[]): UnifiedGachaRecord[] {
  return [...records].sort((a, b) => {
    // 1. 按时间戳排序
    const ta = getTimestamp(a.gachaTs);
    const tb = getTimestamp(b.gachaTs);
    if (ta !== tb) return ta - tb;
    
    // 2. 时间戳相同时，按 seqId 排序
    const sa = parseSeqId(a.seqId);
    const sb = parseSeqId(b.seqId);
    if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) {
      return sa - sb;
    }
    
    // 3. seqId 也相同或无效时，按 recordUid 字典序排列
    return a.recordUid.localeCompare(b.recordUid);
  });
}

/**
 * 计算保底状态
 * @param records 抽卡记录列表（同一个池子的记录）
 * @param poolConfig 池子配置
 * @returns 保底状态
 */
export function calculatePityStatus(
  records: UnifiedGachaRecord[],
  poolConfig: PoolConfig | null
): PityStatus {
  // 按时间和 seqId 正序排列（最早的在前，同一十连内按 seqId 顺序）
  const sorted = sortRecordsByTimeAndSeq(records);
  
  let pityTo6Star = 0;
  let pityTo5Star = 0;
  let pityToUp6Star = 0;
  let lastSixStarWasUp: boolean | undefined = undefined;
  let hasSixStarInPool = false;
  
  for (const record of sorted) {
    // 免费十连不计入保底
    if (record.isFree) continue;
    
    pityTo6Star++;
    pityTo5Star++;
    pityToUp6Star++;
    
    // 遇到5星或6星，重置5星保底
    if (record.rarity >= 5) {
      pityTo5Star = 0;
    }
    
    // 遇到6星
    if (record.rarity === 6) {
      hasSixStarInPool = true;
      const isUp = isUpCharacter(record.itemName, poolConfig);
      lastSixStarWasUp = isUp;
      pityTo6Star = 0;
      
      // 如果是UP，重置大保底
      if (isUp) {
        pityToUp6Star = 0;
      }
    }
  }
  
  return {
    pityTo6Star,
    pityTo5Star,
    pityToUp6Star,
    currentStreak: pityTo6Star,
    isInProbBoostZone: pityTo6Star >= 65,
    isHardPity: pityTo6Star >= 80,
    lastSixStarWasUp,
    hasSixStarInPool,
  };
}

/**
 * 计算“特许寻访共享保底”状态（跨 special_* 继承的 6★/5★ 保底）
 * 注意：该口径不涉及 UP 大保底（120），也不做 UP 判断。
 *
 * @param records 抽卡记录列表（通常为所有 special_* 的角色记录，且已排除免费十连）
 */
export function calculateSharedPityStatus(records: UnifiedGachaRecord[]): PityStatus {
  // 按时间和 seqId 正序排列（最早的在前，同一十连内按 seqId 顺序）
  const sorted = sortRecordsByTimeAndSeq(records);

  let pityTo6Star = 0;
  let pityTo5Star = 0;
  let hasSixStarInPool = false;

  for (const record of sorted) {
    // 共享保底也明确不计入免费十连（如果传入数据仍含 free，这里兜底过滤）
    if (record.isFree) continue;

    pityTo6Star++;
    pityTo5Star++;

    // 遇到5星或6星，重置5星保底
    if (record.rarity >= 5) {
      pityTo5Star = 0;
    }

    // 遇到6星，重置6星保底
    if (record.rarity === 6) {
      hasSixStarInPool = true;
      pityTo6Star = 0;
    }
  }

  return {
    pityTo6Star,
    pityTo5Star,
    pityToUp6Star: 0,
    currentStreak: pityTo6Star,
    isInProbBoostZone: pityTo6Star >= 65,
    isHardPity: pityTo6Star >= 80,
    lastSixStarWasUp: undefined,
    hasSixStarInPool,
  };
}

/** 免费十连段统计 */
export type FreeSegmentStats = {
  /** 是否包含免费十连 */
  hasFree: boolean;
  /** 免费十连中的6星（如果有） */
  freeSixStar?: UnifiedGachaRecord | undefined;
  /** 免费十连中的6星是否为UP */
  freeSixStarIsUp: boolean;
  /** 免费十连总抽数 */
  freeCount: number;
};

/**
 * 计算免费十连段统计
 * @param records 抽卡记录列表（同一个池子的记录）
 * @param poolConfig 池子配置
 * @returns 免费十连统计
 */
export function calculateFreeSegmentStats(
  records: UnifiedGachaRecord[],
  poolConfig: PoolConfig | null
): FreeSegmentStats {
  const freeRecords = records.filter(r => r.isFree);
  const freeSixStars = freeRecords.filter(r => r.rarity === 6);
  
  // 取最新的免费6星
  const freeSixStar = freeSixStars.length > 0 
    ? freeSixStars[freeSixStars.length - 1] 
    : undefined;
  
  const freeSixStarIsUp = freeSixStar 
    ? isUpCharacter(freeSixStar.itemName, poolConfig) 
    : false;
  
  return {
    hasFree: freeRecords.length > 0,
    freeSixStar,
    freeSixStarIsUp,
    freeCount: freeRecords.length,
  };
}

/**
 * 格式化武库配额显示
 * @param quota 配额数量
 * @returns 格式化后的字符串
 */
export function formatArmoryQuota(quota: number): string {
  if (quota >= 10000) {
    return `${(quota / 10000).toFixed(1)}万`;
  }
  if (quota >= 1000) {
    return `${(quota / 1000).toFixed(1)}K`;
  }
  return quota.toString();
}

// ==============================
// 武器池（武库）统计
// ==============================

export type WeaponCumulativeRewardType = 'box' | 'up';

export type WeaponDrawSession = {
  /** 第几次申领（从 1 开始，按时间正序） */
  sessionNo: number;
  /** 本次申领时间戳（原始字符串，来自记录） */
  gachaTs: string;
  /** 本次申领产生的武器记录（通常约 10 条；有累计奖励可能>10） */
  records: UnifiedGachaRecord[];
  /** 本次申领获得的 6★ 武器 */
  sixStars: UnifiedGachaRecord[];
  /** 是否获得 6★ 武器 */
  hasSixStar: boolean;
  /** 是否获得当期 UP 6★ 武器 */
  hasUp6: boolean;
  /** 本次是否触发累计奖励 */
  cumulativeReward?: WeaponCumulativeRewardType | undefined;
};

export type WeaponPoolStatus = {
  /** 总申领次数（十连次数） */
  totalSessions: number;
  /** 距上次 6★ 经过的申领次数（0 表示最近一次申领含 6★） */
  sessionsSinceLastSixStar: number;
  /** 距 4 次保底还差多少次申领（0 表示已到/超过阈值） */
  sessionsToSixStarHardPity: number;
  /** 是否已获得当期 UP 6★ */
  hasUp6: boolean;
  /** 距 8 次 UP 保底还差多少次申领（0 表示已到/超过阈值或已获得UP） */
  sessionsToUp6HardPity: number;
  /** 6★ 武器数量 */
  sixStarCount: number;
  /** 当期 UP 6★ 数量 */
  up6Count: number;
  /** 下一次累计奖励 */
  nextCumulativeReward?: {
    type: WeaponCumulativeRewardType;
    atSessionNo: number;
    remainingSessions: number;
  } | undefined;
};

/**
 * 武库累计奖励节奏：
 * - 第 10 次：补充武库箱（box）
 * - 第 18 次：概率提升武器（up）
 * - 之后：每隔 16 次重复（box: 10+16k；up: 18+16k）
 */
export function getWeaponCumulativeRewardTypeAtSession(sessionNo: number): WeaponCumulativeRewardType | undefined {
  if (sessionNo <= 0) return undefined;
  if (sessionNo >= 10 && (sessionNo - 10) % 16 === 0) return 'box';
  if (sessionNo >= 18 && (sessionNo - 18) % 16 === 0) return 'up';
  return undefined;
}

function getNextWeaponCumulativeReward(totalSessions: number): WeaponPoolStatus['nextCumulativeReward'] {
  const nextSessionNo = totalSessions + 1;
  const nextBox = nextSessionNo <= 10
    ? 10
    : 10 + Math.ceil((nextSessionNo - 10) / 16) * 16;
  const nextUp = nextSessionNo <= 18
    ? 18
    : 18 + Math.ceil((nextSessionNo - 18) / 16) * 16;

  const atSessionNo = Math.min(nextBox, nextUp);
  const type: WeaponCumulativeRewardType = atSessionNo === nextBox ? 'box' : 'up';
  return {
    type,
    atSessionNo,
    remainingSessions: Math.max(0, atSessionNo - totalSessions),
  };
}

/**
 * 将武器记录聚合为“十连申领”会话。
 *
 * 说明：武库只能十连申领，保底/累计奖励均按“申领次数”计数。
 * 本函数优先按 gachaTs 聚合；若同一 gachaTs 出现异常多条记录（>11），
 * 则按 10 条为一组拆分为多次申领，并将余数附加到最后一次（用于兼容秒级时间戳碰撞或累计奖励额外条目）。
 */
export function aggregateWeaponRecordsToSessions(
  records: UnifiedGachaRecord[],
  poolConfig: PoolConfig | null
): WeaponDrawSession[] {
  const sorted = sortRecordsByTimeAndSeq(records);
  const byTs: Map<string, UnifiedGachaRecord[]> = new Map();

  for (const r of sorted) {
    const key = r.gachaTs || '';
    if (!byTs.has(key)) byTs.set(key, []);
    byTs.get(key)!.push(r);
  }

  const sessions: Omit<WeaponDrawSession, 'sessionNo'>[] = [];

  // 按时间正序拼接
  const tsKeys = [...byTs.keys()].sort((a, b) => getTimestamp(a) - getTimestamp(b));
  for (const ts of tsKeys) {
    const bucket = byTs.get(ts)!;
    const bucketSorted = sortRecordsByTimeAndSeq(bucket);
    if (bucketSorted.length <= 11) {
      const sixStars = bucketSorted.filter((r) => r.rarity === 6);
      const hasUp6 = poolConfig ? sixStars.some((r) => isUpItem(r.itemName, poolConfig)) : false;
      sessions.push({
        gachaTs: ts,
        records: bucketSorted,
        sixStars,
        hasSixStar: sixStars.length > 0,
        hasUp6,
      });
      continue;
    }

    // 异常：同一时间戳条目过多，按 10 条拆分为多次申领
    const chunks: UnifiedGachaRecord[][] = [];
    for (let i = 0; i < bucketSorted.length; i += 10) {
      chunks.push(bucketSorted.slice(i, i + 10));
    }
    // 将最后一段不足 10 的余数并入上一段（如果存在）
    if (chunks.length >= 2 && chunks[chunks.length - 1]!.length < 10) {
      const tail = chunks.pop()!;
      chunks[chunks.length - 1] = [...chunks[chunks.length - 1]!, ...tail];
    }

    for (const chunk of chunks) {
      const sixStars = chunk.filter((r) => r.rarity === 6);
      const hasUp6 = poolConfig ? sixStars.some((r) => isUpItem(r.itemName, poolConfig)) : false;
      sessions.push({
        gachaTs: ts,
        records: chunk,
        sixStars,
        hasSixStar: sixStars.length > 0,
        hasUp6,
      });
    }
  }

  // 赋值 sessionNo，并补上累计奖励标记
  return sessions.map((s, idx) => {
    const sessionNo = idx + 1;
    return {
      ...s,
      sessionNo,
      cumulativeReward: getWeaponCumulativeRewardTypeAtSession(sessionNo),
    };
  });
}

/**
 * 计算武器池状态（按“申领次数”计数）。
 */
export function calculateWeaponPoolStatus(
  sessions: WeaponDrawSession[],
  poolConfig: PoolConfig | null
): WeaponPoolStatus {
  const totalSessions = sessions.length;
  const sixStarCount = sessions.reduce((sum, s) => sum + s.sixStars.length, 0);
  const up6Count = poolConfig
    ? sessions.reduce((sum, s) => sum + s.sixStars.filter((r) => isUpItem(r.itemName, poolConfig)).length, 0)
    : 0;
  const hasUp6 = up6Count > 0;

  // 距离上次 6★ 的申领次数
  let sessionsSinceLastSixStar = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i]!.hasSixStar) break;
    sessionsSinceLastSixStar++;
  }

  const sessionsToSixStarHardPity = Math.max(0, 4 - sessionsSinceLastSixStar);
  const sessionsToUp6HardPity = hasUp6 ? 0 : Math.max(0, 8 - totalSessions);

  return {
    totalSessions,
    sessionsSinceLastSixStar,
    sessionsToSixStarHardPity,
    hasUp6,
    sessionsToUp6HardPity,
    sixStarCount,
    up6Count,
    nextCumulativeReward: getNextWeaponCumulativeReward(totalSessions),
  };
}
