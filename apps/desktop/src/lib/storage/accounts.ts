/**
 * 账号管理
 * 使用 SQLite 作为唯一数据源
 */

import type { BindingAccount, GameRole } from '@efgachahelper/shared';
import {
  dbGetAccounts,
  dbSaveAccount,
  dbRemoveAccount,
} from '../db';
import type { StoredAccount } from './types';
import { notifyStorageChange } from './events';
import { getActiveUid, setActiveUid, clearActiveUid } from './preferences';

// ============== 辅助函数 ==============

/**
 * 生成账号主键
 * 格式: serverId:roleId
 */
export function makeAccountKey(serverId: string, roleId: string): string {
  return `${serverId}:${roleId}`;
}

/**
 * 解析账号主键
 */
export function parseAccountKey(accountKey: string): { serverId: string; roleId: string } | null {
  if (!accountKey) return null;
  const idx = accountKey.indexOf(':');
  if (idx <= 0 || idx === accountKey.length - 1) return null;
  const serverId = accountKey.slice(0, idx).trim();
  const roleId = accountKey.slice(idx + 1).trim();
  if (!serverId || !roleId) return null;
  return { serverId, roleId };
}

/**
 * 获取账号的 roleId
 */
export function getAccountRoleId(account: StoredAccount): string | null {
  return (
    account.roleId ??
    account.roles[0]?.roleId ??
    parseAccountKey(account.uid)?.roleId ??
    null
  );
}

/**
 * 获取账号的 serverId
 */
export function getAccountServerId(account: StoredAccount): string | null {
  return (
    account.serverId ??
    account.roles[0]?.serverId ??
    parseAccountKey(account.uid)?.serverId ??
    null
  );
}

/**
 * 获取账号的 hgUid
 */
export function getAccountHgUid(account: StoredAccount): string | null {
  // 新版优先使用显式字段；旧版历史数据中 uid 可能就是 hgUid
  if (account.hgUid) return account.hgUid;
  if (account.roles[0]?.roleId && account.roles[0]?.serverId) return account.uid || null;
  return null;
}

// ============== 数据转换 ==============

/**
 * 将 DB 格式转换为 StoredAccount
 */
function dbAccountToStored(dbAccount: {
  uid: string;
  channel_name: string;
  roles: string;
  added_at: number;
}): StoredAccount {
  let roles: GameRole[] = [];
  try {
    const parsed: unknown = JSON.parse(dbAccount.roles);
    roles = Array.isArray(parsed) ? (parsed as GameRole[]) : [];
  } catch {
    roles = [];
  }

  // 解析 uid 以获取 serverId 和 roleId
  const parsed = parseAccountKey(dbAccount.uid);

  return {
    uid: dbAccount.uid,
    channelName: dbAccount.channel_name,
    roles,
    addedAt: dbAccount.added_at,
    // 如果 uid 是 serverId:roleId 格式，设置 serverId 和 roleId
    ...(parsed ? { serverId: parsed.serverId, roleId: parsed.roleId } : {}),
    // 从 roles 中获取 hgUid（如果有）
    ...(roles[0]?.roleId ? {} : { hgUid: dbAccount.uid }),
  };
}

/**
 * 将 StoredAccount 转换为 DB 格式
 */
function storedAccountToDB(account: StoredAccount): {
  uid: string;
  channel_name: string;
  roles: string;
  added_at: number;
} {
  return {
    uid: account.uid,
    channel_name: account.channelName,
    roles: JSON.stringify(account.roles ?? []),
    added_at: account.addedAt,
  };
}

// ============== 账号 CRUD ==============

/**
 * 获取所有账号（异步）
 */
export async function getAccounts(): Promise<StoredAccount[]> {
  const dbAccounts = await dbGetAccounts();
  return dbAccounts.map(dbAccountToStored);
}

/**
 * 保存单个账号
 */
export async function saveAccount(account: StoredAccount): Promise<void> {
  await dbSaveAccount(storedAccountToDB(account));
  notifyStorageChange({ keys: ['accounts'], reason: 'saveAccount' });
}

/**
 * 批量保存账号
 */
export async function saveAccounts(accounts: StoredAccount[]): Promise<void> {
  for (const account of accounts) {
    await dbSaveAccount(storedAccountToDB(account));
  }
  notifyStorageChange({ keys: ['accounts'], reason: 'saveAccounts' });
}

/**
 * 删除账号
 */
export async function removeAccount(uid: string): Promise<void> {
  await dbRemoveAccount(uid);
  
  // 如果删除的是当前激活的账号，清除激活状态
  if (getActiveUid() === uid) {
    clearActiveUid();
  }
  
  notifyStorageChange({ keys: ['accounts'], reason: 'removeAccount' });
}

/**
 * 根据绑定信息添加/更新账号
 * 一个 binding 的每个 role 对应一个账号（uid=serverId:roleId）
 */
export async function addAccountsFromBinding(binding: BindingAccount): Promise<StoredAccount[]> {
  const existingAccounts = await getAccounts();
  const now = Date.now();

  const roles = Array.isArray(binding.roles) ? binding.roles : [];
  const upserted: StoredAccount[] = [];

  // 若 roles 为空（极少见/异常），保底仍存一条"旧风格"账号
  if (roles.length === 0) {
    const existing = existingAccounts.find((a) => a.uid === binding.uid);
    const account: StoredAccount = {
      uid: binding.uid,
      hgUid: binding.uid,
      channelName: binding.channelName,
      roles: [],
      addedAt: existing?.addedAt ?? now,
    };
    await saveAccount(account);
    upserted.push(account);
    return upserted;
  }

  for (const role of roles) {
    const accountKey = makeAccountKey(role.serverId, role.roleId);
    const existing = existingAccounts.find((a) => a.uid === accountKey);

    const channelName = role.serverName
      ? `${binding.channelName} · ${role.serverName}`
      : binding.channelName;

    const account: StoredAccount = {
      uid: accountKey,
      hgUid: binding.uid,
      roleId: role.roleId,
      serverId: role.serverId,
      channelName,
      roles: [role],
      addedAt: existing?.addedAt ?? now,
    };

    await saveAccount(account);
    upserted.push(account);
  }

  return upserted;
}

/**
 * 确保本地账号记录存在（用于云同步下载时创建账号）
 */
export async function ensureAccountExists(uid: string, region: string): Promise<string> {
  const existingAccounts = await getAccounts();
  
  // 新版云同步：uid=roleId, region=serverId
  // 旧版兼容：uid=hgUid, region='default'
  const localUid = region && region !== 'default' ? makeAccountKey(region, uid) : uid;
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
  console.log(`[storage/accounts] 已创建本地账号记录: ${localUid}`);
  return localUid;
}

/**
 * 根据 UID 获取单个账号
 */
export async function getAccountByUid(uid: string): Promise<StoredAccount | null> {
  const accounts = await getAccounts();
  return accounts.find((a) => a.uid === uid) ?? null;
}

// ============== 当前账号快捷访问 ==============

/**
 * 获取当前激活的账号
 */
export async function getActiveAccount(): Promise<StoredAccount | null> {
  const activeUid = getActiveUid();
  if (!activeUid) return null;
  return getAccountByUid(activeUid);
}

/**
 * 选择账号（设置为当前激活账号）
 */
export function selectAccount(uid: string): void {
  setActiveUid(uid);
}
