import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUpdater } from '../useUpdater';
import { UpdateContext, type UpdateCheckSource } from './UpdateContext';

const STORAGE_KEY_LAST_CHECKED_AT = 'efgh.updater.lastCheckedAt';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

type Props = {
  children: React.ReactNode;
  /** 启动后延迟检查（ms），避免影响首屏 */
  startupDelayMs?: number;
};

export function UpdateProvider({ children, startupDelayMs = 2500 }: Props) {
  const updater = useUpdater();

  const [isPortable, setIsPortable] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_CHECKED_AT);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  // 用于避免重复弹 toast（同一会话内）
  const lastToastVersionRef = useRef<string | null>(null);
  const lastCheckSourceRef = useRef<UpdateCheckSource>('manual');
  
  // 用于跟踪自动检查状态，避免竞态条件
  const isAutoCheckingRef = useRef(false);
  // 用于保存周期性定时器 ID
  const periodicTimerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用于保存启动定时器 ID（独立管理，不受其他 effect 影响）
  const startupTimerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 记录启动检查是否已触发
  const startupCheckTriggeredRef = useRef(false);

  // 启动时检测是否为便携版
  useEffect(() => {
    invoke<boolean>('is_portable').then(setIsPortable).catch(() => setIsPortable(true));
  }, []);

  const persistLastCheckedAt = useCallback((ts: number) => {
    setLastCheckedAt(ts);
    localStorage.setItem(STORAGE_KEY_LAST_CHECKED_AT, String(ts));
  }, []);

  // 用 ref 存储最新的 updater.checkForUpdate 引用，避免闭包问题
  const checkForUpdateRef = useRef(updater.checkForUpdate);
  checkForUpdateRef.current = updater.checkForUpdate;
  
  // 用 ref 存储最新的 status，便于在回调中检查
  const statusRef = useRef(updater.status);
  statusRef.current = updater.status;
  
  // 用 ref 存储最新的 lastCheckedAt，便于在回调中获取
  const lastCheckedAtRef = useRef(lastCheckedAt);
  lastCheckedAtRef.current = lastCheckedAt;
  
  // 用 ref 存储 startupDelayMs
  const startupDelayMsRef = useRef(startupDelayMs);
  startupDelayMsRef.current = startupDelayMs;

  /**
   * 执行自动检查更新（内部使用）
   * 使用 ref 跟踪状态，避免被 effect 的重新运行打断或闭包问题
   */
  const doAutoCheck = useCallback(async () => {
    // 防止重复执行
    if (isAutoCheckingRef.current) {
      return;
    }
    
    // 如果当前正在检查或下载，跳过（使用 ref 获取最新状态）
    const currentStatus = statusRef.current;
    if (currentStatus === 'checking' || currentStatus === 'downloading') {
      return;
    }
    
    isAutoCheckingRef.current = true;
    lastCheckSourceRef.current = 'auto';
    
    try {
      // 先记录时间
      const checkTime = Date.now();
      persistLastCheckedAt(checkTime);
      // 执行检查（使用 ref 获取最新函数引用）
      await checkForUpdateRef.current();
    } finally {
      isAutoCheckingRef.current = false;
    }
  }, [persistLastCheckedAt]);

  // 用 ref 存储 doAutoCheck，便于在定时器回调中获取最新版本
  const doAutoCheckRef = useRef(doAutoCheck);
  doAutoCheckRef.current = doAutoCheck;

  /**
   * 对外暴露的手动检查函数
   */
  const checkForUpdate = useCallback(
    async (source: UpdateCheckSource = 'manual') => {
      lastCheckSourceRef.current = source;
      // 本次检查开始前先记录时间
      persistLastCheckedAt(Date.now());
      await updater.checkForUpdate();
    },
    [persistLastCheckedAt, updater.checkForUpdate]
  );

  /**
   * 调度下一次周期性自动检查（12小时后）
   * 使用 ref 获取最新的 lastCheckedAt
   */
  const schedulePeriodicCheck = useCallback(() => {
    // 清除之前的周期性定时器
    if (periodicTimerIdRef.current !== null) {
      clearTimeout(periodicTimerIdRef.current);
      periodicTimerIdRef.current = null;
    }
    
    const checkedAt = lastCheckedAtRef.current;
    if (!checkedAt) {
      // 如果没有记录，立即检查
      periodicTimerIdRef.current = setTimeout(() => {
        periodicTimerIdRef.current = null;
        void doAutoCheckRef.current();
      }, 0);
      return;
    }
    
    const now = Date.now();
    const dueAt = checkedAt + TWELVE_HOURS_MS;
    const delay = Math.max(0, dueAt - now);
    
    periodicTimerIdRef.current = setTimeout(() => {
      periodicTimerIdRef.current = null;
      void doAutoCheckRef.current();
    }, delay);
  }, []);

  // 用 ref 存储 schedulePeriodicCheck
  const schedulePeriodicCheckRef = useRef(schedulePeriodicCheck);
  schedulePeriodicCheckRef.current = schedulePeriodicCheck;

  /**
   * 启动时的自动检查 - 每次启动都执行
   * 使用空依赖数组和 refs 确保不受其他状态变化影响
   */
  useEffect(() => {
    // 每次启动都延迟 startupDelayMs 后执行检查
    startupTimerIdRef.current = setTimeout(() => {
      startupTimerIdRef.current = null;
      startupCheckTriggeredRef.current = true;
      
      // 检查当前状态，如果正在检查则跳过
      const currentStatus = statusRef.current;
      if (currentStatus === 'checking' || currentStatus === 'downloading') {
        // 已经在检查中（可能用户手动触发了），跳过启动检查
        // 但仍需调度下一次周期性检查
        schedulePeriodicCheckRef.current();
        return;
      }
      
      // 执行启动检查
      void doAutoCheckRef.current();
    }, startupDelayMsRef.current);
    
    // 只在组件卸载时清除定时器
    return () => {
      if (startupTimerIdRef.current !== null) {
        clearTimeout(startupTimerIdRef.current);
        startupTimerIdRef.current = null;
      }
      if (periodicTimerIdRef.current !== null) {
        clearTimeout(periodicTimerIdRef.current);
        periodicTimerIdRef.current = null;
      }
    };
    // 空依赖数组，只在挂载时运行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 当检查完成后（lastCheckedAt 更新且不在检查中），重新调度周期性检查
   */
  useEffect(() => {
    // 启动检查还没触发，不处理
    if (!startupCheckTriggeredRef.current) {
      return;
    }
    
    // 如果正在检查或下载，等待完成
    if (updater.status === 'checking' || updater.status === 'downloading') {
      return;
    }
    
    // 重新调度周期性检查
    schedulePeriodicCheckRef.current();
  }, [lastCheckedAt, updater.status]);

  // 有更新时：仅对 auto 检查弹非打断式 toast
  useEffect(() => {
    if (updater.status !== 'available' || !updater.updateInfo) return;
    if (lastCheckSourceRef.current !== 'auto') return;

    const v = updater.updateInfo.version;
    if (lastToastVersionRef.current === v) return;
    lastToastVersionRef.current = v;
    setToastOpen(true);
  }, [updater.status, updater.updateInfo]);

  // 下载完成后：也弹一次 toast 提示重启
  useEffect(() => {
    if (updater.status !== 'ready') return;
    setToastOpen(true);
  }, [updater.status]);

  const hasUpdate = updater.status === 'available' || updater.status === 'downloading' || updater.status === 'ready';

  const nextAutoCheckAt = useMemo(() => {
    if (!lastCheckedAt) return null;
    return lastCheckedAt + TWELVE_HOURS_MS;
  }, [lastCheckedAt]);

  const value = useMemo(
    () => ({
      status: updater.status,
      updateInfo: updater.updateInfo,
      progress: updater.progress,
      error: updater.error,
      downloadAndInstall: updater.downloadAndInstall,
      restartApp: updater.restartApp,
      isPortable,
      hasUpdate,
      lastCheckedAt,
      nextAutoCheckAt,
      checkForUpdate,
      toastOpen,
      setToastOpen,
    }),
    [
      updater.status,
      updater.updateInfo,
      updater.progress,
      updater.error,
      updater.downloadAndInstall,
      updater.restartApp,
      isPortable,
      hasUpdate,
      lastCheckedAt,
      nextAutoCheckAt,
      checkForUpdate,
      toastOpen,
    ]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export default UpdateProvider;
