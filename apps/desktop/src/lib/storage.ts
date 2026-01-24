/**
 * 本地存储管理
 * 使用 SQLite 存储账号和抽卡记录数据
 * 保留 localStorage 作为降级方案
 */

import type { 
  EndFieldCharInfo, 
  EndFieldWeaponInfo,
  BindingAccount, 
  GameRole,
  GachaCategory,
} from '@efgachahelper/shared';
import {
  getDB,
  checkAndMigrateData,
  migrateFromLocalStorage,
  cleanupLocalDuplicates,
  dbGetAccounts,
  dbGetGachaRecords,
  dbGetWeaponRecords,
  dbSaveAccount,
  dbSaveGachaRecords,
  dbSaveWeaponRecords,
  dbRemoveAccount,
  dbClearGachaRecords,
  dbClearWeaponRecords,
} from './db';
import { getTimestamp } from './dateUtils';

// ============== SQLite 写穿（保证持久化完整性，业务逻辑不变） ==============
/**
 * 设计目标：
 * - 继续使用 localStorage 作为“同步读取层”（不改现有 hooks/UI/导出逻辑）
 * - 同步把变更写入 SQLite 作为“持久化层”，确保 SQLite 数据源完整
 * - SQLite 不可用时自动降级：只写 localStorage（与当前行为一致）
 */
let sqliteEnabled = false;
let sqliteWriteChain: Promise<void> = Promise.resolve();

function enqueueSQLiteWrite(op: () => Promise<void>): void {
  if (!sqliteEnabled) return;
  sqliteWriteChain = sqliteWriteChain
    .then(op)
    .catch((e) => {
      // 不影响业务：localStorage 仍然是同步读取层；下次启动会补写
      console.error('[storage] SQLite 写穿失败（将于下次启动补写）:', e);
    });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function persistLocalCacheToSQLite(): Promise<void> {
  if (!sqliteEnabled) return;
  if (typeof window === 'undefined') return;

  try {
    const accounts = getAccounts();
    const charRecords = getGachaRecords();
    const weaponRecords = getWeaponRecords();

    // 账号量通常很小，逐条写即可
    for (const a of accounts) {
      await dbSaveAccount({
        uid: a.uid,
        channel_name: a.channelName,
        roles: JSON.stringify(a.roles ?? []),
        added_at: a.addedAt,
      });
    }

    // 记录可能较大，分批写入（内部为 INSERT OR IGNORE，不会造成重复）
    const dbChar = charRecords.map((r) => ({
      record_uid: r.recordUid,
      uid: r.uid,
      pool_id: r.poolId,
      pool_name: r.poolName,
      char_id: r.charId,
      char_name: r.charName,
      rarity: r.rarity,
      is_new: r.isNew ? 1 : 0,
      is_free: r.isFree ? 1 : 0,
      gacha_ts: r.gachaTs,
      seq_id: r.seqId,
      fetched_at: r.fetchedAt,
      category: 'character',
    }));
    for (const batch of chunkArray(dbChar, 200)) {
      await dbSaveGachaRecords(batch);
    }

    const dbWeapon = weaponRecords.map((r) => ({
      record_uid: r.recordUid,
      uid: r.uid,
      pool_id: r.poolId,
      pool_name: r.poolName,
      weapon_id: r.weaponId,
      weapon_name: r.weaponName,
      weapon_type: r.weaponType,
      rarity: r.rarity,
      is_new: r.isNew ? 1 : 0,
      gacha_ts: r.gachaTs,
      seq_id: r.seqId,
      fetched_at: r.fetchedAt,
      category: 'weapon',
    }));
    for (const batch of chunkArray(dbWeapon, 200)) {
      await dbSaveWeaponRecords(batch);
    }
  } catch (e) {
    console.error('[storage] 启动补写 SQLite 失败:', e);
  }
}

/**
 * 初始化存储系统
 * 检查并执行数据迁移
 */
export async function initStorage(): Promise<{
  migrated: boolean;
  accounts: number;
  charRecords: number;
  weaponRecords: number;
}> {
  try {
    // 尝试初始化 SQLite
    await getDB();
    sqliteEnabled = true;
    
    // 检查是否需要迁移数据
    const needMigrate = await checkAndMigrateData();
    if (needMigrate) {
      const result = await migrateFromLocalStorage();
      // 如果历史版本已清空 localStorage（或 localStorage 为空），从 SQLite 回填一次，保证 UI 可读
      await rehydrateLocalStorageFromSQLiteIfNeeded();
      // 迁移/回填之后，确保 SQLite 至少包含当前 localStorage 缓存的全集（数据完整性兜底）
      await persistLocalCacheToSQLite();
      return { migrated: true, ...result };
    }
    
    // 正常启动时也做一次兜底：localStorage 为空但 SQLite 有数据 -> 回填
    await rehydrateLocalStorageFromSQLiteIfNeeded();
    // 启动兜底：把当前 localStorage 缓存补写到 SQLite（例如旧版本仅写 localStorage 的数据）
    await persistLocalCacheToSQLite();
    // 清理本地重复记录
    const cleanupResult = await cleanupLocalDuplicates();
    if (cleanupResult.charDeleted > 0 || cleanupResult.weaponDeleted > 0) {
      console.log(`[storage] 已清理本地重复记录: 角色 ${cleanupResult.charDeleted} 条, 武器 ${cleanupResult.weaponDeleted} 条`);
    }
    return { migrated: false, accounts: 0, charRecords: 0, weaponRecords: 0 };
  } catch (e) {
    console.error('SQLite 初始化失败，降级到 localStorage:', e);
    sqliteEnabled = false;
    return { migrated: false, accounts: 0, charRecords: 0, weaponRecords: 0 };
  }
}

// ============== 存储键 ==============
const STORAGE_KEYS = {
  TOKEN: 'efgh.token',
  ACCOUNTS: 'efgh.accounts',
  ACTIVE_UID: 'efgh.activeUid',
  GACHA_RECORDS: 'efgh.gachaRecords',
  WEAPON_RECORDS: 'efgh.weaponRecords',
} as const;

async function rehydrateLocalStorageFromSQLiteIfNeeded(): Promise<void> {
  // 没有 window/localStorage 的环境直接跳过
  if (typeof window === 'undefined') return;

  const accountsRaw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
  const gachaRaw = localStorage.getItem(STORAGE_KEYS.GACHA_RECORDS);
  const weaponRaw = localStorage.getItem(STORAGE_KEYS.WEAPON_RECORDS);

  const localAccountsEmpty = !accountsRaw || accountsRaw === '[]';
  const localGachaEmpty = !gachaRaw || gachaRaw === '[]';
  const localWeaponEmpty = !weaponRaw || weaponRaw === '[]';

  // 如果本地三项都不空，就不做任何事，避免覆盖用户数据
  if (!localAccountsEmpty && !localGachaEmpty && !localWeaponEmpty) return;

  // SQLite 有数据才回填
  const dbAccounts = await dbGetAccounts();
  const hasDbAccounts = dbAccounts.length > 0;
  if (!hasDbAccounts) return;

  if (localAccountsEmpty) {
    const accounts: StoredAccount[] = dbAccounts.map((a) => {
      let roles: GameRole[] = [];
      try {
        const parsed: unknown = JSON.parse(a.roles);
        roles = Array.isArray(parsed) ? (parsed as GameRole[]) : [];
      } catch {
        roles = [];
      }
      return {
        uid: a.uid,
        channelName: a.channel_name,
        roles,
        addedAt: a.added_at,
      };
    });
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  if (localGachaEmpty) {
    const dbChar = await dbGetGachaRecords();
    const records: GachaRecord[] = dbChar.map((r) => ({
      uid: r.uid,
      recordUid: r.record_uid,
      fetchedAt: r.fetched_at,
      category: 'character',
      charId: r.char_id,
      charName: r.char_name,
      gachaTs: r.gacha_ts,
      isFree: r.is_free === 1,
      isNew: r.is_new === 1,
      poolId: r.pool_id,
      poolName: r.pool_name,
      rarity: r.rarity,
      seqId: r.seq_id,
    }));
    localStorage.setItem(STORAGE_KEYS.GACHA_RECORDS, JSON.stringify(records));
  }

  if (localWeaponEmpty) {
    const dbWeapon = await dbGetWeaponRecords();
    const records: WeaponRecord[] = dbWeapon.map((r) => ({
      uid: r.uid,
      recordUid: r.record_uid,
      fetchedAt: r.fetched_at,
      category: 'weapon',
      weaponId: r.weapon_id,
      weaponName: r.weapon_name,
      weaponType: r.weapon_type,
      gachaTs: r.gacha_ts,
      isNew: r.is_new === 1,
      poolId: r.pool_id,
      poolName: r.pool_name,
      rarity: r.rarity,
      seqId: r.seq_id,
    }));
    localStorage.setItem(STORAGE_KEYS.WEAPON_RECORDS, JSON.stringify(records));
  }

  notifyStorageChange({ reason: 'rehydrateFromSQLite', keys: [
    STORAGE_KEYS.ACCOUNTS,
    STORAGE_KEYS.GACHA_RECORDS,
    STORAGE_KEYS.WEAPON_RECORDS,
  ]});
}

// ============== 存储变更通知（用于 React 订阅刷新） ==============
export const STORAGE_CHANGE_EVENT = 'efgh:storage_change';

export type StorageChangeDetail = {
  at: number;
  /** 可选：变更原因（调试用） */
  reason?: string;
  /** 可选：涉及的 key（调试用） */
  keys?: string[];
};

export function notifyStorageChange(detail?: Omit<StorageChangeDetail, 'at'>): void {
  // Tauri/浏览器环境下有效；SSR/非浏览器环境下安全降级
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<StorageChangeDetail>(STORAGE_CHANGE_EVENT, {
      detail: { at: Date.now(), ...detail },
    })
  );
}

// ============== 类型定义 ==============
export type StoredAccount = {
  uid: string;
  channelName: string;
  roles: GameRole[];
  addedAt: number;
};

/** 角色抽卡记录 */
export type GachaRecord = EndFieldCharInfo & {
  uid: string;
  recordUid: string; // 用于去重的唯一标识
  fetchedAt: number;
  category: 'character'; // 记录类型
};

/** 武器抽卡记录 */
export type WeaponRecord = EndFieldWeaponInfo & {
  uid: string;
  recordUid: string;
  fetchedAt: number;
  category: 'weapon';
};

/** 通用抽卡记录（角色或武器） */
export type UnifiedGachaRecord = {
  uid: string;
  recordUid: string;
  fetchedAt: number;
  category: GachaCategory;
  // 通用字段
  poolId: string;
  poolName: string;
  rarity: number;
  isNew: boolean;
  gachaTs: string;
  seqId: string;
  // 角色特有字段
  charId?: string;
  charName?: string;
  isFree?: boolean;
  // 武器特有字段
  weaponId?: string;
  weaponName?: string;
  weaponType?: string;
  // 统一名称（用于显示）
  itemName: string;
};

export type GachaStats = {
  total: number;
  byRarity: Record<number, number>;
  byPool: Record<string, number>;
  last6Star?: UnifiedGachaRecord | undefined;
  pity: number; // 当前保底计数
};

// ============== Token 管理 ==============
export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  notifyStorageChange({ keys: [STORAGE_KEYS.TOKEN], reason: 'saveToken' });
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  notifyStorageChange({ keys: [STORAGE_KEYS.TOKEN], reason: 'clearToken' });
}

// ============== 账号管理 ==============
export function getAccounts(): StoredAccount[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    const parsed: unknown = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  notifyStorageChange({ keys: [STORAGE_KEYS.ACCOUNTS], reason: 'saveAccounts' });

  enqueueSQLiteWrite(async () => {
    for (const a of accounts) {
      await dbSaveAccount({
        uid: a.uid,
        channel_name: a.channelName,
        roles: JSON.stringify(a.roles ?? []),
        added_at: a.addedAt,
      });
    }
  });
}

export function addAccount(binding: BindingAccount): StoredAccount {
  const accounts = getAccounts();
  const existing = accounts.find((a) => a.uid === binding.uid);
  
  const account: StoredAccount = {
    uid: binding.uid,
    channelName: binding.channelName,
    roles: binding.roles,
    addedAt: existing?.addedAt ?? Date.now(),
  };

  if (existing) {
    // 更新已存在的账号
    const idx = accounts.indexOf(existing);
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }

  saveAccounts(accounts);

  enqueueSQLiteWrite(async () => {
    await dbSaveAccount({
      uid: account.uid,
      channel_name: account.channelName,
      roles: JSON.stringify(account.roles ?? []),
      added_at: account.addedAt,
    });
  });

  return account;
}

export function removeAccount(uid: string): void {
  const accounts = getAccounts().filter((a) => a.uid !== uid);
  saveAccounts(accounts);
  
  // 如果删除的是当前激活的账号，清除激活状态
  if (getActiveUid() === uid) {
    clearActiveUid();
  }

  enqueueSQLiteWrite(async () => {
    await dbRemoveAccount(uid);
  });
}

// ============== 当前 UID 管理 ==============
export function getActiveUid(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_UID);
}

export function setActiveUid(uid: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_UID, uid);
  notifyStorageChange({ keys: [STORAGE_KEYS.ACTIVE_UID], reason: 'setActiveUid' });
}

export function clearActiveUid(): void {
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_UID);
  notifyStorageChange({ keys: [STORAGE_KEYS.ACTIVE_UID], reason: 'clearActiveUid' });
}

// ============== 角色抽卡记录管理 ==============

/**
 * 生成角色记录的唯一标识符
 * 基于 uid + category + seqId 生成，确保同一条记录不会重复存储
 */
export function generateCharRecordUid(uid: string, record: EndFieldCharInfo): string {
  return `${uid}_char_${record.seqId}`;
}

export function getGachaRecords(uid?: string): GachaRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GACHA_RECORDS);
    const parsed: unknown = data ? JSON.parse(data) : [];
    const all: GachaRecord[] = Array.isArray(parsed) ? (parsed as GachaRecord[]) : [];
    // 确保旧数据有 category 字段
    const withCategory = all.map(r => ({ ...r, category: 'character' as const }));
    return uid ? withCategory.filter((r) => r.uid === uid) : withCategory;
  } catch {
    return [];
  }
}

export function saveGachaRecords(records: GachaRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.GACHA_RECORDS, JSON.stringify(records));

  // 可能是导入/合并等场景：全量补写 SQLite（INSERT OR IGNORE，不影响既有数据）
  enqueueSQLiteWrite(async () => {
    const dbRecords = records.map((r) => ({
      record_uid: r.recordUid,
      uid: r.uid,
      pool_id: r.poolId,
      pool_name: r.poolName,
      char_id: r.charId,
      char_name: r.charName,
      rarity: r.rarity,
      is_new: r.isNew ? 1 : 0,
      is_free: r.isFree ? 1 : 0,
      gacha_ts: r.gachaTs,
      seq_id: r.seqId,
      fetched_at: r.fetchedAt,
      category: 'character',
    }));
    for (const batch of chunkArray(dbRecords, 200)) {
      await dbSaveGachaRecords(batch);
    }
  });
}

/**
 * 批量添加角色抽卡记录（自动去重）
 * @returns 新增的记录数量
 */
export function addGachaRecords(uid: string, newRecords: EndFieldCharInfo[]): number {
  const existing = getGachaRecords();
  const existingIds = new Set(existing.map((r) => r.recordUid));
  
  let added = 0;
  const now = Date.now();
  const addedForDb: GachaRecord[] = [];

  for (const record of newRecords) {
    const recordUid = generateCharRecordUid(uid, record);
    if (!existingIds.has(recordUid)) {
      const stored: GachaRecord = {
        ...record,
        uid,
        recordUid,
        fetchedAt: now,
        category: 'character',
      };
      existing.push(stored);
      existingIds.add(recordUid);
      added++;
      addedForDb.push(stored);
    }
  }

  if (added > 0) {
    existing.sort((a, b) => {
      const timeA = getTimestamp(a.gachaTs);
      const timeB = getTimestamp(b.gachaTs);
      return timeB - timeA;
    });
    saveGachaRecords(existing);
  }

  if (addedForDb.length > 0) {
    enqueueSQLiteWrite(async () => {
      const dbRecords = addedForDb.map((r) => ({
        record_uid: r.recordUid,
        uid: r.uid,
        pool_id: r.poolId,
        pool_name: r.poolName,
        char_id: r.charId,
        char_name: r.charName,
        rarity: r.rarity,
        is_new: r.isNew ? 1 : 0,
        is_free: r.isFree ? 1 : 0,
        gacha_ts: r.gachaTs,
        seq_id: r.seqId,
        fetched_at: r.fetchedAt,
        category: 'character',
      }));
      for (const batch of chunkArray(dbRecords, 200)) {
        await dbSaveGachaRecords(batch);
      }
    });
  }

  return added;
}

/**
 * 清除指定 UID 的角色抽卡记录
 */
export function clearGachaRecords(uid: string): void {
  const records = getGachaRecords().filter((r) => r.uid !== uid);
  saveGachaRecords(records);

  enqueueSQLiteWrite(async () => {
    await dbClearGachaRecords(uid);
  });
}

// ============== 武器抽卡记录管理 ==============

/**
 * 生成武器记录的唯一标识符
 */
export function generateWeaponRecordUid(uid: string, record: EndFieldWeaponInfo): string {
  return `${uid}_weapon_${record.seqId}`;
}

export function getWeaponRecords(uid?: string): WeaponRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WEAPON_RECORDS);
    const parsed: unknown = data ? JSON.parse(data) : [];
    const all: WeaponRecord[] = Array.isArray(parsed) ? (parsed as WeaponRecord[]) : [];
    return uid ? all.filter((r) => r.uid === uid) : all;
  } catch {
    return [];
  }
}

export function saveWeaponRecords(records: WeaponRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.WEAPON_RECORDS, JSON.stringify(records));

  enqueueSQLiteWrite(async () => {
    const dbRecords = records.map((r) => ({
      record_uid: r.recordUid,
      uid: r.uid,
      pool_id: r.poolId,
      pool_name: r.poolName,
      weapon_id: r.weaponId,
      weapon_name: r.weaponName,
      weapon_type: r.weaponType,
      rarity: r.rarity,
      is_new: r.isNew ? 1 : 0,
      gacha_ts: r.gachaTs,
      seq_id: r.seqId,
      fetched_at: r.fetchedAt,
      category: 'weapon',
    }));
    for (const batch of chunkArray(dbRecords, 200)) {
      await dbSaveWeaponRecords(batch);
    }
  });
}

/**
 * 批量添加武器抽卡记录（自动去重）
 * @returns 新增的记录数量
 */
export function addWeaponRecords(uid: string, newRecords: EndFieldWeaponInfo[]): number {
  const existing = getWeaponRecords();
  const existingIds = new Set(existing.map((r) => r.recordUid));
  
  let added = 0;
  const now = Date.now();
  const addedForDb: WeaponRecord[] = [];

  for (const record of newRecords) {
    const recordUid = generateWeaponRecordUid(uid, record);
    if (!existingIds.has(recordUid)) {
      const stored: WeaponRecord = {
        ...record,
        uid,
        recordUid,
        fetchedAt: now,
        category: 'weapon',
      };
      existing.push(stored);
      existingIds.add(recordUid);
      added++;
      addedForDb.push(stored);
    }
  }

  if (added > 0) {
    existing.sort((a, b) => {
      const timeA = getTimestamp(a.gachaTs);
      const timeB = getTimestamp(b.gachaTs);
      return timeB - timeA;
    });
    saveWeaponRecords(existing);
  }

  if (addedForDb.length > 0) {
    enqueueSQLiteWrite(async () => {
      const dbRecords = addedForDb.map((r) => ({
        record_uid: r.recordUid,
        uid: r.uid,
        pool_id: r.poolId,
        pool_name: r.poolName,
        weapon_id: r.weaponId,
        weapon_name: r.weaponName,
        weapon_type: r.weaponType,
        rarity: r.rarity,
        is_new: r.isNew ? 1 : 0,
        gacha_ts: r.gachaTs,
        seq_id: r.seqId,
        fetched_at: r.fetchedAt,
        category: 'weapon',
      }));
      for (const batch of chunkArray(dbRecords, 200)) {
        await dbSaveWeaponRecords(batch);
      }
    });
  }

  return added;
}

/**
 * 清除指定 UID 的武器抽卡记录
 */
export function clearWeaponRecords(uid: string): void {
  const records = getWeaponRecords().filter((r) => r.uid !== uid);
  saveWeaponRecords(records);

  enqueueSQLiteWrite(async () => {
    await dbClearWeaponRecords(uid);
  });
}

// ============== 统一记录管理 ==============

/**
 * 将角色记录转换为统一格式
 */
function charRecordToUnified(record: GachaRecord): UnifiedGachaRecord {
  return {
    uid: record.uid,
    recordUid: record.recordUid,
    fetchedAt: record.fetchedAt,
    category: 'character',
    poolId: record.poolId,
    poolName: record.poolName,
    rarity: record.rarity,
    isNew: record.isNew,
    gachaTs: record.gachaTs,
    seqId: record.seqId,
    charId: record.charId,
    charName: record.charName,
    isFree: record.isFree,
    itemName: record.charName,
  };
}

/**
 * 将武器记录转换为统一格式
 */
function weaponRecordToUnified(record: WeaponRecord): UnifiedGachaRecord {
  return {
    uid: record.uid,
    recordUid: record.recordUid,
    fetchedAt: record.fetchedAt,
    category: 'weapon',
    poolId: record.poolId,
    poolName: record.poolName,
    rarity: record.rarity,
    isNew: record.isNew,
    gachaTs: record.gachaTs,
    seqId: record.seqId,
    weaponId: record.weaponId,
    weaponName: record.weaponName,
    weaponType: record.weaponType,
    itemName: record.weaponName,
  };
}

/**
 * 获取统一格式的所有抽卡记录（角色 + 武器）
 */
export function getAllUnifiedRecords(uid?: string): UnifiedGachaRecord[] {
  const charRecords = getGachaRecords(uid).map(charRecordToUnified);
  const weaponRecords = getWeaponRecords(uid).map(weaponRecordToUnified);
  
  const all = [...charRecords, ...weaponRecords];
  
  // 按时间排序（最新的在前）
  all.sort((a, b) => {
    const timeA = getTimestamp(a.gachaTs);
    const timeB = getTimestamp(b.gachaTs);
    return timeB - timeA;
  });
  
  return all;
}

/** @deprecated Use generateCharRecordUid instead */
export const generateRecordUid = generateCharRecordUid;

// ============== 统计计算 ==============

/**
 * 从 poolId 中提取卡池类型前缀
 * 角色池 poolId 格式如: special_1_0_1, standard_1_0_1, beginner_1_0_1
 * 武器池 poolId 格式如: weponbox_1_0_1, weaponbox_constant_2
 */
export function getPoolTypePrefix(poolId: string): string {
  return poolId?.toLowerCase().split('_')[0] || '';
}

/**
 * 判断是否为武器池
 * 武器池 poolId 以 weponbox 或 weaponbox 开头
 */
export function isWeaponPool(poolId: string): boolean {
  const prefix = getPoolTypePrefix(poolId);
  return prefix === 'weponbox' || prefix === 'weaponbox';
}

/**
 * 计算统一记录的统计信息
 */
export function calculateUnifiedStats(records: UnifiedGachaRecord[], options?: {
  category?: GachaCategory;
  poolType?: string;
}): GachaStats {
  let filtered = records;
  
  // 按类别筛选
  if (options?.category) {
    filtered = filtered.filter((r) => r.category === options.category);
  }
  
  // 按卡池类型筛选
  if (options?.poolType) {
    const poolType = options.poolType.toLowerCase();
    filtered = filtered.filter((r) => {
      const prefix = getPoolTypePrefix(r.poolId);
      return prefix === poolType || r.poolName.includes(options.poolType!);
    });
  }

  const byRarity: Record<number, number> = {};
  const byPool: Record<string, number> = {};
  let last6Star: UnifiedGachaRecord | undefined;
  let pity = 0;

  // 按时间正序计算保底
  const sorted = [...filtered].sort((a, b) => {
    const timeA = getTimestamp(a.gachaTs);
    const timeB = getTimestamp(b.gachaTs);
    return timeA - timeB;
  });

  for (const record of sorted) {
    byRarity[record.rarity] = (byRarity[record.rarity] || 0) + 1;
    byPool[record.poolName] = (byPool[record.poolName] || 0) + 1;

    pity++;
    if (record.rarity === 6) {
      last6Star = record;
      pity = 0;
    }
  }

  return {
    total: filtered.length,
    byRarity,
    byPool,
    last6Star,
    pity,
  };
}

/** @deprecated Use calculateUnifiedStats with UnifiedGachaRecord instead */
export function calculateStats(records: GachaRecord[], poolType?: string): GachaStats {
  const unified = records.map(charRecordToUnified);
  return calculateUnifiedStats(unified, poolType ? { poolType } : undefined);
}

// ============== 导出/导入 ==============
export type ExportData = {
  schemaVersion: 2;
  exportedAt: number;
  accounts: StoredAccount[];
  records: GachaRecord[];
  weaponRecords: WeaponRecord[];
};

/** 旧版本导出数据格式 */
type ExportDataV1 = {
  schemaVersion: 1;
  exportedAt: number;
  accounts: StoredAccount[];
  records: GachaRecord[];
};

export function exportData(): ExportData {
  return {
    schemaVersion: 2,
    exportedAt: Date.now(),
    accounts: getAccounts(),
    records: getGachaRecords(),
    weaponRecords: getWeaponRecords(),
  };
}

export function importData(data: ExportData | ExportDataV1): { accounts: number; charRecords: number; weaponRecords: number } {
  // 合并账号
  const existingAccounts = getAccounts();
  const accountMap = new Map(existingAccounts.map((a) => [a.uid, a]));
  for (const account of data.accounts) {
    if (!accountMap.has(account.uid)) {
      accountMap.set(account.uid, account);
    }
  }
  saveAccounts(Array.from(accountMap.values()));

  // 合并角色记录
  const existingCharRecords = getGachaRecords();
  const charRecordMap = new Map(existingCharRecords.map((r) => [r.recordUid, r]));
  let newCharRecords = 0;
  for (const record of data.records) {
    if (!charRecordMap.has(record.recordUid)) {
      charRecordMap.set(record.recordUid, { ...record, category: 'character' });
      newCharRecords++;
    }
  }
  saveGachaRecords(Array.from(charRecordMap.values()));

  // 合并武器记录（仅 v2 格式）
  let newWeaponRecords = 0;
  if ('weaponRecords' in data && data.weaponRecords) {
    const existingWeaponRecords = getWeaponRecords();
    const weaponRecordMap = new Map(existingWeaponRecords.map((r) => [r.recordUid, r]));
    for (const record of data.weaponRecords) {
      if (!weaponRecordMap.has(record.recordUid)) {
        weaponRecordMap.set(record.recordUid, { ...record, category: 'weapon' });
        newWeaponRecords++;
      }
    }
    saveWeaponRecords(Array.from(weaponRecordMap.values()));
  }

  return {
    accounts: data.accounts.length,
    charRecords: newCharRecords,
    weaponRecords: newWeaponRecords,
  };
}

// ============== CSV 导出/导入 ==============

/** CSV 导出文件头（与软件数据结构对应） */
const CSV_HEADERS = {
  character: [
    'recordUid',    // 记录唯一ID
    'uid',          // 游戏账号UID
    'category',     // 记录类型：character
    'poolId',       // 卡池ID
    'poolName',     // 卡池名称
    'charId',       // 角色ID
    'charName',     // 角色名称
    'rarity',       // 稀有度
    'isNew',        // 是否首次获得
    'isFree',       // 是否为免费
    'gachaTs',      // 抽卡时间
    'seqId',        // 序列ID
    'fetchedAt',    // 记录获取时间
  ],
  weapon: [
    'recordUid',
    'uid',
    'category',     // 记录类型：weapon
    'poolId',
    'poolName',
    'weaponId',     // 武器ID
    'weaponName',   // 武器名称
    'weaponType',   // 武器类型
    'rarity',
    'isNew',
    'gachaTs',
    'seqId',
    'fetchedAt',
  ],
  unified: [
    'recordUid',
    'uid',
    'category',
    'poolId',
    'poolName',
    'itemId',       // 物品ID（角色ID或武器ID）
    'itemName',     // 物品名称
    'itemType',     // 物品类型（角色为空，武器为武器类型）
    'rarity',
    'isNew',
    'isFree',       // 仅角色有此字段
    'gachaTs',
    'seqId',
    'fetchedAt',
  ],
};

/**
 * 转义 CSV 字段值
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = (() => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'symbol') return value.description ?? value.toString();
    // function / 其它不可序列化类型：导出为空串即可
    return '';
  })();
  // 如果包含逗号、双引号或换行符，需要用双引号包裹
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 解析 CSV 字段值
 */
function parseCSVField(field: string): string {
  field = field.trim();
  // 移除首尾的双引号并处理转义
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

/**
 * 解析 CSV 行（处理引号内的逗号）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // 跳过下一个引号
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  
  return result.map(parseCSVField);
}

/**
 * 导出角色抽卡记录为 CSV
 */
export function exportGachaRecordsToCSV(uid?: string): string {
  const records = getGachaRecords(uid);
  const headers = CSV_HEADERS.character;
  
  const rows = [headers.join(',')];
  
  for (const record of records) {
    const row = [
      escapeCSVField(record.recordUid),
      escapeCSVField(record.uid),
      escapeCSVField('character'),
      escapeCSVField(record.poolId),
      escapeCSVField(record.poolName),
      escapeCSVField(record.charId),
      escapeCSVField(record.charName),
      escapeCSVField(record.rarity),
      escapeCSVField(record.isNew ? 1 : 0),
      escapeCSVField(record.isFree ? 1 : 0),
      escapeCSVField(record.gachaTs),
      escapeCSVField(record.seqId),
      escapeCSVField(record.fetchedAt),
    ];
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}

/**
 * 导出武器抽卡记录为 CSV
 */
export function exportWeaponRecordsToCSV(uid?: string): string {
  const records = getWeaponRecords(uid);
  const headers = CSV_HEADERS.weapon;
  
  const rows = [headers.join(',')];
  
  for (const record of records) {
    const row = [
      escapeCSVField(record.recordUid),
      escapeCSVField(record.uid),
      escapeCSVField('weapon'),
      escapeCSVField(record.poolId),
      escapeCSVField(record.poolName),
      escapeCSVField(record.weaponId),
      escapeCSVField(record.weaponName),
      escapeCSVField(record.weaponType),
      escapeCSVField(record.rarity),
      escapeCSVField(record.isNew ? 1 : 0),
      escapeCSVField(record.gachaTs),
      escapeCSVField(record.seqId),
      escapeCSVField(record.fetchedAt),
    ];
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}

/**
 * 导出所有抽卡记录为统一格式 CSV
 */
export function exportAllRecordsToCSV(uid?: string): string {
  const charRecords = getGachaRecords(uid);
  const weaponRecords = getWeaponRecords(uid);
  const headers = CSV_HEADERS.unified;
  
  const rows = [headers.join(',')];
  
  // 合并并按时间排序
  type MergedRecord = {
    recordUid: string;
    uid: string;
    category: string;
    poolId: string;
    poolName: string;
    itemId: string;
    itemName: string;
    itemType: string;
    rarity: number;
    isNew: boolean;
    isFree: boolean;
    gachaTs: string;
    seqId: string;
    fetchedAt: number;
  };
  
  const allRecords: MergedRecord[] = [
    ...charRecords.map(r => ({
      recordUid: r.recordUid,
      uid: r.uid,
      category: 'character',
      poolId: r.poolId,
      poolName: r.poolName,
      itemId: r.charId,
      itemName: r.charName,
      itemType: '',
      rarity: r.rarity,
      isNew: r.isNew,
      isFree: r.isFree,
      gachaTs: r.gachaTs,
      seqId: r.seqId,
      fetchedAt: r.fetchedAt,
    })),
    ...weaponRecords.map(r => ({
      recordUid: r.recordUid,
      uid: r.uid,
      category: 'weapon',
      poolId: r.poolId,
      poolName: r.poolName,
      itemId: r.weaponId,
      itemName: r.weaponName,
      itemType: r.weaponType,
      rarity: r.rarity,
      isNew: r.isNew,
      isFree: false,
      gachaTs: r.gachaTs,
      seqId: r.seqId,
      fetchedAt: r.fetchedAt,
    })),
  ];
  
  // 按时间排序（最新的在前）
  allRecords.sort((a, b) => getTimestamp(b.gachaTs) - getTimestamp(a.gachaTs));
  
  for (const record of allRecords) {
    const row = [
      escapeCSVField(record.recordUid),
      escapeCSVField(record.uid),
      escapeCSVField(record.category),
      escapeCSVField(record.poolId),
      escapeCSVField(record.poolName),
      escapeCSVField(record.itemId),
      escapeCSVField(record.itemName),
      escapeCSVField(record.itemType),
      escapeCSVField(record.rarity),
      escapeCSVField(record.isNew ? 1 : 0),
      escapeCSVField(record.isFree ? 1 : 0),
      escapeCSVField(record.gachaTs),
      escapeCSVField(record.seqId),
      escapeCSVField(record.fetchedAt),
    ];
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}

/**
 * 从 CSV 导入抽卡记录
 * 支持角色、武器或统一格式的 CSV
 */
export function importRecordsFromCSV(csvContent: string): {
  charRecords: number;
  weaponRecords: number;
  errors: string[];
} {
  const result = { charRecords: 0, weaponRecords: 0, errors: [] as string[] };
  
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    result.errors.push('CSV 文件为空或格式错误');
    return result;
  }
  
  const headerLine = lines[0];
  if (!headerLine) {
    result.errors.push('CSV 文件头为空');
    return result;
  }
  
  const headers = parseCSVLine(headerLine);
  const headerSet = new Set(headers);
  
  // 判断 CSV 类型
  const isCharCSV = headerSet.has('charId') && headerSet.has('charName');
  const isWeaponCSV = headerSet.has('weaponId') && headerSet.has('weaponName');
  const isUnifiedCSV = headerSet.has('itemId') && headerSet.has('itemName') && headerSet.has('category');
  
  if (!isCharCSV && !isWeaponCSV && !isUnifiedCSV) {
    result.errors.push('无法识别的 CSV 格式，请使用本软件导出的 CSV 文件');
    return result;
  }
  
  // 创建字段索引映射
  const fieldIndex: Record<string, number> = {};
  headers.forEach((h, i) => { fieldIndex[h] = i; });
  
  const newCharRecords: GachaRecord[] = [];
  const newWeaponRecords: WeaponRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      if (!line) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length < headers.length) continue;
      
      const getValue = (key: string): string => {
        const idx = fieldIndex[key];
        return idx !== undefined ? (fields[idx] ?? '') : '';
      };
      const getNumber = (key: string): number => parseInt(getValue(key), 10) || 0;
      const getBool = (key: string): boolean => getValue(key) === '1' || getValue(key).toLowerCase() === 'true';
      
      if (isUnifiedCSV) {
        // 统一格式
        const category = getValue('category');
        if (category === 'character') {
          newCharRecords.push({
            recordUid: getValue('recordUid'),
            uid: getValue('uid'),
            poolId: getValue('poolId'),
            poolName: getValue('poolName'),
            charId: getValue('itemId'),
            charName: getValue('itemName'),
            rarity: getNumber('rarity'),
            isNew: getBool('isNew'),
            isFree: getBool('isFree'),
            gachaTs: getValue('gachaTs'),
            seqId: getValue('seqId'),
            fetchedAt: getNumber('fetchedAt'),
            category: 'character',
          });
        } else if (category === 'weapon') {
          newWeaponRecords.push({
            recordUid: getValue('recordUid'),
            uid: getValue('uid'),
            poolId: getValue('poolId'),
            poolName: getValue('poolName'),
            weaponId: getValue('itemId'),
            weaponName: getValue('itemName'),
            weaponType: getValue('itemType'),
            rarity: getNumber('rarity'),
            isNew: getBool('isNew'),
            gachaTs: getValue('gachaTs'),
            seqId: getValue('seqId'),
            fetchedAt: getNumber('fetchedAt'),
            category: 'weapon',
          });
        }
      } else if (isCharCSV) {
        // 角色格式
        newCharRecords.push({
          recordUid: getValue('recordUid'),
          uid: getValue('uid'),
          poolId: getValue('poolId'),
          poolName: getValue('poolName'),
          charId: getValue('charId'),
          charName: getValue('charName'),
          rarity: getNumber('rarity'),
          isNew: getBool('isNew'),
          isFree: getBool('isFree'),
          gachaTs: getValue('gachaTs'),
          seqId: getValue('seqId'),
          fetchedAt: getNumber('fetchedAt'),
          category: 'character',
        });
      } else if (isWeaponCSV) {
        // 武器格式
        newWeaponRecords.push({
          recordUid: getValue('recordUid'),
          uid: getValue('uid'),
          poolId: getValue('poolId'),
          poolName: getValue('poolName'),
          weaponId: getValue('weaponId'),
          weaponName: getValue('weaponName'),
          weaponType: getValue('weaponType'),
          rarity: getNumber('rarity'),
          isNew: getBool('isNew'),
          gachaTs: getValue('gachaTs'),
          seqId: getValue('seqId'),
          fetchedAt: getNumber('fetchedAt'),
          category: 'weapon',
        });
      }
    } catch {
      result.errors.push(`第 ${i + 1} 行解析失败`);
    }
  }
  
  // 合并角色记录
  if (newCharRecords.length > 0) {
    const existing = getGachaRecords();
    const existingIds = new Set(existing.map(r => r.recordUid));
    
    for (const record of newCharRecords) {
      if (!existingIds.has(record.recordUid)) {
        existing.push(record);
        existingIds.add(record.recordUid);
        result.charRecords++;
      }
    }
    
    if (result.charRecords > 0) {
      existing.sort((a, b) => getTimestamp(b.gachaTs) - getTimestamp(a.gachaTs));
      saveGachaRecords(existing);
    }
  }
  
  // 合并武器记录
  if (newWeaponRecords.length > 0) {
    const existing = getWeaponRecords();
    const existingIds = new Set(existing.map(r => r.recordUid));
    
    for (const record of newWeaponRecords) {
      if (!existingIds.has(record.recordUid)) {
        existing.push(record);
        existingIds.add(record.recordUid);
        result.weaponRecords++;
      }
    }
    
    if (result.weaponRecords > 0) {
      existing.sort((a, b) => getTimestamp(b.gachaTs) - getTimestamp(a.gachaTs));
      saveWeaponRecords(existing);
    }
  }
  
  return result;
}
