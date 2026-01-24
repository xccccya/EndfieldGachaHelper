/**
 * Endfield API React Hooks
 */

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { 
  BindingAccount, 
  EndFieldCharPoolType, 
  EndFieldWeaponPoolType,
  GameAppInfo,
  GachaCategory,
} from '@efgachahelper/shared';
import { 
  END_FIELD_CHAR_POOL_TYPES,
  END_FIELD_WEAPON_POOL_TYPES,
} from '@efgachahelper/shared';
import {
  grantAppToken,
  fetchBindingList,
  fetchU8TokenByUid,
  fetchAllGachaRecords,
} from '../features/endfield/endfieldApi';
import { tauriFetcher } from '../lib/tauriHttp';
import {
  saveToken,
  getToken,
  addAccount,
  addGachaRecords,
  addWeaponRecords,
  setActiveUid,
  getActiveUid,
  getGachaRecords,
  getWeaponRecords,
  notifyStorageChange,
  STORAGE_CHANGE_EVENT,
  type StoredAccount,
} from '../lib/storage';

export type SyncProgress = {
  status: 'idle' | 'authenticating' | 'fetching_bindings' | 'fetching_records' | 'done' | 'error';
  /** 当前同步的类别 */
  category?: GachaCategory;
  /** 当前同步的卡池类型 */
  poolType?: string;
  poolIndex?: number;
  totalPools?: number;
  /** 角色记录数 */
  charRecordsFetched?: number;
  /** 武器记录数 */
  weaponRecordsFetched?: number;
  /** 总记录数 */
  recordsFetched?: number;
  error?: string;
};

const defaultOptions = { fetcher: tauriFetcher };

/**
 * 账号认证 Hook
 */
export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bindings, setBindings] = useState<BindingAccount[]>([]);
  const [endfieldApp, setEndfieldApp] = useState<GameAppInfo | null>(null);

  const authenticate = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. 获取 app_token
      const appToken = await grantAppToken(token, defaultOptions);
      saveToken(appToken);

      // 2. 获取绑定列表
      const bindingRes = await fetchBindingList(appToken, defaultOptions);
      
      if (bindingRes.status !== 0) {
        throw new Error(bindingRes.msg || '获取绑定列表失败');
      }

      // 3. 找到终末地的绑定
      const endfield = bindingRes.data?.list?.find((app) => app.appCode === 'endfield');
      
      if (!endfield || !endfield.bindingList?.length) {
        throw new Error('未找到终末地账号绑定，请先在游戏中绑定账号');
      }

      setEndfieldApp(endfield);
      setBindings(endfield.bindingList);

      // 4. 保存所有账号到本地
      for (const binding of endfield.bindingList) {
        addAccount(binding);
      }

      // 5. 设置默认选中的账号
      const activeUid = getActiveUid();
      const hasActive = endfield.bindingList.some((b) => b.uid === activeUid);
      const firstBinding = endfield.bindingList[0];
      if (!hasActive && firstBinding) {
        setActiveUid(firstBinding.uid);
      }

      return endfield.bindingList;
    } catch (err) {
      console.error('[useAuth] Authentication error:', err);
      let message = '认证失败';
      if (err instanceof Error) {
        // 处理常见错误
        if (err.message.includes('grantAppToken failed')) {
          message = 'Token 无效或已过期，请重新获取';
        } else if (err.message.includes('fetchBindingList failed')) {
          message = '无法获取绑定列表，请稍后重试';
        } else if (err.message.includes('网络请求')) {
          message = err.message;
        } else if (err.message.includes('Failed to fetch') || err.message.includes('fetch')) {
          message = '网络连接失败，请检查网络设置';
        } else {
          message = err.message;
        }
      }
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    bindings,
    endfieldApp,
    authenticate,
    clearError: () => setError(null),
  };
}

/**
 * 从角色 poolId 中提取卡池类型
 * poolId 格式如: special_1_0_1, standard_1_0_1, beginner_1_0_1
 */
function getCharPoolTypeFromPoolId(poolId: string): EndFieldCharPoolType | null {
  const prefix = poolId.toLowerCase().split('_')[0];
  switch (prefix) {
    case 'special':
      return 'E_CharacterGachaPoolType_Special';
    case 'standard':
      return 'E_CharacterGachaPoolType_Standard';
    case 'beginner':
      return 'E_CharacterGachaPoolType_Beginner';
    default:
      return null;
  }
}

/**
 * 从武器 poolId 中提取卡池类型
 * poolId 格式如: weponbox_1_0_1, weaponbox_constant_2
 */
function getWeaponPoolTypeFromPoolId(poolId: string): EndFieldWeaponPoolType | null {
  const prefix = poolId.toLowerCase().split('_')[0];
  // 目前武器池只有 Special 和 Standard 两种
  // weponbox 通常对应限定武器池
  // weaponbox_constant 对应常驻武器池
  if (prefix === 'weponbox') {
    return 'E_WeaponGachaPoolType_Special';
  }
  if (prefix === 'weaponbox') {
    // weaponbox_constant 对应常驻
    if (poolId.toLowerCase().includes('constant')) {
      return 'E_WeaponGachaPoolType_Standard';
    }
    return 'E_WeaponGachaPoolType_Special';
  }
  return null;
}

/**
 * 构建已存在角色记录的 seqId 集合（按卡池类型分组）
 */
function buildExistingCharSeqIdsByPool(uid: string): Partial<Record<EndFieldCharPoolType, Set<string>>> {
  const records = getGachaRecords(uid);
  const result: Partial<Record<EndFieldCharPoolType, Set<string>>> = {};
  
  for (const record of records) {
    const poolType = getCharPoolTypeFromPoolId(record.poolId);
    if (poolType) {
      const set = (result[poolType] ??= new Set());
      set.add(record.seqId);
    }
  }
  
  return result;
}

/**
 * 构建已存在武器记录的 seqId 集合（按卡池类型分组）
 */
function buildExistingWeaponSeqIdsByPool(uid: string): Partial<Record<EndFieldWeaponPoolType, Set<string>>> {
  const records = getWeaponRecords(uid);
  const result: Partial<Record<EndFieldWeaponPoolType, Set<string>>> = {};
  
  for (const record of records) {
    const poolType = getWeaponPoolTypeFromPoolId(record.poolId);
    if (poolType) {
      const set = (result[poolType] ??= new Set());
      set.add(record.seqId);
    }
  }
  
  return result;
}

/** 总卡池数量 */
const TOTAL_POOLS = END_FIELD_CHAR_POOL_TYPES.length + END_FIELD_WEAPON_POOL_TYPES.length;

/**
 * 抽卡记录同步 Hook
 * 支持角色池和武器池同步
 * 支持增量同步：检测已存在的记录，避免重复拉取
 * 增加请求延迟防止触发 API 风控
 */
export function useGachaSync() {
  const [progress, setProgress] = useState<SyncProgress>({ status: 'idle' });

  const syncRecords = useCallback(async (uid: string): Promise<number> => {
    const appToken = getToken();
    if (!appToken) {
      setProgress({ status: 'error', error: '未登录，请先添加 Token' });
      throw new Error('未登录');
    }

    let charAdded = 0;
    let weaponAdded = 0;

    try {
      // 1. 获取 u8_token
      setProgress({ status: 'authenticating' });
      const u8Token = await fetchU8TokenByUid(uid, appToken, defaultOptions);

      // 2. 构建已存在记录的 seqId 集合（用于增量同步）
      const existingCharSeqIdsByPool = buildExistingCharSeqIdsByPool(uid);
      const existingWeaponSeqIdsByPool = buildExistingWeaponSeqIdsByPool(uid);
      
      // 3. 拉取所有卡池记录（角色 + 武器）
      setProgress({
        status: 'fetching_records',
        category: 'character',
        poolIndex: 0,
        totalPools: TOTAL_POOLS,
        recordsFetched: 0,
      });

      const allRecords = await fetchAllGachaRecords(u8Token, {
        ...defaultOptions,
        // 分页请求延迟（防风控）
        minDelayMs: 800,
        maxDelayMs: 1500,
        // 卡池切换延迟（防风控）
        poolSwitchMinDelayMs: 1500,
        poolSwitchMaxDelayMs: 2500,
        // 类别切换延迟
        categorySwitchDelayMs: 2000,
        // 增量同步
        existingCharSeqIdsByPool,
        existingWeaponSeqIdsByPool,
        // 进度回调
        onProgress: (category, poolType, poolIndex, _totalPools, recordsFetched) => {
          // 计算总进度
          const baseIndex = category === 'weapon' ? END_FIELD_CHAR_POOL_TYPES.length : 0;
          setProgress({
            status: 'fetching_records',
            category,
            poolType,
            poolIndex: baseIndex + poolIndex,
            totalPools: TOTAL_POOLS,
            charRecordsFetched: category === 'character' ? recordsFetched : charAdded,
            weaponRecordsFetched: category === 'weapon' ? recordsFetched : weaponAdded,
            recordsFetched: charAdded + weaponAdded + recordsFetched,
          });
        },
      });

      // 4. 保存角色记录
      for (const poolType of END_FIELD_CHAR_POOL_TYPES) {
        const records = allRecords.character[poolType];
        if (records && records.length > 0) {
          const added = addGachaRecords(uid, records);
          charAdded += added;
        }
      }

      // 5. 保存武器记录
      for (const poolType of END_FIELD_WEAPON_POOL_TYPES) {
        const records = allRecords.weapon[poolType];
        if (records && records.length > 0) {
          const added = addWeaponRecords(uid, records);
          weaponAdded += added;
        }
      }

      const totalAdded = charAdded + weaponAdded;
      setProgress({ 
        status: 'done', 
        charRecordsFetched: charAdded,
        weaponRecordsFetched: weaponAdded,
        recordsFetched: totalAdded,
      });
      return totalAdded;
    } catch (err) {
      console.error('[useGachaSync] Sync error:', err);
      let message = '同步失败';
      if (err instanceof Error) {
        if (err.message.includes('fetchU8TokenByUid failed')) {
          message = 'Token 已过期，请重新添加账号';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('fetch')) {
          message = '网络连接失败，请检查网络设置';
        } else {
          message = err.message;
        }
      }
      setProgress({ status: 'error', error: message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setProgress({ status: 'idle' });
  }, []);

  return {
    progress,
    syncRecords,
    reset,
  };
}

/**
 * 账号列表 Hook
 */
export function useAccounts() {
  /**
   * useSyncExternalStore 要求 getSnapshot 在 store 未变化时返回“稳定值”，
   * 否则会导致 React 认为 snapshot 一直变化从而陷入无限重渲染。
   *
   * 这里直接用 localStorage 的原始字符串拼成 snapshot（primitive），
   * 同值时 Object.is 会判定相等，不会触发循环。
   */
  const SNAPSHOT_DELIM = '\u0000';
  const getSnapshot = useCallback((): string => {
    if (typeof window === 'undefined') return `${SNAPSHOT_DELIM}[]`;
    const accountsRaw = localStorage.getItem('efgh.accounts') ?? '[]';
    const activeUidRaw = localStorage.getItem('efgh.activeUid') ?? '';
    return `${activeUidRaw}${SNAPSHOT_DELIM}${accountsRaw}`;
  }, []);

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => onStoreChange();
    window.addEventListener(STORAGE_CHANGE_EVENT, handler);
    // 兼容跨窗口/多实例同步（同窗口内 localStorage.setItem 不会触发该事件）
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const { activeUid, accountsRaw } = useMemo(() => {
    const idx = snapshot.indexOf(SNAPSHOT_DELIM);
    if (idx < 0) return { activeUid: null as string | null, accountsRaw: '[]' };
    const uid = snapshot.slice(0, idx);
    const raw = snapshot.slice(idx + SNAPSHOT_DELIM.length) || '[]';
    return { activeUid: uid || null, accountsRaw: raw };
  }, [snapshot]);

  const accounts: StoredAccount[] = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(accountsRaw);
      return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
    } catch {
      return [];
    }
  }, [accountsRaw]);

  const refresh = useCallback(() => {
    // 主动触发一次通知，让所有订阅者重新从存储读取
    notifyStorageChange({ reason: 'manualRefresh' });
  }, []);

  const selectAccount = useCallback((uid: string) => {
    setActiveUid(uid);
  }, []);

  const activeAccount = accounts.find((a) => a.uid === activeUid) || null;

  return {
    accounts,
    activeUid,
    activeAccount,
    selectAccount,
    refresh,
  };
}
