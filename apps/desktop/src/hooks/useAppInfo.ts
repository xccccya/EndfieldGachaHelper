import { useEffect, useState } from 'react';

export interface AppInfo {
  version: string;
}

/**
 * 获取应用信息（优先使用 Tauri 运行时版本号）
 * - **默认**: 使用构建期注入的 `__APP_VERSION__`，确保一定有值
 * - **运行时**: 若在 Tauri 环境中可用，则用 `getVersion()` 校准
 */
export function useAppInfo(): AppInfo {
  const [version, setVersion] = useState<string>(() => __APP_VERSION__);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const v = await getVersion();
        if (!cancelled && v) setVersion(v);
      } catch {
        // 非 Tauri 环境（例如浏览器预览）下会失败，保持构建期版本即可
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { version };
}

export default useAppInfo;

