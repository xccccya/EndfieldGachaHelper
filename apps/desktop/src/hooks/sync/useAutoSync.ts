/**
 * 自动同步 Hook
 * 处理：
 * 1. 应用启动时自动同步
 * 2. 本地数据变化后自动上传
 * 3. 定时拉取云端最新数据
 */

import { useCallback, useEffect, useRef } from 'react';
import { AUTO_SYNC_INTERVAL } from './config';
import { useSyncConfig } from './useSyncConfig';
import { useSyncAuth } from './useSyncAuth';
import { subscribeStorageChange } from '../../lib/storage';

/**
 * 自动同步 Hook
 */
export function useAutoSync() {
  const { isLoggedIn, autoSync } = useSyncConfig();
  const { manualSync, loading } = useSyncAuth();
  const syncInProgressRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  const lastAutoSyncAtRef = useRef<string | null>(null);

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
        // 仅用于调试/观测，不触发组件重渲染（避免在云同步页“看起来一直刷新”）
        lastAutoSyncAtRef.current = new Date().toISOString();
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
        void doAutoSync();
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
      void doAutoSync();
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

    const handleLocalDataChange = () => {
      // 清除之前的 timer，实现防抖效果
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      // 延迟执行，避免频繁触发
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void doAutoSync();
      }, 3000);
    };

    // 监听存储变更：本地记录新增/导入/清空等，都应触发一次自动同步。
    // 但必须忽略云同步自身写入本地触发的事件（reason: 'cloudSync'），避免形成循环。
    const unsubscribe = subscribeStorageChange((detail) => {
      if (detail?.reason === 'cloudSync') return;
      const keys = detail?.keys ?? [];
      if (!Array.isArray(keys)) return;
      if (!keys.includes('gachaRecords') && !keys.includes('weaponRecords')) return;
      handleLocalDataChange();
    });

    return () => {
      unsubscribe();
      // 清理 effect 时清除 timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isLoggedIn, autoSync, doAutoSync]);

  return {
    lastAutoSyncAt: lastAutoSyncAtRef.current,
    syncInProgress: syncInProgressRef.current,
  };
}
