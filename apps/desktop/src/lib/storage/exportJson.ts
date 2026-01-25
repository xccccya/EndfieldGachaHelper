/**
 * JSON 导出/导入
 */

import type { ExportData, ExportDataV1, StoredAccount, GachaRecord, WeaponRecord } from './types';
import { getAccounts, saveAccounts } from './accounts';
import { getGachaRecords, saveGachaRecords } from './gachaRecords';
import { getWeaponRecords, saveWeaponRecords } from './weaponRecords';
import { notifyStorageChange } from './events';

/**
 * 导出数据为 JSON 格式
 */
export async function exportData(): Promise<ExportData> {
  const [accounts, records, weaponRecords] = await Promise.all([
    getAccounts(),
    getGachaRecords(),
    getWeaponRecords(),
  ]);

  return {
    schemaVersion: 2,
    exportedAt: Date.now(),
    accounts,
    records,
    weaponRecords,
  };
}

/**
 * 从 JSON 导入数据
 * @returns 导入结果统计
 */
export async function importData(data: ExportData | ExportDataV1): Promise<{
  accounts: number;
  charRecords: number;
  weaponRecords: number;
}> {
  // 合并账号
  const existingAccounts = await getAccounts();
  const accountMap = new Map<string, StoredAccount>(
    existingAccounts.map((a) => [a.uid, a])
  );
  
  for (const account of data.accounts) {
    if (!accountMap.has(account.uid)) {
      accountMap.set(account.uid, account);
    }
  }
  await saveAccounts(Array.from(accountMap.values()));

  // 合并角色记录
  const existingCharRecords = await getGachaRecords();
  const charRecordMap = new Map<string, GachaRecord>(
    existingCharRecords.map((r) => [r.recordUid, r])
  );
  
  let newCharRecords = 0;
  for (const record of data.records) {
    if (!charRecordMap.has(record.recordUid)) {
      charRecordMap.set(record.recordUid, { ...record, category: 'character' });
      newCharRecords++;
    }
  }
  await saveGachaRecords(Array.from(charRecordMap.values()));

  // 合并武器记录（仅 v2 格式）
  let newWeaponRecords = 0;
  if ('weaponRecords' in data && data.weaponRecords) {
    const existingWeaponRecords = await getWeaponRecords();
    const weaponRecordMap = new Map<string, WeaponRecord>(
      existingWeaponRecords.map((r) => [r.recordUid, r])
    );
    
    for (const record of data.weaponRecords) {
      if (!weaponRecordMap.has(record.recordUid)) {
        weaponRecordMap.set(record.recordUid, { ...record, category: 'weapon' });
        newWeaponRecords++;
      }
    }
    await saveWeaponRecords(Array.from(weaponRecordMap.values()));
  }

  notifyStorageChange({ reason: 'importData', keys: ['accounts', 'gachaRecords', 'weaponRecords'] });

  return {
    accounts: data.accounts.length,
    charRecords: newCharRecords,
    weaponRecords: newWeaponRecords,
  };
}
