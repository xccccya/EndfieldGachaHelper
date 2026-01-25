/**
 * 统一记录查询 + 统计计算
 */

import type { GachaCategory } from '@efgachahelper/shared';
import { getTimestamp } from '../dateUtils';
import type { GachaRecord, WeaponRecord, UnifiedGachaRecord, GachaStats } from './types';
import { getGachaRecords } from './gachaRecords';
import { getWeaponRecords } from './weaponRecords';

// ============== 统一记录转换 ==============

/**
 * 将角色记录转换为统一格式
 */
export function charRecordToUnified(record: GachaRecord): UnifiedGachaRecord {
  return {
    uid: record.uid,
    recordUid: record.recordUid,
    fetchedAt: record.fetchedAt,
    category: 'character',
    poolId: record.poolId,
    poolName: record.poolName,
    rarity: record.rarity,
    isNew: record.isNew,
    gachaTs: record.gachaTs,
    seqId: record.seqId,
    charId: record.charId,
    charName: record.charName,
    isFree: record.isFree,
    itemName: record.charName,
  };
}

/**
 * 将武器记录转换为统一格式
 */
export function weaponRecordToUnified(record: WeaponRecord): UnifiedGachaRecord {
  return {
    uid: record.uid,
    recordUid: record.recordUid,
    fetchedAt: record.fetchedAt,
    category: 'weapon',
    poolId: record.poolId,
    poolName: record.poolName,
    rarity: record.rarity,
    isNew: record.isNew,
    gachaTs: record.gachaTs,
    seqId: record.seqId,
    weaponId: record.weaponId,
    weaponName: record.weaponName,
    weaponType: record.weaponType,
    itemName: record.weaponName,
  };
}

// ============== 统一记录查询 ==============

/**
 * 获取统一格式的所有抽卡记录（角色 + 武器）
 * @param uid 可选，指定账号 UID
 */
export async function getAllUnifiedRecords(uid?: string): Promise<UnifiedGachaRecord[]> {
  const [charRecords, weaponRecords] = await Promise.all([
    getGachaRecords(uid),
    getWeaponRecords(uid),
  ]);

  const all = [
    ...charRecords.map(charRecordToUnified),
    ...weaponRecords.map(weaponRecordToUnified),
  ];

  // 按时间排序（最新的在前）
  all.sort((a, b) => {
    const timeA = getTimestamp(a.gachaTs);
    const timeB = getTimestamp(b.gachaTs);
    return timeB - timeA;
  });

  return all;
}

// ============== 卡池类型判断 ==============

/**
 * 从 poolId 中提取卡池类型前缀
 * 角色池 poolId 格式如: special_1_0_1, standard_1_0_1, beginner_1_0_1
 * 武器池 poolId 格式如: weponbox_1_0_1, weaponbox_constant_2
 */
export function getPoolTypePrefix(poolId: string): string {
  return poolId?.toLowerCase().split('_')[0] || '';
}

/**
 * 判断是否为武器池
 * 武器池 poolId 以 weponbox 或 weaponbox 开头
 */
export function isWeaponPool(poolId: string): boolean {
  const prefix = getPoolTypePrefix(poolId);
  return prefix === 'weponbox' || prefix === 'weaponbox';
}

// ============== 统计计算 ==============

/**
 * 计算统一记录的统计信息
 */
export function calculateUnifiedStats(records: UnifiedGachaRecord[], options?: {
  category?: GachaCategory;
  poolType?: string;
}): GachaStats {
  let filtered = records;

  // 按类别筛选
  if (options?.category) {
    filtered = filtered.filter((r) => r.category === options.category);
  }

  // 按卡池类型筛选
  if (options?.poolType) {
    const poolType = options.poolType.toLowerCase();
    filtered = filtered.filter((r) => {
      const prefix = getPoolTypePrefix(r.poolId);
      return prefix === poolType || r.poolName.includes(options.poolType!);
    });
  }

  const byRarity: Record<number, number> = {};
  const byPool: Record<string, number> = {};
  let last6Star: UnifiedGachaRecord | undefined;
  let pity = 0;

  // 按时间正序计算保底
  const sorted = [...filtered].sort((a, b) => {
    const timeA = getTimestamp(a.gachaTs);
    const timeB = getTimestamp(b.gachaTs);
    return timeA - timeB;
  });

  for (const record of sorted) {
    byRarity[record.rarity] = (byRarity[record.rarity] || 0) + 1;
    byPool[record.poolName] = (byPool[record.poolName] || 0) + 1;

    pity++;
    if (record.rarity === 6) {
      last6Star = record;
      pity = 0;
    }
  }

  return {
    total: filtered.length,
    byRarity,
    byPool,
    last6Star,
    pity,
  };
}

/** @deprecated Use calculateUnifiedStats with UnifiedGachaRecord instead */
export function calculateStats(records: GachaRecord[], poolType?: string): GachaStats {
  const unified = records.map(charRecordToUnified);
  return calculateUnifiedStats(unified, poolType ? { poolType } : undefined);
}

/**
 * 异步计算统计信息（从数据库获取数据）
 */
export async function getStats(uid: string, options?: {
  category?: GachaCategory;
  poolType?: string;
}): Promise<GachaStats> {
  const records = await getAllUnifiedRecords(uid);
  return calculateUnifiedStats(records, options);
}
