/**
 * Tauri HTTP 客户端封装
 * 提供 fetch-like 接口，用于 endfieldApi
 * 
 * Tauri v2 的 @tauri-apps/plugin-http 提供了与浏览器 fetch 兼容的 API
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { FetchLike } from '../features/endfield/endfieldApi';

/**
 * 检测是否在 Tauri 环境中运行
 * Tauri v2 使用 __TAURI_INTERNALS__ 而不是 __TAURI__
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

/**
 * 创建适配 endfieldApi 的 fetch 函数
 * 在 Tauri 环境使用 tauri-plugin-http（绕过 CORS），否则使用浏览器原生 fetch
 */
export const createTauriFetch = (): FetchLike => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    
    // 在 Tauri 环境中使用 tauri fetch（绕过 CORS 限制）
    if (isTauri()) {
      try {
        // Tauri v2 的 fetch 直接返回标准 Response
        const options: RequestInit = {
          method: init?.method ?? 'GET',
          headers: init?.headers as Record<string, string>,
        };
        // 只有存在 body 时才添加
        if (init?.body) {
          options.body = init.body;
        }
        
        console.log('[TauriHTTP] Fetching:', url, options.method);
        const response = await tauriFetch(url, options);
        console.log('[TauriHTTP] Response status:', response.status);
        return response;
      } catch (error) {
        console.error('[TauriHTTP] Fetch error:', error);
        // 包装错误信息使其更友好
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not allowed') || errorMessage.includes('permission')) {
          throw new Error('网络请求被拒绝，请检查权限配置');
        }
        throw new Error(`网络请求失败: ${errorMessage}`);
      }
    }
    
    // 非 Tauri 环境（如纯浏览器开发）使用原生 fetch
    // 注意：这会受到 CORS 限制，仅用于开发调试
    console.warn('[BrowserHTTP] Not in Tauri environment, using browser fetch (CORS may block requests)');
    console.log('[BrowserHTTP] Fetching:', url);
    return fetch(url, init);
  };
};

/**
 * 默认的 Tauri fetch 实例
 */
export const tauriFetcher = createTauriFetch();
