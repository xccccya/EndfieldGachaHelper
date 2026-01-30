/**
 * 同步认证操作 Hook
 * 处理登录、注册、登出、数据同步等操作
 */

import { useCallback, useState } from 'react';
import type { CloudGachaRecord } from '@efgachahelper/shared';
import { DEFAULT_SYNC_CONFIG } from '@efgachahelper/shared';
import { syncApi, SyncApiError } from '../../lib/syncApi';
import {
  dbGetGachaRecords,
  dbGetWeaponRecords,
  dbSaveGachaRecords,
  dbSaveWeaponRecords,
} from '../../lib/db';
import {
  getAccounts,
  parseAccountKey,
  getAccountRoleId,
  getAccountServerId,
  getAccountHgUid,
  notifyStorageChange,
} from '../../lib/storage';
import {
  saveSyncConfig,
  updateSyncConfig,
  getForceFullDownloadUids,
  clearForceFullDownload,
  ensureLocalAccountExists,
} from './config';
import {
  dbGachaRecordToCloud,
  dbWeaponRecordToCloud,
  cloudToDBGachaRecord,
  cloudToDBWeaponRecord,
} from './converters';
import { useSyncConfig } from './useSyncConfig';

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
        lastCheckedAt: null,
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
        lastCheckedAt: null,
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
    const now = new Date().toISOString();
    // 兼容旧调用：同时推进“检查时间”与“同步时间”
    updateSyncConfig({ lastSyncAt: now, lastCheckedAt: now });
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
    // 增量边界：优先使用 lastCheckedAt（即使无变化也推进），兼容旧数据回退到 lastSyncAt
    const cursorIso = config.lastCheckedAt ?? config.lastSyncAt;
    const cursorTimestamp = cursorIso ? new Date(cursorIso).getTime() : 0;
    let anyNewUploadedToCloud = 0;
    let anyLocalRecordsAdded = 0;
    
    try {
      // 获取本地所有账号
      const localAccounts = await getAccounts();
      const forceFullDownloadUids = getForceFullDownloadUids();
      
      if (localAccounts.length === 0) {
        // 没有本地数据，只从云端下载
        const cloudStatus = await syncApi.getSyncStatus(config.accessToken);
        
        for (const cloudAccount of cloudStatus.accounts) {
          // 1. 先创建本地账号记录（如果不存在）
          const localUid = await ensureLocalAccountExists(cloudAccount.uid, cloudAccount.region);
          
          // 2. 从云端下载记录
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
            .map((r) => cloudToDBGachaRecord(r, localUid));
          const weaponRecords = downloadResult.records
            .filter((r) => r.category === 'weapon')
            .map((r) => cloudToDBWeaponRecord(r, localUid));
          
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
          const parsed = parseAccountKey(uid);
          const cloudUid = getAccountRoleId(account) ?? parsed?.roleId ?? uid;
          const baseServerId = getAccountServerId(account) ?? parsed?.serverId ?? 'default';
          const provider: 'hypergryph' | 'gryphline' =
            account.provider === 'gryphline' ? 'gryphline' : 'hypergryph';
          // 云端 key 仅支持 uid+region，这里将 provider 编码进 region，避免国服/国际服冲突
          const region = provider === 'gryphline' && baseServerId !== 'default'
            ? `gryphline@${baseServerId}`
            : baseServerId;
          const hgUid = getAccountHgUid(account) ?? undefined;
          
          // 获取本地角色记录
          const localGachaRecords = await dbGetGachaRecords(uid);
          // 获取本地武器记录
          const localWeaponRecords = await dbGetWeaponRecords(uid);
          const localRecordsEmpty = localGachaRecords.length === 0 && localWeaponRecords.length === 0;
          
          // 增量上传：只上传 fetched_at 大于上次同步时间的记录
          const lastSyncTimestamp = cursorTimestamp;
          
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
                uid: cloudUid,
                region,
                ...(hgUid ? { hgUid } : {}),
                records: cloudRecords,
              },
            );
            
            // 使用后端返回的实际上传数量
            const uploadedCharCount = cloudRecords.filter(r => r.category === 'character').length;
            const uploadedWeaponCount = cloudRecords.filter(r => r.category === 'weapon').length;
            
            // 实际新增的数量 = 总上传数 - 跳过数（已存在的记录）
            const actualNewUploaded = uploadResult.uploaded;
            anyNewUploadedToCloud += actualNewUploaded;
            const totalSent = uploadedCharCount + uploadedWeaponCount;
            if (totalSent > 0) {
              result.uploaded.characters += Math.round(actualNewUploaded * (uploadedCharCount / totalSent));
              result.uploaded.weapons += Math.round(actualNewUploaded * (uploadedWeaponCount / totalSent));
            }
            
            console.log(`[Sync] 上传完成: 发送 ${cloudRecords.length} 条, 实际新增 ${uploadResult.uploaded} 条, 跳过 ${uploadResult.skipped} 条`);
          }
          
          // 从云端下载（增量）
          const shouldForceFullDownload = localRecordsEmpty || forceFullDownloadUids.has(uid);
          const downloadParams: { uid: string; region: string; hgUid?: string; since?: string } = {
            uid: cloudUid,
            region,
            ...(hgUid ? { hgUid } : {}),
            ...(cursorIso && !shouldForceFullDownload ? { since: cursorIso } : {}),
          };
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
            anyLocalRecordsAdded += added;
          }
          if (downloadedWeaponRecords.length > 0) {
            const added = await dbSaveWeaponRecords(downloadedWeaponRecords);
            result.downloaded.weapons += added;
            anyLocalRecordsAdded += added;
          }

          // 若本轮已完成该 uid 的全量下载，则清理一次性标记
          if (forceFullDownloadUids.has(uid)) {
            clearForceFullDownload(uid);
          }
        }
      }
      
      // 只有全部成功后才更新同步时间
      // lastCheckedAt：只要本轮同步成功就推进（避免增量边界长期停滞导致重复筛选/重复上传）
      // lastSyncAt：仅当本轮确实发生“数据变化”（新增上传到云端 或 新增下载到本地）才更新，用于 UI 展示
      updateSyncConfig({
        lastCheckedAt: syncStartTime,
        ...(anyNewUploadedToCloud > 0 || anyLocalRecordsAdded > 0 ? { lastSyncAt: syncStartTime } : {}),
        syncError: null,
      });
      
      result.success = true;
      
      // 注意：不要在云同步内部派发 DATA_CHANGE_EVENT，否则会触发 useAutoSync 再次同步，形成循环。
      // 仅当“本地落库新增”时通知存储变化，用于刷新其他页面展示。
      if (anyLocalRecordsAdded > 0) {
        notifyStorageChange({ reason: 'cloudSync', keys: ['gachaRecords', 'weaponRecords'] });
      }
      
      return result;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '同步失败';
      setError(message);
      updateSyncConfig({ syncError: message });
      return result;
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, config.accessToken, config.lastSyncAt, config.lastCheckedAt]);
  
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

  /**
   * 删除所有云端数据
   * 危险操作：会永久删除当前账号的所有游戏账号和抽卡记录
   */
  const deleteAllCloudData = useCallback(async (): Promise<{
    deleted: boolean;
    accountsDeleted: number;
    recordsDeleted: number;
  }> => {
    if (!isLoggedIn || !config.accessToken) {
      return { deleted: false, accountsDeleted: 0, recordsDeleted: 0 };
    }

    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.deleteAllCloudData(config.accessToken);
      // 删除成功后，清除本地的同步时间记录
      if (result.deleted) {
        updateSyncConfig({
          lastSyncAt: null,
          lastCheckedAt: null,
          syncError: null,
        });
      }
      return result;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '删除失败';
      setError(message);
      return { deleted: false, accountsDeleted: 0, recordsDeleted: 0 };
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, config.accessToken]);

  /**
   * 注销账号
   * 危险操作：会永久删除用户账号及其所有关联数据，然后自动退出登录
   */
  const deleteAccount = useCallback(async (): Promise<{
    deleted: boolean;
    gameAccountsDeleted: number;
    recordsDeleted: number;
  }> => {
    if (!isLoggedIn || !config.accessToken) {
      return { deleted: false, gameAccountsDeleted: 0, recordsDeleted: 0 };
    }

    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.deleteAccount(config.accessToken);
      // 注销成功后，清除本地登录状态
      if (result.deleted) {
        saveSyncConfig(DEFAULT_SYNC_CONFIG);
      }
      return result;
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '注销失败';
      setError(message);
      return { deleted: false, gameAccountsDeleted: 0, recordsDeleted: 0 };
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
    deleteAllCloudData,
    deleteAccount,
    isLoggedIn,
  };
}
