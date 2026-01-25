/**
 * 云同步相关 Hooks 统一导出
 */

// 数据转换函数
export {
  dbGachaRecordToCloud,
  dbWeaponRecordToCloud,
  cloudToDBGachaRecord,
  cloudToDBWeaponRecord,
} from './converters';

// 配置管理
export {
  getSyncConfig,
  getSyncStatus,
  saveSyncConfig,
  updateSyncConfig,
  subscribeSyncConfig,
  notifyDataChange,
  notifySyncChange,
  markForceFullDownload,
  clearForceFullDownload,
  getForceFullDownloadUids,
  setForceFullDownloadUids,
  ensureLocalAccountExists,
  SYNC_CONFIG_KEY,
  FORCE_FULL_DOWNLOAD_UIDS_KEY,
  AUTO_SYNC_INTERVAL,
  SYNC_CHANGE_EVENT,
  DATA_CHANGE_EVENT,
} from './config';

// Hooks
export { useSyncConfig } from './useSyncConfig';
export { useSyncAuth } from './useSyncAuth';
export { useSyncHealth } from './useSyncHealth';
export { useAutoSync } from './useAutoSync';
export { useCloudSyncStatus } from './useCloudSyncStatus';
