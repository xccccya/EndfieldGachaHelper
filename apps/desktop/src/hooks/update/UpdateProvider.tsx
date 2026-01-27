import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  const [toastOpen, setToastOpen] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_CHECKED_AT);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  // 用于避免重复弹 toast（同一会话内）
  const lastToastVersionRef = useRef<string | null>(null);
  const lastCheckSourceRef = useRef<UpdateCheckSource>('manual');

  const persistLastCheckedAt = useCallback((ts: number) => {
    setLastCheckedAt(ts);
    localStorage.setItem(STORAGE_KEY_LAST_CHECKED_AT, String(ts));
  }, []);

  const checkForUpdate = useCallback(
    async (source: UpdateCheckSource = 'manual') => {
      lastCheckSourceRef.current = source;
      // 本次检查开始前先记录时间，避免异常重试导致频繁触发
      persistLastCheckedAt(Date.now());
      await updater.checkForUpdate();
    },
    [persistLastCheckedAt, updater]
  );

  // 启动自动检查一次
  useEffect(() => {
    const t = window.setTimeout(() => {
      void checkForUpdate('auto');
    }, startupDelayMs);
    return () => window.clearTimeout(t);
  }, [checkForUpdate, startupDelayMs]);

  // 每 12 小时自动检查一次
  useEffect(() => {
    const id = window.setInterval(() => {
      void checkForUpdate('auto');
    }, TWELVE_HOURS_MS);
    return () => window.clearInterval(id);
  }, [checkForUpdate]);

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

