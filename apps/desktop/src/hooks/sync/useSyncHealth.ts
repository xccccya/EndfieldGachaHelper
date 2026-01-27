/**
 * API 健康检查 Hook
 */

import { useSyncExternalStore } from 'react';
import { syncApi } from '../../lib/syncApi';

type HealthState = { isHealthy: boolean | null; checking: boolean };

/**
 * ============== 简易全局 store（模块级单例） ==============
 * 设计目标：
 * - 全应用只保留一条健康检查轮询（避免 MainLayout + CloudSyncPage 重复 setInterval）
 * - 多处使用该 Hook 时共享同一份状态
 */
const healthStore = (() => {
  let state: HealthState = { isHealthy: null, checking: false };
  const listeners = new Set<() => void>();
  let interval: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<boolean> | null = null;

  const emit = () => {
    for (const l of listeners) l();
  };

  const setState = (next: HealthState) => {
    state = next;
    emit();
  };

  const check = async (): Promise<boolean> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      setState({ ...state, checking: true });
      try {
        const healthy = await syncApi.healthCheck();
        setState({ isHealthy: healthy, checking: false });
        return healthy;
      } catch {
        setState({ isHealthy: false, checking: false });
        return false;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  const ensureInterval = () => {
    if (interval) return;
    void check();
    interval = setInterval(() => {
      void check();
    }, 30000);
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    ensureInterval();
    return () => {
      listeners.delete(cb);
      if (listeners.size === 0 && interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  };

  const get = () => state;
  return { get, subscribe, check };
})();

/**
 * 检查 API 服务可用性 Hook
 */
export function useSyncHealth() {
  const snapshot = useSyncExternalStore(healthStore.subscribe, healthStore.get, healthStore.get);
  return { ...snapshot, checkHealth: healthStore.check };
}
