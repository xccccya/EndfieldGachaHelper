/**
 * 应用更新检查 Hook
 */

import { useState, useCallback } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/** 更新状态 */
export type UpdateStatus = 
  | 'idle'           // 空闲
  | 'checking'       // 检查中
  | 'available'      // 有新版本
  | 'not-available'  // 已是最新
  | 'downloading'    // 下载中
  | 'ready'          // 准备安装
  | 'error';         // 出错

/** 更新信息 */
export interface UpdateInfo {
  version: string;
  body?: string;  // 更新说明
  date?: string;  // 发布日期
}

/** Hook 返回类型 */
export interface UseUpdaterReturn {
  /** 当前状态 */
  status: UpdateStatus;
  /** 更新信息（有新版本时） */
  updateInfo: UpdateInfo | null;
  /** 下载进度 (0-100) */
  progress: number;
  /** 错误信息 */
  error: string | null;
  /** 检查更新 */
  checkForUpdate: () => Promise<void>;
  /** 下载并安装更新 */
  downloadAndInstall: () => Promise<void>;
  /** 重启应用 */
  restartApp: () => Promise<void>;
}

/**
 * 应用更新 Hook
 * 
 * @example
 * ```tsx
 * const { status, updateInfo, progress, checkForUpdate, downloadAndInstall, restartApp } = useUpdater();
 * 
 * // 检查更新
 * await checkForUpdate();
 * 
 * // 如果有更新，下载并安装
 * if (status === 'available') {
 *   await downloadAndInstall();
 * }
 * 
 * // 重启应用
 * if (status === 'ready') {
 *   await restartApp();
 * }
 * ```
 */
export function useUpdater(): UseUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  // 检查更新
  const checkForUpdate = useCallback(async () => {
    setStatus('checking');
    setError(null);
    setUpdateInfo(null);
    setProgress(0);

    try {
      const update = await check();
      
      if (update) {
        const info: UpdateInfo = { version: update.version };
        if (update.body) info.body = update.body;
        if (update.date) info.date = update.date;
        setUpdateInfo(info);
        setPendingUpdate(update);
        setStatus('available');
      } else {
        setStatus('not-available');
      }
    } catch (err) {
      console.error('检查更新失败:', err);
      setError(err instanceof Error ? err.message : '检查更新失败');
      setStatus('error');
    }
  }, []);

  // 下载并安装更新
  const downloadAndInstall = useCallback(async () => {
    if (!pendingUpdate) {
      setError('没有待更新的版本');
      setStatus('error');
      return;
    }

    setStatus('downloading');
    setProgress(0);
    setError(null);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      setStatus('ready');
    } catch (err) {
      console.error('下载更新失败:', err);
      setError(err instanceof Error ? err.message : '下载更新失败');
      setStatus('error');
    }
  }, [pendingUpdate]);

  // 重启应用
  const restartApp = useCallback(async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error('重启应用失败:', err);
      setError(err instanceof Error ? err.message : '重启应用失败');
      setStatus('error');
    }
  }, []);

  return {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdate,
    downloadAndInstall,
    restartApp,
  };
}

export default useUpdater;
