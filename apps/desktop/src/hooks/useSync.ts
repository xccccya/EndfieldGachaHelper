/**
 * 云同步状态管理 Hook
 * 处理同步账号的登录、登出、状态管理和数据同步
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { SyncConfig, SyncStatus, CloudGachaRecord } from '@efgachahelper/shared';
import { DEFAULT_SYNC_CONFIG } from '@efgachahelper/shared';
import { syncApi, SyncApiError } from '../lib/syncApi';
import {
  dbGetAccounts,
  dbGetGachaRecords,
  dbGetWeaponRecords,
  dbSaveGachaRecords,
  dbSaveWeaponRecords,
  type DBGachaRecord,
  type DBWeaponRecord,
} from '../lib/db';

// 存储 key
const SYNC_CONFIG_KEY = 'efgh_sync_config';

// 自动同步间隔（毫秒）
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 分钟

// 内存缓存
let syncConfigCache: SyncConfig | null = null;

// 事件通知
const SYNC_CHANGE_EVENT = 'efgh:sync_change';
const DATA_CHANGE_EVENT = 'efgh:data_change';
const notifySyncChange = () => {
  window.dispatchEvent(new CustomEvent(SYNC_CHANGE_EVENT));
};

// 数据变化通知（供其他组件在数据变化时调用）
export const notifyDataChange = () => {
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT));
};

// ============== 数据转换函数 ==============

/**
 * 将本地角色记录转换为云端格式
 */
function dbGachaRecordToCloud(record: DBGachaRecord): CloudGachaRecord {
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
function dbWeaponRecordToCloud(record: DBWeaponRecord): CloudGachaRecord {
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
function cloudToDBGachaRecord(record: CloudGachaRecord, uid: string): DBGachaRecord {
  return {
    record_uid: record.recordUid,
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
function cloudToDBWeaponRecord(record: CloudGachaRecord, uid: string): DBWeaponRecord {
  return {
    record_uid: record.recordUid,
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
function saveSyncConfig(config: SyncConfig): void {
  syncConfigCache = config;
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  notifySyncChange();
}

/**
 * 更新部分同步配置
 */
function updateSyncConfig(partial: Partial<SyncConfig>): void {
  const current = getSyncConfig();
  saveSyncConfig({ ...current, ...partial });
}

/**
 * 订阅同步配置变化
 */
function subscribeSyncConfig(callback: () => void): () => void {
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

/**
 * 同步状态 Hook
 */
export function useSyncConfig() {
  const config = useSyncExternalStore(
    subscribeSyncConfig,
    getSyncConfig,
    getSyncConfig,
  );
  
  const status = useMemo(() => getSyncStatus(config), [config]);
  
  return {
    config,
    status,
    user: config.user,
    isLoggedIn: !!config.user && !!config.accessToken,
    autoSync: config.autoSync,
    lastSyncAt: config.lastSyncAt,
    syncError: config.syncError,
  };
}

/**
 * 同步认证操作 Hook
 */
export function useSyncAuth() {
  const { config, isLoggedIn } = useSyncConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // 发送验证码
  const sendCode = useCallback(async (email: string, type: 'register' | 'reset') => {
    setLoading(true);
    setError(null);
    try {
      await syncApi.sendCode({ email, type });
      return true;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '发送验证码失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 检查邮箱
  const checkEmail = useCallback(async (email: string) => {
    try {
      const result = await syncApi.checkEmail(email);
      return result.registered;
    } catch {
      return false;
    }
  }, []);
  
  // 注册
  const register = useCallback(async (email: string, password: string, code: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.register({ email, password, code });
      saveSyncConfig({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        autoSync: false,
        lastSyncAt: null,
        syncError: null,
      });
      return true;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '注册失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 登录
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.login({ email, password });
      saveSyncConfig({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        autoSync: false,
        lastSyncAt: null,
        syncError: null,
      });
      return true;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '登录失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 重置密码
  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      await syncApi.resetPassword({ email, code, newPassword });
      return true;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '重置密码失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 登出
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (config.refreshToken) {
        await syncApi.logout({ refreshToken: config.refreshToken });
      }
    } catch {
      // 忽略错误，直接清除本地状态
    } finally {
      saveSyncConfig(DEFAULT_SYNC_CONFIG);
      setLoading(false);
    }
  }, [config.refreshToken]);
  
  // 刷新 Token
  const refreshToken = useCallback(async () => {
    if (!config.refreshToken) return false;
    
    try {
      const result = await syncApi.refresh({ refreshToken: config.refreshToken });
      updateSyncConfig({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        syncError: null,
      });
      return true;
    } catch {
      // Token 刷新失败，清除登录状态
      saveSyncConfig(DEFAULT_SYNC_CONFIG);
      return false;
    }
  }, [config.refreshToken]);
  
  // 切换自动同步
  const toggleAutoSync = useCallback((enabled: boolean) => {
    updateSyncConfig({ autoSync: enabled });
  }, []);
  
  // 更新同步时间
  const updateLastSyncAt = useCallback(() => {
    updateSyncConfig({ lastSyncAt: new Date().toISOString() });
  }, []);
  
  // 设置同步错误
  const setSyncError = useCallback((error: string | null) => {
    updateSyncConfig({ syncError: error });
  }, []);
  
  /**
   * 执行完整的数据同步（增量同步）
   * 1. 上传本地新增数据到云端（只上传自上次同步以来的新记录）
   * 2. 从云端下载数据合并到本地
   */
  const manualSync = useCallback(async (): Promise<{
    success: boolean;
    uploaded: { characters: number; weapons: number };
    downloaded: { characters: number; weapons: number };
  }> => {
    if (!isLoggedIn || !config.accessToken) {
      return { 
        success: false, 
        uploaded: { characters: 0, weapons: 0 }, 
        downloaded: { characters: 0, weapons: 0 },
      };
    }
    
    setLoading(true);
    setError(null);
    
    const result = {
      success: false,
      uploaded: { characters: 0, weapons: 0 },
      downloaded: { characters: 0, weapons: 0 },
    };
    
    // 记录同步开始时间，只有全部成功后才更新 lastSyncAt
    const syncStartTime = new Date().toISOString();
    
    try {
      // 获取本地所有账号
      const localAccounts = await dbGetAccounts();
      
      if (localAccounts.length === 0) {
        // 没有本地数据，只从云端下载
        const cloudStatus = await syncApi.getSyncStatus(config.accessToken);
        
        for (const cloudAccount of cloudStatus.accounts) {
          // 从云端下载记录
          const downloadResult = await syncApi.downloadRecords(
            config.accessToken,
            {
              uid: cloudAccount.uid,
              region: cloudAccount.region,
            },
          );
          
          // 分离角色和武器记录
          const characterRecords = downloadResult.records
            .filter((r) => r.category === 'character')
            .map((r) => cloudToDBGachaRecord(r, cloudAccount.uid));
          const weaponRecords = downloadResult.records
            .filter((r) => r.category === 'weapon')
            .map((r) => cloudToDBWeaponRecord(r, cloudAccount.uid));
          
          // 保存到本地
          if (characterRecords.length > 0) {
            const added = await dbSaveGachaRecords(characterRecords);
            result.downloaded.characters += added;
          }
          if (weaponRecords.length > 0) {
            const added = await dbSaveWeaponRecords(weaponRecords);
            result.downloaded.weapons += added;
          }
        }
      } else {
        // 有本地数据，先上传后下载
        for (const account of localAccounts) {
          const uid = account.uid;
          // 默认 region，如需可从账号信息中获取
          const region = 'default';
          
          // 获取本地角色记录
          const localGachaRecords = await dbGetGachaRecords(uid);
          // 获取本地武器记录
          const localWeaponRecords = await dbGetWeaponRecords(uid);
          
          // 增量上传：只上传 fetched_at 大于上次同步时间的记录
          const lastSyncTimestamp = config.lastSyncAt 
            ? new Date(config.lastSyncAt).getTime() 
            : 0;
          
          // 筛选新增的角色记录并按 seqId 去重
          const newGachaRecords = new Map<string, typeof localGachaRecords[0]>();
          for (const record of localGachaRecords) {
            // 只上传在上次同步之后获取的记录
            if (record.fetched_at > lastSyncTimestamp && !newGachaRecords.has(record.seq_id)) {
              newGachaRecords.set(record.seq_id, record);
            }
          }
          
          // 筛选新增的武器记录并按 seqId 去重
          const newWeaponRecords = new Map<string, typeof localWeaponRecords[0]>();
          for (const record of localWeaponRecords) {
            if (record.fetched_at > lastSyncTimestamp && !newWeaponRecords.has(record.seq_id)) {
              newWeaponRecords.set(record.seq_id, record);
            }
          }
          
          // 转换为云端格式（只包含新增记录）
          const cloudRecords: CloudGachaRecord[] = [
            ...Array.from(newGachaRecords.values()).map(dbGachaRecordToCloud),
            ...Array.from(newWeaponRecords.values()).map(dbWeaponRecordToCloud),
          ];
          
          if (cloudRecords.length > 0) {
            // 上传到云端
            const uploadResult = await syncApi.uploadRecords(
              config.accessToken,
              {
                uid,
                region,
                records: cloudRecords,
              },
            );
            
            // 使用后端返回的实际上传数量
            // 按 category 统计
            const uploadedCharCount = cloudRecords.filter(r => r.category === 'character').length;
            const uploadedWeaponCount = cloudRecords.filter(r => r.category === 'weapon').length;
            
            // 实际新增的数量 = 总上传数 - 跳过数（已存在的记录）
            const actualNewUploaded = uploadResult.uploaded;
            // 按比例估算各类别实际新增数
            const totalSent = uploadedCharCount + uploadedWeaponCount;
            if (totalSent > 0) {
              result.uploaded.characters += Math.round(actualNewUploaded * (uploadedCharCount / totalSent));
              result.uploaded.weapons += Math.round(actualNewUploaded * (uploadedWeaponCount / totalSent));
            }
            
            console.log(`[Sync] 上传完成: 发送 ${cloudRecords.length} 条, 实际新增 ${uploadResult.uploaded} 条, 跳过 ${uploadResult.skipped} 条`);
          }
          
          // 从云端下载（增量，只下载新记录）
          const downloadParams: { uid: string; region: string; since?: string } = { uid, region };
          if (config.lastSyncAt) downloadParams.since = config.lastSyncAt;
          const downloadResult = await syncApi.downloadRecords(
            config.accessToken,
            downloadParams,
          );
          
          // 分离角色和武器记录
          const downloadedCharRecords = downloadResult.records
            .filter((r) => r.category === 'character')
            .map((r) => cloudToDBGachaRecord(r, uid));
          const downloadedWeaponRecords = downloadResult.records
            .filter((r) => r.category === 'weapon')
            .map((r) => cloudToDBWeaponRecord(r, uid));
          
          // 保存到本地（去重由 SQLite INSERT OR IGNORE 处理）
          if (downloadedCharRecords.length > 0) {
            const added = await dbSaveGachaRecords(downloadedCharRecords);
            result.downloaded.characters += added;
          }
          if (downloadedWeaponRecords.length > 0) {
            const added = await dbSaveWeaponRecords(downloadedWeaponRecords);
            result.downloaded.weapons += added;
          }
        }
      }
      
      // 只有全部成功后才更新同步时间
      updateSyncConfig({ 
        lastSyncAt: syncStartTime,
        syncError: null,
      });
      
      result.success = true;
      
      // 通知数据变化
      notifyDataChange();
      
      return result;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '同步失败';
      setError(message);
      updateSyncConfig({ syncError: message });
      return result;
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, config.accessToken, config.lastSyncAt]);
  
  /**
   * 清理云端重复记录
   */
  const cleanupDuplicates = useCallback(async (): Promise<{ deleted: number }> => {
    if (!isLoggedIn || !config.accessToken) {
      return { deleted: 0 };
    }

    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.cleanupDuplicates(config.accessToken);
      return result;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '清理失败';
      setError(message);
      return { deleted: 0 };
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, config.accessToken]);

  return {
    loading,
    error,
    clearError,
    sendCode,
    checkEmail,
    register,
    login,
    resetPassword,
    logout,
    refreshToken,
    toggleAutoSync,
    updateLastSyncAt,
    setSyncError,
    manualSync,
    cleanupDuplicates,
    isLoggedIn,
  };
}

/**
 * 检查 API 服务可用性 Hook
 */
export function useSyncHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  
  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const healthy = await syncApi.healthCheck();
      setIsHealthy(healthy);
      return healthy;
    } catch {
      setIsHealthy(false);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);
  
  // 初始化时检查
  useEffect(() => {
    checkHealth();
    
    // 每 30 秒检查一次
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);
  
  return { isHealthy, checking, checkHealth };
}

/**
 * 自动同步 Hook
 * 处理：
 * 1. 应用启动时自动同步
 * 2. 本地数据变化后自动上传
 * 3. 定时拉取云端最新数据
 */
export function useAutoSync() {
  const { isLoggedIn, autoSync } = useSyncConfig();
  const { manualSync, loading } = useSyncAuth();
  const [lastAutoSyncAt, setLastAutoSyncAt] = useState<string | null>(null);
  const syncInProgressRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  // 执行自动同步（带去重保护）
  const doAutoSync = useCallback(async () => {
    if (!isLoggedIn || !autoSync || syncInProgressRef.current || loading) {
      return;
    }
    
    syncInProgressRef.current = true;
    try {
      console.log('[AutoSync] 开始自动同步...');
      const result = await manualSync();
      if (result.success) {
        setLastAutoSyncAt(new Date().toISOString());
        console.log('[AutoSync] 同步完成', result);
      } else {
        console.warn('[AutoSync] 同步失败');
      }
    } catch (e) {
      console.error('[AutoSync] 同步出错:', e);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isLoggedIn, autoSync, manualSync, loading]);

  // 1. 应用启动时自动同步（仅执行一次）
  useEffect(() => {
    if (isLoggedIn && autoSync && !initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      // 延迟一点执行，等待其他初始化完成
      const timer = setTimeout(() => {
        doAutoSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, autoSync, doAutoSync]);

  // 2. 定时同步（每 5 分钟）
  useEffect(() => {
    if (!isLoggedIn || !autoSync) {
      return;
    }

    const interval = setInterval(() => {
      doAutoSync();
    }, AUTO_SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isLoggedIn, autoSync, doAutoSync]);

  // 3. 监听数据变化事件，自动上传（带防抖）
  useEffect(() => {
    if (!isLoggedIn || !autoSync) {
      return;
    }

    // 使用防抖 timer，避免频繁触发同步
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleDataChange = () => {
      // 清除之前的 timer，实现防抖效果
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      // 延迟执行，避免频繁触发
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        doAutoSync();
      }, 3000);
    };

    window.addEventListener(DATA_CHANGE_EVENT, handleDataChange);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, handleDataChange);
      // 清理 effect 时清除 timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isLoggedIn, autoSync, doAutoSync]);

  return {
    lastAutoSyncAt,
    syncInProgress: syncInProgressRef.current,
  };
}

/**
 * 获取云端同步状态信息
 */
export function useCloudSyncStatus() {
  const { config, isLoggedIn } = useSyncConfig();
  const [status, setStatus] = useState<{
    accounts: Array<{
      uid: string;
      region: string;
      characterCount: number;
      weaponCount: number;
      lastRecordAt: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isLoggedIn || !config.accessToken) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.getSyncStatus(config.accessToken);
      setStatus(result);
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '获取同步状态失败';
      setError(message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, config.accessToken]);

  // 初始化时获取状态
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}
