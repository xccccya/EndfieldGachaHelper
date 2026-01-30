/**
 * 排行榜相关 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { leaderboardApi } from '../lib/leaderboardApi';
import { useSyncConfig } from './useSync';
import type {
  AllLeaderboardsResponse,
  LeaderboardSettings,
  UpdateLeaderboardSettingsRequest,
} from '@efgachahelper/shared';

/**
 * 获取排行榜数据
 */
export function useLeaderboard() {
  const [data, setData] = useState<AllLeaderboardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useSyncConfig();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await leaderboardApi.getAllLeaderboards(accessToken ?? undefined);
      setData(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : '获取排行榜失败';
      setError(message);
      console.error('获取排行榜失败:', e);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}

/**
 * 管理排行榜用户设置
 */
export function useLeaderboardSettings() {
  const [settings, setSettings] = useState<LeaderboardSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const { accessToken, isLoggedIn } = useSyncConfig();

  // 获取设置
  const fetchSettings = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const result = await leaderboardApi.getSettings(accessToken);
      setSettings(result);
    } catch (e) {
      console.error('获取排行榜设置失败:', e);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // 更新设置
  const updateSettings = useCallback(
    async (update: UpdateLeaderboardSettingsRequest) => {
      if (!accessToken) return;

      setLoading(true);
      try {
        const result = await leaderboardApi.updateSettings(accessToken, update);
        setSettings(result);
      } catch (e) {
        console.error('更新排行榜设置失败:', e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  // 登录状态变化时获取设置
  useEffect(() => {
    if (isLoggedIn) {
      void fetchSettings();
    } else {
      setSettings(null);
    }
  }, [isLoggedIn, fetchSettings]);

  return {
    settings,
    loading,
    fetchSettings,
    updateSettings,
  };
}
