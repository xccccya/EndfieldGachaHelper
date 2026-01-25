/**
 * 同步配置管理
 * 包含配置读写、事件通知、辅助函数
 */

import type { SyncConfig, SyncStatus } from '@efgachahelper/shared';
import { DEFAULT_SYNC_CONFIG } from '@efgachahelper/shared';
import {
  getAccounts,
  saveAccount,
  type StoredAccount,
  makeAccountKey,
} from '../../lib/storage';

// ============== 存储 key ==============

export const SYNC_CONFIG_KEY = 'efgh_sync_config';
// 当用户清空本地记录后，下一次对指定 uid 强制全量下载（一次性）
export const FORCE_FULL_DOWNLOAD_UIDS_KEY = 'efgh_sync_force_full_download_uids';

// ============== 常量 ==============

// 自动同步间隔（毫秒）
export const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 分钟

// ============== 内存缓存 ==============

let syncConfigCache: SyncConfig | null = null;

// ============== 事件通知 ==============

export const SYNC_CHANGE_EVENT = 'efgh:sync_change';
export const DATA_CHANGE_EVENT = 'efgh:data_change';

export const notifySyncChange = () => {
  window.dispatchEvent(new CustomEvent(SYNC_CHANGE_EVENT));
};

/**
 * 数据变化通知（供其他组件在数据变化时调用）
 */
export const notifyDataChange = () => {
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT));
};

// ============== 强制全量下载 UID 管理 ==============

export function getForceFullDownloadUids(): Set<string> {
  try {
    const raw = localStorage.getItem(FORCE_FULL_DOWNLOAD_UIDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed) ? parsed : [];
    const uids = arr.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    return new Set(uids);
  } catch {
    return new Set();
  }
}

export function setForceFullDownloadUids(uids: Set<string>): void {
  try {
    localStorage.setItem(FORCE_FULL_DOWNLOAD_UIDS_KEY, JSON.stringify(Array.from(uids)));
  } catch {
    // ignore
  }
}

/**
 * 标记某个 uid 下一次云端下载走"全量"模式（一次性）。
 * 用于：用户清空本地记录后，避免增量下载 since 过滤导致 0/0。
 */
export function markForceFullDownload(uid: string): void {
  if (!uid) return;
  const uids = getForceFullDownloadUids();
  uids.add(uid);
  setForceFullDownloadUids(uids);
}

export function clearForceFullDownload(uid: string): void {
  if (!uid) return;
  const uids = getForceFullDownloadUids();
  if (!uids.has(uid)) return;
  uids.delete(uid);
  setForceFullDownloadUids(uids);
}

// ============== 配置读写 ==============

/**
 * 获取同步配置
 */
export function getSyncConfig(): SyncConfig {
  if (syncConfigCache) return syncConfigCache;
  
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) {
      syncConfigCache = JSON.parse(raw) as SyncConfig;
      return syncConfigCache;
    }
  } catch (e) {
    console.error('Failed to parse sync config:', e);
  }
  
  return DEFAULT_SYNC_CONFIG;
}

/**
 * 保存同步配置
 */
export function saveSyncConfig(config: SyncConfig): void {
  syncConfigCache = config;
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  notifySyncChange();
}

/**
 * 更新部分同步配置
 */
export function updateSyncConfig(partial: Partial<SyncConfig>): void {
  const current = getSyncConfig();
  saveSyncConfig({ ...current, ...partial });
}

/**
 * 订阅同步配置变化
 */
export function subscribeSyncConfig(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(SYNC_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SYNC_CHANGE_EVENT, handler);
}

/**
 * 获取同步状态
 */
export function getSyncStatus(config: SyncConfig): SyncStatus {
  if (!config.user || !config.accessToken) {
    return 'not_logged_in';
  }
  if (config.syncError) {
    return 'error';
  }
  if (!config.autoSync) {
    return 'disabled';
  }
  return 'enabled';
}

// ============== 账号辅助函数 ==============

/**
 * 确保本地账号记录存在
 * 用于云同步下载时，在保存抽卡记录前创建对应的账号记录
 */
export async function ensureLocalAccountExists(uid: string, region: string): Promise<string> {
  const existingAccounts = await getAccounts();
  // 新版云同步：uid=roleId, region=serverId
  // 旧版兼容：uid=hgUid, region='default'
  const localUid =
    region && region !== 'default' ? makeAccountKey(region, uid) : uid;
  const accountExists = existingAccounts.some((a) => a.uid === localUid);
  
  if (accountExists) {
    return localUid;
  }
  
  // 创建最小化的账号记录
  const newAccount: StoredAccount = {
    uid: localUid,
    channelName: region === 'default' ? '云同步恢复' : `云同步恢复 · ${region}`,
    ...(region === 'default' ? { hgUid: uid } : {}),
    ...(region === 'default' ? {} : { roleId: uid, serverId: region }),
    roles: [], // 云端没有角色详情，需要用户重新通过 Token 获取
    addedAt: Date.now(),
  };
  
  await saveAccount(newAccount);
  console.log(`[Sync] 已创建本地账号记录: ${localUid}`);
  return localUid;
}
