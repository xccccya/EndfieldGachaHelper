/**
 * 存储变更事件通知
 * 用于通知 React 组件刷新数据
 */

import type { StorageChangeDetail } from './types';

/** 存储变更事件名称 */
export const STORAGE_CHANGE_EVENT = 'efgh:storage_change';

/**
 * 触发存储变更事件
 * @param detail 变更详情（可选）
 */
export function notifyStorageChange(detail?: Omit<StorageChangeDetail, 'at'>): void {
  // Tauri/浏览器环境下有效；SSR/非浏览器环境下安全降级
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<StorageChangeDetail>(STORAGE_CHANGE_EVENT, {
      detail: { at: Date.now(), ...detail },
    })
  );
}

/**
 * 订阅存储变更事件
 * @param callback 变更回调
 * @returns 取消订阅函数
 */
export function subscribeStorageChange(callback: (detail: StorageChangeDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<StorageChangeDetail>;
    callback(customEvent.detail);
  };
  
  window.addEventListener(STORAGE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(STORAGE_CHANGE_EVENT, handler);
}
