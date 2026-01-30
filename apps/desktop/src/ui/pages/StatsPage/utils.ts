/**
 * StatsPage 工具函数
 */

import type { UnifiedGachaRecord } from '../../../lib/storage';
import type { PoolConfig } from '../../../lib/poolUtils';
import {
  loadPoolConfig,
  isUpCharacter,
  getCharacterId,
  calculateArmoryQuota,
  calculatePityStatus,
  calculateFreeSegmentStats,
  sortRecordsByTimeAndSeq,
} from '../../../lib/poolUtils';
import type { PitySegment, PoolGroupStats, RarityCountMap, CountedItem } from './types';

/** 缓动函数 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 获取各稀有度数量 */
export function getRarityCounts(records: UnifiedGachaRecord[]): RarityCountMap {
  const result: RarityCountMap = { 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const r of records) {
    if (r.rarity === 3 || r.rarity === 4 || r.rarity === 5 || r.rarity === 6) {
      result[r.rarity] += 1;
    }
  }
  return result;
}

/** 格式化可能为空的数字 */
export function formatMaybeNumber(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

/** 按ID分组并计数 */
export function groupById(items: Array<{ id?: string | undefined; name: string; isUp?: boolean | undefined }>): CountedItem[] {
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

/** 解析武器ID */
export function resolveWeaponId(record: UnifiedGachaRecord, poolConfig: PoolConfig | null): string | undefined {
  if (record.weaponId) return record.weaponId;
  const hit = poolConfig?.pool?.all?.find((x) => x.name === record.itemName);
  return hit?.id;
}

/**
 * 计算单个池的6星进度条数据
 * 将记录按时间排序，每抽到一个6星为一段
 * 返回的 segments 顺序为：新的在前，旧的在后
 * 注意：免费十连不计入保底，所以pulls中不包含免费十连
 */
export function calculatePoolSegments(
  records: UnifiedGachaRecord[], 
  poolConfig: PoolConfig | null
): PitySegment[] {
  if (records.length === 0) return [];

  // 按时间和 seqId 正序排列（最早的在前）用于计算
  const sorted = sortRecordsByTimeAndSeq(records);

  const segments: PitySegment[] = [];
  let currentPulls = 0;
  let currentFiveStars: UnifiedGachaRecord[] = [];

  for (const record of sorted) {
    // 免费十连不计入保底
    if (!record.isFree) {
      currentPulls++;
    }

    // 仅统计非免费段内的 5★（免费十连统一在下方"免费十连结果"中展示）
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
export async function groupRecordsByPool(records: UnifiedGachaRecord[]): Promise<PoolGroupStats[]> {
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
    const specialMilestones = (isSpecialPool && poolConfig)
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
