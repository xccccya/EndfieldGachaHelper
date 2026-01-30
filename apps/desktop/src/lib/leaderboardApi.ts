/**
 * 排行榜 API 调用封装
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauri } from './tauriHttp';
import { getCurrentApiUrl } from './syncApi';
import type {
  AllLeaderboardsResponse,
  LeaderboardSettings,
  UpdateLeaderboardSettingsRequest,
} from '@efgachahelper/shared';

/**
 * API 请求错误类
 */
class LeaderboardApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'LeaderboardApiError';
    this.statusCode = statusCode;
  }
}

/**
 * 发送 API 请求
 */
async function request<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    accessToken?: string;
  } = {}
): Promise<T> {
  const { method = 'GET', body, accessToken } = options;
  const url = `${getCurrentApiUrl()}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchFn = isTauri() ? tauriFetch : fetch;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetchFn(url, fetchOptions);
  const data: unknown = await response.json();

  if (!response.ok) {
    const error = data && typeof data === 'object' ? (data as { message?: string }) : null;
    throw new LeaderboardApiError(
      response.status,
      error?.message || '请求失败'
    );
  }

  return data as T;
}

/**
 * 排行榜 API 客户端
 */
export const leaderboardApi = {
  /**
   * 获取所有排行榜数据
   */
  async getAllLeaderboards(accessToken?: string): Promise<AllLeaderboardsResponse> {
    return request<AllLeaderboardsResponse>('/leaderboard/all', {
      method: 'GET',
      ...(accessToken ? { accessToken } : {}),
    });
  },

  /**
   * 获取用户排行榜设置
   */
  async getSettings(accessToken: string): Promise<LeaderboardSettings> {
    return request<LeaderboardSettings>('/leaderboard/settings', {
      method: 'GET',
      accessToken,
    });
  },

  /**
   * 更新用户排行榜设置
   */
  async updateSettings(
    accessToken: string,
    data: UpdateLeaderboardSettingsRequest
  ): Promise<LeaderboardSettings> {
    return request<LeaderboardSettings>('/leaderboard/settings', {
      method: 'PUT',
      body: data,
      accessToken,
    });
  },
};

export { LeaderboardApiError };
