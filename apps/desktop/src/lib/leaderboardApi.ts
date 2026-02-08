/**
 * 排行榜 API 调用封装
 *
 * 复用 syncApi 的 authenticatedRequest，自动处理 Token 过期刷新，
 * 避免排行榜页面因 Access Token 过期而无法获取"我的排名"或用户设置。
 */

import { authenticatedRequest, SyncApiError } from './syncApi';
import type {
  AllLeaderboardsResponse,
  LeaderboardSettings,
  UpdateLeaderboardSettingsRequest,
} from '@efgachahelper/shared';

/**
 * 排行榜 API 客户端
 */
export const leaderboardApi = {
  /**
   * 获取所有排行榜数据
   */
  async getAllLeaderboards(accessToken?: string): Promise<AllLeaderboardsResponse> {
    return authenticatedRequest<AllLeaderboardsResponse>('/leaderboard/all', {
      method: 'GET',
      ...(accessToken ? { accessToken } : {}),
    });
  },

  /**
   * 获取用户排行榜设置
   */
  async getSettings(accessToken: string): Promise<LeaderboardSettings> {
    return authenticatedRequest<LeaderboardSettings>('/leaderboard/settings', {
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
    return authenticatedRequest<LeaderboardSettings>('/leaderboard/settings', {
      method: 'PUT',
      body: data,
      accessToken,
    });
  },
};

/**
 * @deprecated 使用 SyncApiError 替代
 */
export { SyncApiError as LeaderboardApiError };
