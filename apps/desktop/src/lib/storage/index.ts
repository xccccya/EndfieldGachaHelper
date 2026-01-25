/**
 * Storage 模块统一入口
 * 
 * 重构后的存储架构：
 * - SQLite 作为唯一业务数据源（账号、角色抽卡记录、武器抽卡记录）
 * - localStorage 仅保留用户偏好（token、activeUid）
 */

import { getDB, cleanupLocalDuplicates } from '../db';
import { runMigrationIfNeeded } from './migration';

// ============== 初始化 ==============

/**
 * 初始化存储系统
 * 在应用启动时调用
 */
export async function initStorage(): Promise<{
  migrated: boolean;
  cleanedUp: { charDeleted: number; weaponDeleted: number };
}> {
  try {
    // 1. 初始化 SQLite
    await getDB();
    console.log('[storage] SQLite 初始化成功');

    // 2. 检查是否需要一次性迁移（旧 localStorage 数据 → SQLite）
    const migrated = await runMigrationIfNeeded();
    if (migrated) {
      console.log('[storage] 已完成 localStorage → SQLite 迁移');
    }

    // 3. 清理重复记录
    const cleanupResult = await cleanupLocalDuplicates();
    if (cleanupResult.charDeleted > 0 || cleanupResult.weaponDeleted > 0) {
      console.log(
        `[storage] 已清理本地重复记录: 角色 ${cleanupResult.charDeleted} 条, 武器 ${cleanupResult.weaponDeleted} 条`
      );
    }

    return { migrated, cleanedUp: cleanupResult };
  } catch (e) {
    console.error('[storage] 初始化失败:', e);
    throw e;
  }
}

// ============== 类型导出 ==============

export type {
  StoredAccount,
  GachaRecord,
  WeaponRecord,
  UnifiedGachaRecord,
  GachaStats,
  ExportData,
  ExportDataV1,
  StorageChangeDetail,
} from './types';

// ============== 常量导出 ==============

export { STORAGE_KEYS, LOCAL_DATA_SCHEMA_VERSION } from './constants';

// ============== 事件导出 ==============

export {
  STORAGE_CHANGE_EVENT,
  notifyStorageChange,
  subscribeStorageChange,
} from './events';

// ============== 用户偏好导出 ==============

export type { CloseBehavior } from './preferences';

export {
  saveToken,
  getToken,
  clearToken,
  getActiveUid,
  setActiveUid,
  clearActiveUid,
  getCloseBehavior,
  setCloseBehavior,
  clearCloseBehavior,
  getSidebarCollapsed,
  setSidebarCollapsed,
  clearSidebarCollapsed,
} from './preferences';

// ============== 账号管理导出 ==============

export {
  makeAccountKey,
  parseAccountKey,
  getAccountRoleId,
  getAccountServerId,
  getAccountHgUid,
  getAccounts,
  saveAccount,
  saveAccounts,
  removeAccount,
  addAccountsFromBinding,
  ensureAccountExists,
  getAccountByUid,
  getActiveAccount,
  selectAccount,
} from './accounts';

// ============== 角色抽卡记录导出 ==============

export {
  generateCharRecordUid,
  generateRecordUid, // deprecated alias
  getGachaRecords,
  saveGachaRecords,
  addGachaRecords,
  clearGachaRecords,
  getGachaRecordCount,
  getLatestGachaRecord,
} from './gachaRecords';

// ============== 武器抽卡记录导出 ==============

export {
  generateWeaponRecordUid,
  getWeaponRecords,
  saveWeaponRecords,
  addWeaponRecords,
  clearWeaponRecords,
  getWeaponRecordCount,
  getLatestWeaponRecord,
} from './weaponRecords';

// ============== 统一记录导出 ==============

export {
  charRecordToUnified,
  weaponRecordToUnified,
  getAllUnifiedRecords,
  getPoolTypePrefix,
  isWeaponPool,
  calculateUnifiedStats,
  calculateStats, // deprecated
  getStats,
} from './unifiedRecords';

// ============== JSON 导出导入 ==============

export {
  exportData,
  importData,
} from './exportJson';

// ============== CSV 导出导入 ==============

export {
  exportGachaRecordsToCSV,
  exportWeaponRecordsToCSV,
  exportAllRecordsToCSV,
  importRecordsFromCSV,
} from './exportCsv';

// ============== 迁移导出 ==============

export {
  needsMigration,
  runMigrationIfNeeded,
} from './migration';
