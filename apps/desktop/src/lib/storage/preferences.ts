/**
 * 用户偏好管理
 * 这些数据仍然使用 localStorage 存储（同步读取，小数据量）
 */

import { STORAGE_KEYS } from './constants';
import { notifyStorageChange } from './events';

// ============== Token 管理 ==============

/**
 * 保存登录 Token
 */
export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  notifyStorageChange({ keys: [STORAGE_KEYS.TOKEN], reason: 'saveToken' });
}

/**
 * 获取登录 Token
 */
export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * 清除登录 Token
 */
export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  notifyStorageChange({ keys: [STORAGE_KEYS.TOKEN], reason: 'clearToken' });
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
