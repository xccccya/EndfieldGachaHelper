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
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3011/api';

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

/**
 * 发送 API 请求
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
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const fetchFn = isTauri() ? tauriFetch : fetch;
  
  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    const response = await fetchFn(url, fetchOptions);
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = data as ApiError;
      throw new SyncApiError(
        error.statusCode || response.status,
        error.message || '请求失败',
      );
    }
    
    return data as T;
  } catch (error) {
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
