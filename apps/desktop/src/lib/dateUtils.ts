/**
 * 日期格式化工具函数
 * 处理多种日期格式，确保正确解析
 */

/**
 * 解析日期字符串或时间戳
 * 支持多种格式：
 * - ISO 8601 格式: "2024-01-15T10:30:00Z"
 * - 毫秒时间戳: "1705320600000" 或 1705320600000
 * - 秒级时间戳: "1705320600" 或 1705320600
 * - 常见日期格式: "2024-01-15 10:30:00"
 */
export function parseDate(input: string | number | undefined | null): Date | null {
  if (input === undefined || input === null || input === '') {
    return null;
  }

  // 如果是数字或纯数字字符串，按时间戳处理
  if (typeof input === 'number') {
    // 判断是秒还是毫秒（秒级时间戳通常小于 10^11）
    const timestamp = input < 10000000000 ? input * 1000 : input;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  // 字符串处理
  const str = String(input).trim();

  // 检查是否是纯数字字符串（时间戳）
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    // 判断是秒还是毫秒
    const timestamp = num < 10000000000 ? num * 1000 : num;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  // 尝试直接解析
  let date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // 尝试处理常见的非标准格式
  // 格式: "2024-01-15 10:30:00" (缺少 T)
  const withT = str.replace(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');
  if (withT !== str) {
    date = new Date(withT);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * 格式化日期为本地化字符串
 * @param input 日期字符串或时间戳
 * @param locale 语言环境，默认使用系统设置
 * @param options 格式化选项
 */
export function formatDate(
  input: string | number | undefined | null,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseDate(input);
  if (!date) {
    return '-';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  try {
    return date.toLocaleString(locale, defaultOptions);
  } catch {
    return date.toLocaleString(undefined, defaultOptions);
  }
}

/**
 * 格式化日期为短格式（仅日期）
 */
export function formatDateShort(
  input: string | number | undefined | null,
  locale?: string
): string {
  const date = parseDate(input);
  if (!date) {
    return '-';
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

/**
 * 获取日期的时间戳（毫秒）
 */
export function getTimestamp(input: string | number | undefined | null): number {
  const date = parseDate(input);
  return date ? date.getTime() : 0;
}

/**
 * 格式化为相对时间（如：5分钟前、2小时前）
 */
export function formatDistanceToNow(input: string | number | undefined | null): string {
  const date = parseDate(input);
  if (!date) {
    return '-';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return '刚刚';
  }
  if (diffMin < 60) {
    return `${diffMin}分钟前`;
  }
  if (diffHour < 24) {
    return `${diffHour}小时前`;
  }
  if (diffDay < 30) {
    return `${diffDay}天前`;
  }
  
  // 超过30天显示具体日期
  return formatDateShort(date.getTime());
}
