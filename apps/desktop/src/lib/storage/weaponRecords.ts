/**
 * 武器抽卡记录管理
 * 使用 SQLite 作为唯一数据源
 */

import type { EndFieldWeaponInfo } from '@efgachahelper/shared';
import {
  dbGetWeaponRecords,
  dbSaveWeaponRecords,
  dbClearWeaponRecords,
  type DBWeaponRecord,
} from '../db';
import { getTimestamp } from '../dateUtils';
import type { WeaponRecord } from './types';
import { notifyStorageChange } from './events';

// ============== 辅助函数 ==============

/**
 * 生成武器记录的唯一标识符
 */
export function generateWeaponRecordUid(uid: string, record: EndFieldWeaponInfo): string {
  return `${uid}_weapon_${record.seqId}`;
}

// ============== 数据转换 ==============

/**
 * 将 DB 格式转换为 WeaponRecord
 */
function dbRecordToWeaponRecord(dbRecord: DBWeaponRecord): WeaponRecord {
  return {
    uid: dbRecord.uid,
    recordUid: dbRecord.record_uid,
    fetchedAt: dbRecord.fetched_at,
    category: 'weapon',
    poolId: dbRecord.pool_id,
    poolName: dbRecord.pool_name,
    weaponId: dbRecord.weapon_id,
    weaponName: dbRecord.weapon_name,
    weaponType: dbRecord.weapon_type,
    rarity: dbRecord.rarity,
    isNew: dbRecord.is_new === 1,
    gachaTs: dbRecord.gacha_ts,
    seqId: dbRecord.seq_id,
  };
}

/**
 * 将 WeaponRecord 转换为 DB 格式
 */
function weaponRecordToDB(record: WeaponRecord): DBWeaponRecord {
  return {
    record_uid: record.recordUid,
    uid: record.uid,
    pool_id: record.poolId,
    pool_name: record.poolName,
    weapon_id: record.weaponId,
    weapon_name: record.weaponName,
    weapon_type: record.weaponType,
    rarity: record.rarity,
    is_new: record.isNew ? 1 : 0,
    gacha_ts: record.gachaTs,
    seq_id: record.seqId,
    fetched_at: record.fetchedAt,
    category: 'weapon',
  };
}

// ============== 记录 CRUD ==============

/**
 * 获取武器抽卡记录
 * @param uid 可选，指定账号 UID，不传则返回所有记录
 */
export async function getWeaponRecords(uid?: string): Promise<WeaponRecord[]> {
  const dbRecords = await dbGetWeaponRecords(uid);
  return dbRecords.map(dbRecordToWeaponRecord);
}

/**
 * 保存武器抽卡记录（增量添加，自动去重）
 * 使用 INSERT OR IGNORE，已存在的记录会被跳过
 * @param records 要保存的记录
 * @returns 实际新增的记录数量
 */
export async function saveWeaponRecords(records: WeaponRecord[]): Promise<number> {
  const dbRecords = records.map(weaponRecordToDB);
  const added = await dbSaveWeaponRecords(dbRecords);
  notifyStorageChange({ keys: ['weaponRecords'], reason: 'saveWeaponRecords' });
  return added;
}

/**
 * 批量添加武器抽卡记录（自动去重）
 * @param uid 账号 UID
 * @param newRecords 新记录
 * @returns 新增的记录数量
 */
export async function addWeaponRecords(uid: string, newRecords: EndFieldWeaponInfo[]): Promise<number> {
  if (newRecords.length === 0) return 0;

  const now = Date.now();
  const recordsToAdd: WeaponRecord[] = newRecords.map((record) => ({
    ...record,
    uid,
    recordUid: generateWeaponRecordUid(uid, record),
    fetchedAt: now,
    category: 'weapon' as const,
  }));

  // 排序：按时间倒序
  recordsToAdd.sort((a, b) => {
    const timeA = getTimestamp(a.gachaTs);
    const timeB = getTimestamp(b.gachaTs);
    return timeB - timeA;
  });

  const dbRecords = recordsToAdd.map(weaponRecordToDB);
  const added = await dbSaveWeaponRecords(dbRecords);

  if (added > 0) {
    notifyStorageChange({ keys: ['weaponRecords'], reason: 'addWeaponRecords' });
  }

  return added;
}

/**
 * 清除指定 UID 的武器抽卡记录
 */
export async function clearWeaponRecords(uid: string): Promise<void> {
  await dbClearWeaponRecords(uid);
  notifyStorageChange({ keys: ['weaponRecords'], reason: 'clearWeaponRecords' });
}

/**
 * 获取指定账号的武器记录数量
 */
export async function getWeaponRecordCount(uid: string): Promise<number> {
  const records = await dbGetWeaponRecords(uid);
  return records.length;
}

/**
 * 获取最新的武器抽卡记录
 */
export async function getLatestWeaponRecord(uid: string): Promise<WeaponRecord | null> {
  const records = await getWeaponRecords(uid);
  if (records.length === 0) return null;
  // 记录已按 gacha_ts DESC 排序
  return records[0] ?? null;
}
