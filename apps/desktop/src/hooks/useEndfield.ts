/**
 * Endfield API React Hooks
 */

import { useState, useCallback, useEffect } from 'react';
import type { 
  BindingAccount, 
  EndFieldCharPoolType, 
  GameAppInfo,
  GachaCategory,
} from '@efgachahelper/shared';
import { 
  END_FIELD_CHAR_POOL_TYPES,
} from '@efgachahelper/shared';
import {
  grantAppToken,
  fetchBindingList,
  fetchU8TokenByUid,
  fetchAllGachaRecords,
  EndfieldRiskControlError,
  HttpError,
} from '../features/endfield/endfieldApi';
import { tauriFetcher } from '../lib/tauriHttp';
import {
  saveAppToken,
  getAppToken,
  getAccountProviderPreference,
  setAccountProviderPreference,
  addAccountsFromBinding,
  makeAccountKey,
  getAccounts,
  getAccountHgUid,
  getAccountServerId,
  addGachaRecords,
  addWeaponRecords,
  setActiveUid,
  getActiveUid,
  getGachaRecords,
  getWeaponRecords,
  notifyStorageChange,
  STORAGE_CHANGE_EVENT,
  type StoredAccount,
  type GachaRecord,
  type WeaponRecord,
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

  const authenticate = useCallback(async (
    token: string,
    provider: 'hypergryph' | 'gryphline' = getAccountProviderPreference(),
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. 获取 app_token
      const appToken = await grantAppToken(token, { ...defaultOptions, provider });
      saveAppToken(provider, appToken);
      setAccountProviderPreference(provider);

      // 2. 获取绑定列表
      const bindingRes = await fetchBindingList(appToken, { ...defaultOptions, provider });
      
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

      // 4. 保存所有账号到本地（异步）
      for (const binding of endfield.bindingList) {
        await addAccountsFromBinding(binding, provider);
      }

      // 5. 设置默认选中的账号
      const activeUid = getActiveUid();
      const allRoleKeys = endfield.bindingList.flatMap((b) =>
        (b.roles ?? []).map((r) => makeAccountKey(r.serverId, r.roleId, provider)),
      );
      const hasActive = !!activeUid && allRoleKeys.includes(activeUid);
      const firstKey = allRoleKeys[0];
      if (!hasActive && firstKey) {
        setActiveUid(firstKey);
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
 * 构建已存在角色记录的 seqId 集合（按卡池类型分组）
 */
async function buildExistingCharSeqIdsByPool(uid: string): Promise<Partial<Record<EndFieldCharPoolType, Set<string>>>> {
  const records = await getGachaRecords(uid);
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
 * 构建已存在武器记录的 seqId 集合
 * 武器池不区分类型，返回所有已存在的 seqId
 */
async function buildExistingWeaponSeqIds(uid: string): Promise<Set<string>> {
  const records = await getWeaponRecords(uid);
  const result = new Set<string>();
  
  for (const record of records) {
    result.add(record.seqId);
  }
  
  return result;
}

/** 
 * 总卡池数量
 * 角色池 3 种（限定池、常驻池、新手池）+ 武器池 1 种 = 4
 */
const TOTAL_POOLS = END_FIELD_CHAR_POOL_TYPES.length + 1; // 3 + 1 = 4

/** 卡池类型显示名称映射 */
const POOL_TYPE_NAMES: Record<string, string> = {
  'E_CharacterGachaPoolType_Special': '限定池',
  'E_CharacterGachaPoolType_Standard': '常驻池',
  'E_CharacterGachaPoolType_Beginner': '新手池',
  'E_WeaponGachaPoolType_All': '武器池',
};

/**
 * 抽卡记录同步 Hook
 * 同步四个卡池：限定池、常驻池、新手池、武器池
 * 支持增量同步：检测已存在的记录，避免重复拉取
 * 增加请求延迟防止触发 API 风控
 */
export function useGachaSync() {
  const [progress, setProgress] = useState<SyncProgress>({ status: 'idle' });

  const syncRecords = useCallback(async (uid: string): Promise<number> => {
    let charAdded = 0;
    let weaponAdded = 0;

    try {
      const accounts = await getAccounts();
      const account = accounts.find((a) => a.uid === uid) ?? null;
      const provider: 'hypergryph' | 'gryphline' =
        account?.provider === 'gryphline' ? 'gryphline' : 'hypergryph';
      const appToken = getAppToken(provider);
      if (!appToken) {
        setProgress({ status: 'error', error: '未登录该平台，请先在账号管理中添加对应平台 Token' });
        throw new Error('missing app token');
      }
      const hgUid = account ? getAccountHgUid(account) : null;
      if (!hgUid) {
        setProgress({ status: 'error', error: '该账号缺少 hgUid 信息，请重新绑定 Token 以补全账号' });
        throw new Error('missing hgUid');
      }

      // 获取账号的 serverId（国服默认 '1'，国际服为 '2' 或 '3'）
      const serverId = account ? getAccountServerId(account) : null;
      if (!serverId) {
        setProgress({ status: 'error', error: '该账号缺少 serverId 信息，请重新绑定 Token 以补全账号' });
        throw new Error('missing serverId');
      }

      const options = { ...defaultOptions, provider, serverId };

      // 1. 获取 u8_token
      setProgress({ status: 'authenticating' });
      const u8Token = await fetchU8TokenByUid(hgUid, appToken, options);

      // 2. 构建已存在记录的 seqId 集合（用于增量同步）
      const existingCharSeqIdsByPool = await buildExistingCharSeqIdsByPool(uid);
      const existingWeaponSeqIds = await buildExistingWeaponSeqIds(uid);
      
      // 3. 拉取所有卡池记录（角色 + 武器）
      setProgress({
        status: 'fetching_records',
        category: 'character',
        poolIndex: 0,
        totalPools: TOTAL_POOLS,
        recordsFetched: 0,
      });

      const allRecords = await fetchAllGachaRecords(u8Token, {
        ...options,
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
        existingWeaponSeqIdsByPool: {
          'E_WeaponGachaPoolType_All': existingWeaponSeqIds,
        },
        // 进度回调
        onProgress: (category, poolType, poolIndex, _totalPools, recordsFetched) => {
          // 计算总进度：角色池 3 个 + 武器池 1 个
          const currentPoolIndex = category === 'weapon' ? END_FIELD_CHAR_POOL_TYPES.length + 1 : poolIndex;
          const poolName = POOL_TYPE_NAMES[poolType] || poolType;
          
          setProgress({
            status: 'fetching_records',
            category,
            poolType: poolName,
            poolIndex: currentPoolIndex,
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
          const added = await addGachaRecords(uid, records);
          charAdded += added;
        }
      }

      // 5. 保存武器记录（武器池只有一个类型）
      const weaponRecords = allRecords.weapon['E_WeaponGachaPoolType_All'];
      if (weaponRecords && weaponRecords.length > 0) {
        const added = await addWeaponRecords(uid, weaponRecords);
        weaponAdded += added;
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
        if (err instanceof EndfieldRiskControlError) {
          message =
            '官方接口请求过于频繁，已触发风控/请求超限。请稍后再试，并避免短时间内多次同步拉取数据，否则可能持续被限制。';
        } else if (err instanceof HttpError && err.message.includes('fetchU8TokenByUid failed')) {
          // u8_token 获取失败：更精确地区分 token 问题与服务端错误
          if (err.status === 401 || err.status === 403) {
            message = '账号凭证已失效，请重新添加 Token 后再同步';
          } else {
            message = `获取同步凭证失败（HTTP ${err.status}），请稍后再试`;
          }
        } else if (err.message.includes('网络请求失败') || err.message.includes('Failed to fetch')) {
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
 * 使用事件订阅 + version 触发重新加载
 */
export function useAccounts() {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // 使用递增版本号触发刷新，避免 Date.now() 导致的重复渲染
  const [version, setVersion] = useState(0);

  // 订阅存储变更（同窗口自定义事件 + 跨窗口 storage 事件）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      setVersion((v) => v + 1);
    };

    window.addEventListener(STORAGE_CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const activeUid =
    typeof window === 'undefined'
      ? null
      : ((localStorage.getItem('efgh.activeUid') ?? '') || null);

  // 异步加载账号列表
  useEffect(() => {
    let mounted = true;
    
    const loadAccounts = async () => {
      try {
        const data = await getAccounts();
        if (mounted) {
          setAccounts(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('[useAccounts] Failed to load accounts:', e);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, [version]); // 当存储变化时重新加载

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
    loading,
  };
}

/**
 * 抽卡记录数据 Hook
 * 异步加载指定账号的记录
 */
export function useGachaRecordsData(uid: string | null) {
  const [gachaRecords, setGachaRecords] = useState<GachaRecord[]>([]);
  const [weaponRecords, setWeaponRecords] = useState<WeaponRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // 使用递增版本号来触发重新加载，而不是 Date.now()
  const [version, setVersion] = useState(0);

  // 订阅存储变更
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handler = () => {
      setVersion((v) => v + 1);
    };
    
    window.addEventListener(STORAGE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(STORAGE_CHANGE_EVENT, handler);
  }, []);

  // 异步加载记录
  useEffect(() => {
    let mounted = true;

    const loadRecords = async () => {
      if (!uid) {
        if (mounted) {
          setGachaRecords([]);
          setWeaponRecords([]);
          setLoading(false);
        }
        return;
      }

      try {
        const [gacha, weapon] = await Promise.all([
          getGachaRecords(uid),
          getWeaponRecords(uid),
        ]);
        
        if (mounted) {
          setGachaRecords(gacha);
          setWeaponRecords(weapon);
          setLoading(false);
        }
      } catch (e) {
        console.error('[useGachaRecordsData] Failed to load records:', e);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    void loadRecords();

    return () => {
      mounted = false;
    };
  }, [uid, version]);

  return {
    gachaRecords,
    weaponRecords,
    loading,
  };
}
