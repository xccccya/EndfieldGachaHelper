/**
 * 一次性数据迁移脚本
 * 将 localStorage 中的旧数据迁移到 SQLite
 */

import {
  getDB,
  dbSaveAccount,
  dbSaveGachaRecords,
  dbSaveWeaponRecords,
  dbGetAccounts,
  type DBGachaRecord,
  type DBWeaponRecord,
} from '../db';
import { STORAGE_KEYS, LOCAL_DATA_SCHEMA_VERSION } from './constants';
import { notifyStorageChange } from './events';
import { makeAccountKey } from './accounts';
import type { StoredAccount, GachaRecord, WeaponRecord } from './types';

// ============== 辅助函数 ==============

function getLocalDataSchemaVersion(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_SCHEMA_VERSION);
    const v = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}

function setLocalDataSchemaVersion(v: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_SCHEMA_VERSION, String(v));
  } catch {
    // ignore
  }
}

function isMigrationCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.MIGRATION_COMPLETED) === 'true';
  } catch {
    return false;
  }
}

function setMigrationCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MIGRATION_COMPLETED, 'true');
  } catch {
    // ignore
  }
}

/**
 * 分批处理数组
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ============== 主迁移逻辑 ==============

/**
 * 检查是否需要运行迁移
 */
export async function needsMigration(): Promise<boolean> {
  // 已经完成迁移
  if (isMigrationCompleted()) {
    return false;
  }

  // 检查 localStorage 中是否有业务数据
  const hasLocalAccounts = !!localStorage.getItem(STORAGE_KEYS.ACCOUNTS_LEGACY);
  const hasLocalGachaRecords = !!localStorage.getItem(STORAGE_KEYS.GACHA_RECORDS_LEGACY);
  const hasLocalWeaponRecords = !!localStorage.getItem(STORAGE_KEYS.WEAPON_RECORDS_LEGACY);

  if (!hasLocalAccounts && !hasLocalGachaRecords && !hasLocalWeaponRecords) {
    // 没有旧数据，标记为已完成
    setMigrationCompleted();
    return false;
  }

  // 检查 SQLite 中是否已有数据
  const dbAccounts = await dbGetAccounts();
  if (dbAccounts.length > 0) {
    // SQLite 已有数据，可能是部分迁移，继续迁移
    return true;
  }

  return true;
}

/**
 * 从 localStorage 迁移数据到 SQLite
 */
export async function migrateFromLocalStorage(): Promise<{
  accounts: number;
  charRecords: number;
  weaponRecords: number;
}> {
  const result = { accounts: 0, charRecords: 0, weaponRecords: 0 };

  console.log('[migration] 开始从 localStorage 迁移数据到 SQLite...');

  // 迁移账号
  const localAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS_LEGACY);
  if (localAccounts) {
    try {
      const parsed: unknown = JSON.parse(localAccounts);
      const accounts = Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];

      for (const acc of accounts) {
        if (!acc?.uid || !acc?.channelName) continue;
        await dbSaveAccount({
          uid: acc.uid,
          channel_name: acc.channelName,
          roles: JSON.stringify(acc.roles ?? []),
          added_at: acc.addedAt ?? Date.now(),
        });
        result.accounts++;
      }
      console.log(`[migration] 迁移账号: ${result.accounts} 条`);
    } catch (e) {
      console.error('[migration] 迁移账号失败:', e);
    }
  }

  // 迁移角色记录
  const localGachaRecords = localStorage.getItem(STORAGE_KEYS.GACHA_RECORDS_LEGACY);
  if (localGachaRecords) {
    try {
      const parsed: unknown = JSON.parse(localGachaRecords);
      const records = Array.isArray(parsed) ? (parsed as GachaRecord[]) : [];
      const dbRecords: DBGachaRecord[] = [];

      for (const r of records) {
        if (!r?.recordUid || !r?.uid || !r?.seqId) continue;
        dbRecords.push({
          record_uid: r.recordUid,
          uid: r.uid,
          pool_id: r.poolId ?? '',
          pool_name: r.poolName ?? '',
          char_id: r.charId ?? '',
          char_name: r.charName ?? '',
          rarity: r.rarity ?? 0,
          is_new: r.isNew ? 1 : 0,
          is_free: r.isFree ? 1 : 0,
          gacha_ts: r.gachaTs ?? '',
          seq_id: r.seqId,
          fetched_at: r.fetchedAt ?? Date.now(),
          category: 'character',
        });
      }

      // 分批写入
      for (const batch of chunkArray(dbRecords, 200)) {
        result.charRecords += await dbSaveGachaRecords(batch);
      }
      console.log(`[migration] 迁移角色记录: ${result.charRecords} 条`);
    } catch (e) {
      console.error('[migration] 迁移角色记录失败:', e);
    }
  }

  // 迁移武器记录
  const localWeaponRecords = localStorage.getItem(STORAGE_KEYS.WEAPON_RECORDS_LEGACY);
  if (localWeaponRecords) {
    try {
      const parsed: unknown = JSON.parse(localWeaponRecords);
      const records = Array.isArray(parsed) ? (parsed as WeaponRecord[]) : [];
      const dbRecords: DBWeaponRecord[] = [];

      for (const r of records) {
        if (!r?.recordUid || !r?.uid || !r?.seqId) continue;
        dbRecords.push({
          record_uid: r.recordUid,
          uid: r.uid,
          pool_id: r.poolId ?? '',
          pool_name: r.poolName ?? '',
          weapon_id: r.weaponId ?? '',
          weapon_name: r.weaponName ?? '',
          weapon_type: r.weaponType ?? '',
          rarity: r.rarity ?? 0,
          is_new: r.isNew ? 1 : 0,
          gacha_ts: r.gachaTs ?? '',
          seq_id: r.seqId,
          fetched_at: r.fetchedAt ?? Date.now(),
          category: 'weapon',
        });
      }

      // 分批写入
      for (const batch of chunkArray(dbRecords, 200)) {
        result.weaponRecords += await dbSaveWeaponRecords(batch);
      }
      console.log(`[migration] 迁移武器记录: ${result.weaponRecords} 条`);
    } catch (e) {
      console.error('[migration] 迁移武器记录失败:', e);
    }
  }

  return result;
}

/**
 * 清理 localStorage 中的旧业务数据
 */
export function cleanupLegacyLocalStorage(): void {
  console.log('[migration] 清理 localStorage 中的旧业务数据...');
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS_LEGACY);
    localStorage.removeItem(STORAGE_KEYS.GACHA_RECORDS_LEGACY);
    localStorage.removeItem(STORAGE_KEYS.WEAPON_RECORDS_LEGACY);
    console.log('[migration] 清理完成');
  } catch (e) {
    console.error('[migration] 清理失败:', e);
  }
}

/**
 * 迁移账号主键格式（roleKey 迁移）
 * 旧版：uid = hgUid
 * 新版：uid = serverId:roleId
 */
export async function migrateAccountKeyFormat(): Promise<void> {
  const currentVersion = getLocalDataSchemaVersion();
  if (currentVersion >= LOCAL_DATA_SCHEMA_VERSION) {
    return;
  }

  console.log(`[migration] 迁移账号主键格式: v${currentVersion} -> v${LOCAL_DATA_SCHEMA_VERSION}`);

  // 读取 localStorage 中的账号（如果还在）
  const rawAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS_LEGACY);
  if (!rawAccounts) {
    setLocalDataSchemaVersion(LOCAL_DATA_SCHEMA_VERSION);
    return;
  }

  let accounts: StoredAccount[] = [];
  try {
    const parsed: unknown = JSON.parse(rawAccounts);
    accounts = Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch {
    accounts = [];
  }

  // uidMap: oldHgUid -> newAccountKey
  const uidMap = new Map<string, string>();
  const migratedAccounts: StoredAccount[] = [];

  for (const a of accounts) {
    // 已是新格式
    if (a?.hgUid || (typeof a?.uid === 'string' && a.uid.includes(':'))) {
      migratedAccounts.push(a);
      continue;
    }

    const role = a?.roles?.[0];
    if (!role?.roleId || !role?.serverId || typeof a?.uid !== 'string' || !a.uid) {
      migratedAccounts.push(a);
      continue;
    }

    const oldHgUid = a.uid;
    const newUid = makeAccountKey(role.serverId, role.roleId);
    uidMap.set(oldHgUid, newUid);

    migratedAccounts.push({
      ...a,
      uid: newUid,
      hgUid: oldHgUid,
      roleId: role.roleId,
      serverId: role.serverId,
    });
  }

  if (uidMap.size === 0) {
    setLocalDataSchemaVersion(LOCAL_DATA_SCHEMA_VERSION);
    return;
  }

  // 去重
  const dedup = new Map<string, StoredAccount>();
  for (const a of migratedAccounts) {
    if (!a?.uid) continue;
    const existing = dedup.get(a.uid);
    if (!existing) {
      dedup.set(a.uid, a);
      continue;
    }
    const score = (x: StoredAccount) => {
      const rolesScore = (x.roles?.length ?? 0) > 0 ? 1 : 0;
      return rolesScore * 1_000_000_000_000 - (x.addedAt ?? Date.now());
    };
    if (score(a) > score(existing)) dedup.set(a.uid, a);
  }

  const finalAccounts = Array.from(dedup.values());

  // 迁移 activeUid
  const activeUid = localStorage.getItem(STORAGE_KEYS.ACTIVE_UID);
  if (activeUid && uidMap.has(activeUid)) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_UID, uidMap.get(activeUid)!);
  }

  // 更新 SQLite 中的数据
  const database = await getDB();
  for (const [oldHgUid, newUid] of uidMap) {
    const acc = finalAccounts.find((a) => a.hgUid === oldHgUid || a.uid === newUid);
    if (acc) {
      await database.execute(
        `INSERT OR REPLACE INTO accounts (uid, channel_name, roles, added_at) VALUES ($1, $2, $3, $4)`,
        [newUid, acc.channelName, JSON.stringify(acc.roles ?? []), acc.addedAt],
      );
    }
    await database.execute(`DELETE FROM accounts WHERE uid = $1`, [oldHgUid]);

    // 更新记录的 uid 和 record_uid
    await database.execute(
      `UPDATE gacha_records 
       SET uid = $1, record_uid = REPLACE(record_uid, $2, $3)
       WHERE uid = $4`,
      [newUid, `${oldHgUid}_char_`, `${newUid}_char_`, oldHgUid],
    );
    await database.execute(
      `UPDATE weapon_records 
       SET uid = $1, record_uid = REPLACE(record_uid, $2, $3)
       WHERE uid = $4`,
      [newUid, `${oldHgUid}_weapon_`, `${newUid}_weapon_`, oldHgUid],
    );
  }

  setLocalDataSchemaVersion(LOCAL_DATA_SCHEMA_VERSION);
  notifyStorageChange({
    reason: 'migrateAccountKeyFormat',
    keys: ['accounts', 'gachaRecords', 'weaponRecords'],
  });

  console.log(`[migration] 账号主键格式迁移完成，转换了 ${uidMap.size} 个账号`);
}

/**
 * 运行迁移（如果需要）
 * @returns 是否执行了迁移
 */
export async function runMigrationIfNeeded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const shouldMigrate = await needsMigration();
  if (!shouldMigrate) {
    // 仍然检查是否需要 roleKey 迁移
    await migrateAccountKeyFormat();
    return false;
  }

  // 执行迁移
  const result = await migrateFromLocalStorage();
  console.log('[migration] 迁移结果:', result);

  // 执行 roleKey 迁移
  await migrateAccountKeyFormat();

  // 标记迁移完成
  setMigrationCompleted();

  // 清理旧数据
  cleanupLegacyLocalStorage();

  return true;
}
