/**
 * 用户偏好管理
 * 这些数据仍然使用 localStorage 存储（同步读取，小数据量）
 */

import { STORAGE_KEYS } from './constants';
import { notifyStorageChange } from './events';
import type { AccountProvider } from './types';

// ============== Token 管理 ==============

function tokenKeyByProvider(provider: AccountProvider): string {
  return `${STORAGE_KEYS.TOKEN_BY_PROVIDER_PREFIX}${provider}`;
}

/**
 * 保存登录 Token
 * @deprecated 请使用 saveAppToken(provider, token)
 */
export function saveToken(token: string): void {
  // 兼容旧逻辑：默认视为 hypergryph
  saveAppToken('hypergryph', token);
}

/**
 * 获取登录 Token
 * @deprecated 请使用 getAppToken(provider)
 */
export function getToken(): string | null {
  return getAppToken('hypergryph');
}

/**
 * 清除登录 Token
 * @deprecated 请使用 clearAppToken(provider?)
 */
export function clearToken(): void {
  clearAppToken();
}

/**
 * 保存登录 Token（按平台）
 */
export function saveAppToken(provider: AccountProvider, token: string): void {
  // 新键：按平台分别保存
  localStorage.setItem(tokenKeyByProvider(provider), token);
  // 兼容旧键：如果是 hypergryph，同时写入老 key，避免旧版本读不到
  if (provider === 'hypergryph') {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  }
  notifyStorageChange({
    keys: [tokenKeyByProvider(provider), ...(provider === 'hypergryph' ? [STORAGE_KEYS.TOKEN] : [])],
    reason: 'saveAppToken',
  });
}

/**
 * 获取登录 Token（按平台）
 */
export function getAppToken(provider: AccountProvider): string | null {
  const v = localStorage.getItem(tokenKeyByProvider(provider));
  if (v) return v;
  // 兼容：老版本只存了 efgh.token（视为 hypergryph）
  if (provider === 'hypergryph') return localStorage.getItem(STORAGE_KEYS.TOKEN);
  return null;
}

/**
 * 清除登录 Token（按平台）
 * - 不传 provider：清除所有平台 token
 */
export function clearAppToken(provider?: AccountProvider): void {
  if (!provider) {
    localStorage.removeItem(tokenKeyByProvider('hypergryph'));
    localStorage.removeItem(tokenKeyByProvider('gryphline'));
    localStorage.removeItem(STORAGE_KEYS.TOKEN); // 旧键
    notifyStorageChange({
      keys: [tokenKeyByProvider('hypergryph'), tokenKeyByProvider('gryphline'), STORAGE_KEYS.TOKEN],
      reason: 'clearAppToken',
    });
    return;
  }

  localStorage.removeItem(tokenKeyByProvider(provider));
  if (provider === 'hypergryph') localStorage.removeItem(STORAGE_KEYS.TOKEN);
  notifyStorageChange({
    keys: [tokenKeyByProvider(provider), ...(provider === 'hypergryph' ? [STORAGE_KEYS.TOKEN] : [])],
    reason: 'clearAppToken',
  });
}

// ============== 账号平台偏好 ==============

export function getAccountProviderPreference(): AccountProvider {
  const v = localStorage.getItem(STORAGE_KEYS.ACCOUNT_PROVIDER);
  return v === 'gryphline' ? 'gryphline' : 'hypergryph';
}

export function setAccountProviderPreference(provider: AccountProvider): void {
  localStorage.setItem(STORAGE_KEYS.ACCOUNT_PROVIDER, provider);
  notifyStorageChange({ keys: [STORAGE_KEYS.ACCOUNT_PROVIDER], reason: 'setAccountProviderPreference' });
}

// ============== 当前账号 UID 管理 ==============

/**
 * 获取当前选中的账号 UID
 */
export function getActiveUid(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_UID);
}

/**
 * 设置当前选中的账号 UID
 */
export function setActiveUid(uid: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_UID, uid);
  notifyStorageChange({ keys: [STORAGE_KEYS.ACTIVE_UID], reason: 'setActiveUid' });
}

/**
 * 清除当前选中的账号 UID
 */
export function clearActiveUid(): void {
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_UID);
  notifyStorageChange({ keys: [STORAGE_KEYS.ACTIVE_UID], reason: 'clearActiveUid' });
}

// ============== 窗口关闭行为管理 ==============

/** 窗口关闭行为类型 */
export type CloseBehavior = 'exit' | 'minimize';

/**
 * 获取窗口关闭行为偏好
 * @returns 'exit' | 'minimize' | null (未设置)
 */
export function getCloseBehavior(): CloseBehavior | null {
  const value = localStorage.getItem(STORAGE_KEYS.CLOSE_BEHAVIOR);
  if (value === 'exit' || value === 'minimize') {
    return value;
  }
  return null;
}

/**
 * 设置窗口关闭行为偏好
 */
export function setCloseBehavior(behavior: CloseBehavior): void {
  localStorage.setItem(STORAGE_KEYS.CLOSE_BEHAVIOR, behavior);
  notifyStorageChange({ keys: [STORAGE_KEYS.CLOSE_BEHAVIOR], reason: 'setCloseBehavior' });
}

/**
 * 清除窗口关闭行为偏好（恢复为每次询问）
 */
export function clearCloseBehavior(): void {
  localStorage.removeItem(STORAGE_KEYS.CLOSE_BEHAVIOR);
  notifyStorageChange({ keys: [STORAGE_KEYS.CLOSE_BEHAVIOR], reason: 'clearCloseBehavior' });
}

// ============== 侧边栏折叠偏好 ==============

/**
 * 获取侧边栏是否折叠
 * @returns boolean（默认 false）
 */
export function getSidebarCollapsed(): boolean {
  const value = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
  return value === '1' || value === 'true';
}

/**
 * 设置侧边栏折叠状态
 */
export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed ? '1' : '0');
  notifyStorageChange({
    keys: [STORAGE_KEYS.SIDEBAR_COLLAPSED],
    reason: 'setSidebarCollapsed',
  });
}

/**
 * 清除侧边栏折叠偏好（恢复默认展开）
 */
export function clearSidebarCollapsed(): void {
  localStorage.removeItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
  notifyStorageChange({
    keys: [STORAGE_KEYS.SIDEBAR_COLLAPSED],
    reason: 'clearSidebarCollapsed',
  });
}
