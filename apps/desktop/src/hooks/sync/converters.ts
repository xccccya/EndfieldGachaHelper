/**
 * 数据转换函数
 * 处理 DB ↔ Cloud 格式转换
 */

import type { CloudGachaRecord } from '@efgachahelper/shared';
import type { DBGachaRecord, DBWeaponRecord } from '../../lib/db';

/**
 * 将本地角色记录转换为云端格式
 */
export function dbGachaRecordToCloud(record: DBGachaRecord): CloudGachaRecord {
  return {
    recordUid: record.record_uid,
    category: 'character',
    poolId: record.pool_id,
    poolName: record.pool_name,
    itemId: record.char_id,
    itemName: record.char_name,
    rarity: record.rarity,
    isNew: record.is_new === 1,
    gachaTs: record.gacha_ts,
    seqId: record.seq_id,
    fetchedAt: record.fetched_at,
    isFree: record.is_free === 1,
  };
}

/**
 * 将本地武器记录转换为云端格式
 */
export function dbWeaponRecordToCloud(record: DBWeaponRecord): CloudGachaRecord {
  return {
    recordUid: record.record_uid,
    category: 'weapon',
    poolId: record.pool_id,
    poolName: record.pool_name,
    itemId: record.weapon_id,
    itemName: record.weapon_name,
    rarity: record.rarity,
    isNew: record.is_new === 1,
    gachaTs: record.gacha_ts,
    seqId: record.seq_id,
    fetchedAt: record.fetched_at,
    weaponType: record.weapon_type,
  };
}

/**
 * 将云端记录转换为本地角色格式
 */
export function cloudToDBGachaRecord(record: CloudGachaRecord, uid: string): DBGachaRecord {
  return {
    // 以本地 uid + seqId 生成稳定的 record_uid，避免云端旧 recordUid 格式导致重复
    record_uid: `${uid}_char_${record.seqId}`,
    uid,
    pool_id: record.poolId,
    pool_name: record.poolName,
    char_id: record.itemId,
    char_name: record.itemName,
    rarity: record.rarity,
    is_new: record.isNew ? 1 : 0,
    is_free: record.isFree ? 1 : 0,
    gacha_ts: record.gachaTs,
    seq_id: record.seqId,
    fetched_at: record.fetchedAt,
    category: 'character',
  };
}

/**
 * 将云端记录转换为本地武器格式
 */
export function cloudToDBWeaponRecord(record: CloudGachaRecord, uid: string): DBWeaponRecord {
  return {
    record_uid: `${uid}_weapon_${record.seqId}`,
    uid,
    pool_id: record.poolId,
    pool_name: record.poolName,
    weapon_id: record.itemId,
    weapon_name: record.itemName,
    weapon_type: record.weaponType ?? '',
    rarity: record.rarity,
    is_new: record.isNew ? 1 : 0,
    gacha_ts: record.gachaTs,
    seq_id: record.seqId,
    fetched_at: record.fetchedAt,
    category: 'weapon',
  };
}
