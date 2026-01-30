/**
 * 角色抽卡记录管理
 * 使用 SQLite 作为唯一数据源
 */

import type { EndFieldCharInfo } from '@efgachahelper/shared';
import {
  dbGetGachaRecords,
  dbSaveGachaRecords,
  dbClearGachaRecords,
  type DBGachaRecord,
} from '../db';
import { getTimestamp } from '../dateUtils';
import type { GachaRecord } from './types';
import { notifyStorageChange } from './events';

// ============== 辅助函数 ==============

/**
 * 生成角色记录的唯一标识符
 * 基于 uid + category + seqId 生成，确保同一条记录不会重复存储
 */
export function generateCharRecordUid(uid: string, record: EndFieldCharInfo): string {
  return `${uid}_char_${record.seqId}`;
}

/** @deprecated Use generateCharRecordUid instead */
export const generateRecordUid = generateCharRecordUid;

// ============== 数据转换 ==============

/**
 * 将 DB 格式转换为 GachaRecord
 */
function dbRecordToGachaRecord(dbRecord: DBGachaRecord): GachaRecord {
  return {
    uid: dbRecord.uid,
    recordUid: dbRecord.record_uid,
    fetchedAt: dbRecord.fetched_at,
    category: 'character',
    poolId: dbRecord.pool_id,
    poolName: dbRecord.pool_name,
    charId: dbRecord.char_id,
    charName: dbRecord.char_name,
    rarity: dbRecord.rarity,
    isNew: dbRecord.is_new === 1,
    isFree: dbRecord.is_free === 1,
    gachaTs: dbRecord.gacha_ts,
    seqId: dbRecord.seq_id,
  };
}

/**
 * 将 GachaRecord 转换为 DB 格式
 */
function gachaRecordToDB(record: GachaRecord): DBGachaRecord {
  return {
    record_uid: record.recordUid,
    uid: record.uid,
    pool_id: record.poolId,
    pool_name: record.poolName,
    char_id: record.charId,
    char_name: record.charName,
    rarity: record.rarity,
    is_new: record.isNew ? 1 : 0,
    is_free: record.isFree ? 1 : 0,
    gacha_ts: record.gachaTs,
    seq_id: record.seqId,
    fetched_at: record.fetchedAt,
    category: 'character',
  };
}

// ============== 记录 CRUD ==============

/**
 * 获取角色抽卡记录
 * @param uid 可选，指定账号 UID，不传则返回所有记录
 */
export async function getGachaRecords(uid?: string): Promise<GachaRecord[]> {
  const dbRecords = await dbGetGachaRecords(uid);
  return dbRecords.map(dbRecordToGachaRecord);
}

/**
 * 保存角色抽卡记录（增量添加，自动去重）
 * 使用 INSERT OR IGNORE，已存在的记录会被跳过
 * @param records 要保存的记录
 * @returns 实际新增的记录数量
 */
export async function saveGachaRecords(records: GachaRecord[]): Promise<number> {
  const dbRecords = records.map(gachaRecordToDB);
  const added = await dbSaveGachaRecords(dbRecords);
  notifyStorageChange({ keys: ['gachaRecords'], reason: 'saveGachaRecords' });
  return added;
}

/**
 * 批量添加角色抽卡记录（自动去重）
 * @param uid 账号 UID
 * @param newRecords 新记录
 * @returns 新增的记录数量
 */
export async function addGachaRecords(uid: string, newRecords: EndFieldCharInfo[]): Promise<number> {
  if (newRecords.length === 0) return 0;

  const now = Date.now();
  const recordsToAdd: GachaRecord[] = newRecords.map((record) => ({
    ...record,
    uid,
    recordUid: generateCharRecordUid(uid, record),
    fetchedAt: now,
    category: 'character' as const,
  }));

  // 排序：按时间和 seqId 倒序
  recordsToAdd.sort((a, b) => {
    const timeA = getTimestamp(a.gachaTs);
    const timeB = getTimestamp(b.gachaTs);
    if (timeA !== timeB) return timeB - timeA;
    
    // 时间相同时，按 seqId 倒序
    const seqA = Number(a.seqId);
    const seqB = Number(b.seqId);
    if (Number.isFinite(seqA) && Number.isFinite(seqB)) {
      return seqB - seqA;
    }
    return 0;
  });

  const dbRecords = recordsToAdd.map(gachaRecordToDB);
  const added = await dbSaveGachaRecords(dbRecords);

  if (added > 0) {
    notifyStorageChange({ keys: ['gachaRecords'], reason: 'addGachaRecords' });
  }

  return added;
}

/**
 * 清除指定 UID 的角色抽卡记录
 */
export async function clearGachaRecords(uid: string): Promise<void> {
  await dbClearGachaRecords(uid);
  notifyStorageChange({ keys: ['gachaRecords'], reason: 'clearGachaRecords' });
}

/**
 * 获取指定账号的角色记录数量
 */
export async function getGachaRecordCount(uid: string): Promise<number> {
  const records = await dbGetGachaRecords(uid);
  return records.length;
}

/**
 * 获取最新的角色抽卡记录
 */
export async function getLatestGachaRecord(uid: string): Promise<GachaRecord | null> {
  const records = await getGachaRecords(uid);
  if (records.length === 0) return null;
  // 记录已按 gacha_ts DESC 排序
  return records[0] ?? null;
}
