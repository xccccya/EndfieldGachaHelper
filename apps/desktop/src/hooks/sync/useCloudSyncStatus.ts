/**
 * 云端同步状态 Hook
 */

import { useCallback, useEffect, useState } from 'react';
import { syncApi, SyncApiError } from '../../lib/syncApi';
import { useSyncConfig } from './useSyncConfig';

/**
 * 获取云端同步状态信息
 */
export function useCloudSyncStatus() {
  const { config, isLoggedIn } = useSyncConfig();
  const [status, setStatus] = useState<{
    accounts: Array<{
      uid: string;
      region: string;
      characterCount: number;
      weaponCount: number;
      lastRecordAt: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isLoggedIn || !config.accessToken) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await syncApi.getSyncStatus(config.accessToken);
      setStatus(result);
    } catch (e) {
      const message = e instanceof SyncApiError ? e.message : '获取同步状态失败';
      setError(message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, config.accessToken]);

  // 初始化时获取状态
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}
