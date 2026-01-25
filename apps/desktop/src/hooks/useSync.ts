/**
 * 云同步状态管理 Hook
 * 
 * 此文件已重构拆分至 ./sync/ 目录，这里仅保留重导出以保持向后兼容
 * 
 * 新的模块结构：
 * - ./sync/converters.ts  - 数据转换函数 (DB ↔ Cloud)
 * - ./sync/config.ts      - 配置管理和工具函数
 * - ./sync/useSyncConfig.ts - 配置状态 Hook
 * - ./sync/useSyncAuth.ts   - 认证操作 Hook
 * - ./sync/useSyncHealth.ts - API 健康检查 Hook
 * - ./sync/useAutoSync.ts   - 自动同步 Hook
 * - ./sync/useCloudSyncStatus.ts - 云端状态 Hook
 */

// 重导出所有内容
export {
  // 数据转换函数
  dbGachaRecordToCloud,
  dbWeaponRecordToCloud,
  cloudToDBGachaRecord,
  cloudToDBWeaponRecord,
  // 配置管理
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
  // Hooks
  useSyncConfig,
  useSyncAuth,
  useSyncHealth,
  useAutoSync,
  useCloudSyncStatus,
} from './sync';
