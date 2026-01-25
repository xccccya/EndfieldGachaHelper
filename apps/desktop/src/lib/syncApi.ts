/**
 * 云同步 API 调用封装
 * 处理与后端 API 的通信
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type {
  AuthResponse,
  RefreshResponse,
  OkResponse,
  CheckEmailResponse,
  SendCodeRequest,
  RegisterRequest,
  LoginRequest,
  ResetPasswordRequest,
  RefreshRequest,
  LogoutRequest,
  SyncUser,
  SyncUploadRequest,
  SyncUploadResponse,
  SyncDownloadParams,
  SyncDownloadResponse,
  SyncStatusResponse,
  GameAccountListResponse,
  GameAccountResponse,
  CreateGameAccountRequest,
} from '@efgachahelper/shared';
import { isTauri } from './tauriHttp';

// API 基础 URL
// 优先使用本地存储的自定义地址，其次使用环境变量，最后使用默认值
function getEnvApiUrl(): string | null {
  const v: unknown = import.meta.env?.VITE_API_URL;
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}
const DEFAULT_API_URL = getEnvApiUrl() ?? 'http://localhost:3011/api';

function getApiBaseUrl(): string {
  try {
    const customUrl = localStorage.getItem('efgh_api_url');
    if (customUrl) return customUrl;
  } catch {
    // localStorage 不可用
  }
  return DEFAULT_API_URL;
}

// 动态获取 API URL
const getApiUrl = () => getApiBaseUrl();

// 设置自定义 API URL
export function setApiUrl(url: string | null): void {
  try {
    if (url) {
      localStorage.setItem('efgh_api_url', url);
    } else {
      localStorage.removeItem('efgh_api_url');
    }
  } catch {
    // localStorage 不可用
  }
}

// 获取当前 API URL（供 UI 显示）
export function getCurrentApiUrl(): string {
  return getApiBaseUrl();
}

// 获取默认 API URL
export function getDefaultApiUrl(): string {
  return DEFAULT_API_URL;
}

type ApiError = {
  statusCode: number;
  message: string;
  error?: string;
};

class SyncApiError extends Error {
  statusCode: number;
  
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'SyncApiError';
    this.statusCode = statusCode;
  }
}

// Token 管理：用于自动刷新
const SYNC_CONFIG_KEY = 'efgh_sync_config';

type SyncConfigForRefresh = {
  accessToken?: string;
  refreshToken?: string;
};

function getSyncConfigTokens(): SyncConfigForRefresh {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw) as SyncConfigForRefresh;
    }
  } catch {
    // ignore
  }
  return {};
}

function updateSyncConfigTokens(tokens: { accessToken: string; refreshToken: string }): void {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);

    const parseObject = (json: string): Record<string, unknown> | null => {
      try {
        const v: unknown = JSON.parse(json);
        if (!v || typeof v !== 'object') return null;
        return v as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const prev = raw ? (parseObject(raw) ?? {}) : {};
    const next: Record<string, unknown> = {
      ...prev,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      syncError: null,
    };

    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(next));
    // 通知状态变化
    window.dispatchEvent(new CustomEvent('efgh:sync_change'));
  } catch {
    // ignore
  }
}

function clearSyncConfig(errorMessage?: string): void {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify({
      user: null,
      accessToken: null,
      refreshToken: null,
      autoSync: false,
      lastSyncAt: null,
      syncError: errorMessage ?? null,
    }));
    window.dispatchEvent(new CustomEvent('efgh:sync_change'));
  } catch {
    // ignore
  }
}

// 防止并发刷新
let refreshPromise: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

/**
 * 尝试刷新 access token
 */
async function tryRefreshToken(): Promise<{ accessToken: string; refreshToken: string } | null> {
  // 如果已经在刷新，等待现有的刷新完成
  if (refreshPromise) {
    return refreshPromise;
  }

  const { refreshToken } = getSyncConfigTokens();
  if (!refreshToken) {
    return null;
  }

  refreshPromise = (async () => {
    try {
      const fetchFn = isTauri() ? tauriFetch : fetch;
      const response = await fetchFn(`${getApiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // 刷新失败，清除登录状态并保留错误信息
        console.log('[SyncApi] Refresh token 已过期，需要重新登录');
        clearSyncConfig('登录已过期，请重新登录');
        return null;
      }

      const data = await response.json() as { accessToken: string; refreshToken: string };
      // 更新本地存储的 token
      updateSyncConfigTokens(data);
      console.log('[SyncApi] Token 已自动刷新');
      return data;
    } catch {
      // 刷新失败，清除登录状态并保留错误信息
      clearSyncConfig('登录已过期，请重新登录');
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * 发送 API 请求（带自动 token 刷新）
 */
async function request<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    accessToken?: string;
  } = {},
): Promise<T> {
  const { method = 'GET', body, accessToken } = options;
  const url = `${getApiUrl()}${endpoint}`;
  
  const doRequest = async (token?: string): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
      const error = (data && typeof data === 'object' ? (data as Partial<ApiError>) : null);
      throw new SyncApiError(
        error?.statusCode || response.status,
        error?.message || '请求失败',
      );
    }
    
    return data as T;
  };
  
  try {
    return await doRequest(accessToken);
  } catch (error) {
    // 如果是 401 且有 accessToken，尝试刷新 token 并重试
    if (error instanceof SyncApiError && error.statusCode === 401 && accessToken) {
      console.log('[SyncApi] Access token 过期，尝试刷新...');
      const newTokens = await tryRefreshToken();
      
      if (newTokens) {
        // 使用新 token 重试请求
        try {
          return await doRequest(newTokens.accessToken);
        } catch (retryError) {
          if (retryError instanceof SyncApiError) {
            throw retryError;
          }
          const message = retryError instanceof Error ? retryError.message : '网络请求失败';
          throw new SyncApiError(0, message);
        }
      } else {
        // 刷新失败，抛出原始错误（会触发重新登录）
        throw new SyncApiError(401, '登录已过期，请重新登录');
      }
    }
    
    if (error instanceof SyncApiError) {
      throw error;
    }
    
    // 网络错误或其他错误
    const message = error instanceof Error ? error.message : '网络请求失败';
    throw new SyncApiError(0, message);
  }
}

/**
 * 同步 API 客户端
 */
export const syncApi = {
  /**
   * 发送验证码
   */
  async sendCode(data: SendCodeRequest): Promise<OkResponse> {
    return request<OkResponse>('/auth/send-code', {
      method: 'POST',
      body: data,
    });
  },
  
  /**
   * 检查邮箱是否已注册
   */
  async checkEmail(email: string): Promise<CheckEmailResponse> {
    return request<CheckEmailResponse>('/auth/check-email', {
      method: 'POST',
      body: { email },
    });
  },
  
  /**
   * 注册
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: data,
    });
  },
  
  /**
   * 登录
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: data,
    });
  },
  
  /**
   * 重置密码
   */
  async resetPassword(data: ResetPasswordRequest): Promise<OkResponse> {
    return request<OkResponse>('/auth/reset-password', {
      method: 'POST',
      body: data,
    });
  },
  
  /**
   * 刷新 Token
   */
  async refresh(data: RefreshRequest): Promise<RefreshResponse> {
    return request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: data,
    });
  },
  
  /**
   * 登出
   */
  async logout(data: LogoutRequest): Promise<OkResponse> {
    return request<OkResponse>('/auth/logout', {
      method: 'POST',
      body: data,
    });
  },
  
  /**
   * 获取当前用户信息
   */
  async getMe(accessToken: string): Promise<{ user: SyncUser }> {
    return request<{ user: SyncUser }>('/me', {
      method: 'GET',
      accessToken,
    });
  },
  
  /**
   * 检查 API 服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const fetchFn = isTauri() ? tauriFetch : fetch;
      // 健康检查端点在 /api/health（全局前缀）
      const response = await fetchFn(`${getApiUrl()}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // ============== 同步数据 API ==============

  /**
   * 获取游戏账号列表
   */
  async getGameAccounts(accessToken: string): Promise<GameAccountListResponse> {
    return request<GameAccountListResponse>('/sync/accounts', {
      method: 'GET',
      accessToken,
    });
  },

  /**
   * 创建游戏账号
   */
  async createGameAccount(
    accessToken: string,
    data: CreateGameAccountRequest,
  ): Promise<GameAccountResponse> {
    return request<GameAccountResponse>('/sync/accounts', {
      method: 'POST',
      body: data,
      accessToken,
    });
  },

  /**
   * 上传抽卡记录
   */
  async uploadRecords(
    accessToken: string,
    data: SyncUploadRequest,
  ): Promise<SyncUploadResponse> {
    return request<SyncUploadResponse>('/sync/upload', {
      method: 'POST',
      body: data,
      accessToken,
    });
  },

  /**
   * 下载抽卡记录
   */
  async downloadRecords(
    accessToken: string,
    params: SyncDownloadParams,
  ): Promise<SyncDownloadResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('uid', params.uid);
    queryParams.set('region', params.region);
    if (params.hgUid) {
      queryParams.set('hgUid', params.hgUid);
    }
    if (params.category) {
      queryParams.set('category', params.category);
    }
    if (params.since) {
      queryParams.set('since', params.since);
    }

    return request<SyncDownloadResponse>(
      `/sync/download?${queryParams.toString()}`,
      {
        method: 'GET',
        accessToken,
      },
    );
  },

  /**
   * 获取同步状态
   */
  async getSyncStatus(accessToken: string): Promise<SyncStatusResponse> {
    return request<SyncStatusResponse>('/sync/status', {
      method: 'GET',
      accessToken,
    });
  },

  /**
   * 清理云端重复记录
   */
  async cleanupDuplicates(accessToken: string): Promise<{ deleted: number }> {
    return request<{ deleted: number }>('/sync/cleanup', {
      method: 'POST',
      accessToken,
    });
  },
};

export { SyncApiError };
