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
    // 注意：不要依赖整个 updater 对象（每次渲染引用都会变），否则会导致定时器反复重置
    [persistLastCheckedAt, updater.checkForUpdate]
  );

  /**
   * 自动检查更新调度：
   * - 首次启动：若从未检查 / 距离上次检查已超过 12 小时，则延迟 startupDelayMs 后检查一次
   * - 后续：按 lastCheckedAt + 12h 精准调度下一次检查（避免 setInterval 漂移）
   *
   * 这样可以避免因为组件重渲染而反复创建 interval 导致的“不断检查更新”问题。
   */
  useEffect(() => {
    const now = Date.now();
    const dueAt = lastCheckedAt ? lastCheckedAt + TWELVE_HOURS_MS : now;
    const isDue = now >= dueAt;

    // 如果当前正在检查/下载，就先不触发自动检查；等状态变化后 effect 会重新计算调度
    if (updater.status === 'checking' || updater.status === 'downloading') return;

    const delay = isDue ? startupDelayMs : Math.max(0, dueAt - now);
    const t = window.setTimeout(() => {
      void checkForUpdate('auto');
    }, delay);

    return () => window.clearTimeout(t);
  }, [checkForUpdate, lastCheckedAt, startupDelayMs, updater.status]);

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

