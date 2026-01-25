import type {
  EndFieldCharInfo,
  EndFieldCharGachaResponse,
  EndFieldCharPoolType,
  EndFieldWeaponInfo,
  EndFieldWeaponGachaResponse,
  EndFieldWeaponPoolType,
  UserBindingsResponse,
  GachaCategory,
} from '@efgachahelper/shared';
import { 
  END_FIELD_CHAR_POOL_TYPES,
} from '@efgachahelper/shared';

// 兼容旧代码
export type { EndFieldCharPoolType as EndFieldPoolType } from '@efgachahelper/shared';
export { END_FIELD_CHAR_POOL_TYPES as END_FIELD_POOL_TYPES } from '@efgachahelper/shared';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type EndfieldProvider = 'hypergryph' | 'gryphline';

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(
    message: string,
    status: number,
    url: string,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

/**
 * 官方接口触发风控/请求超限时的特征错误。
 *
 * 备注：`binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid`
 * 在请求超限/风控场景下可能返回 `404 page not found`（有时甚至会以 200 + 文本形式返回）。
 * 为了给 UI 提供更准确的提示，这里将其提升为明确的错误类型。
 */
export class EndfieldRiskControlError extends Error {
  readonly status: number;
  readonly url: string;
  readonly responseText: string | undefined;
  constructor(message: string, status: number, url: string, responseText?: string) {
    super(message);
    this.name = 'EndfieldRiskControlError';
    this.status = status;
    this.url = url;
    this.responseText = responseText;
  }
}

export type EndfieldClientOptions = {
  /** Default: 'zh-cn' */
  lang?: string;
  /** Default: '1' (官方接口目前示例代码固定为 1) */
  serverId?: string;
  /** Default: 'hypergryph' */
  provider?: EndfieldProvider;
  /** Default: common desktop UA */
  userAgent?: string;
  /**
   * For Tauri, you may want to inject a custom fetch (e.g. via plugin-http).
   * Default: global fetch
   */
  fetcher?: FetchLike;
};

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.112 Safari/537.36';

function providerToDomain(provider: EndfieldProvider): string {
  return provider === 'gryphline' ? 'gryphline.com' : 'hypergryph.com';
}

function providerToGrantAppCode(provider: EndfieldProvider): string {
  // 国服/鹰角：原 appCode（保持不变）
  // 国际服/Gryphline：用户提供的 appCode
  return provider === 'gryphline' ? '3dacefa138426cfe' : 'be36d44aa36bfb5b';
}

function pickOptions(options?: EndfieldClientOptions) {
  return {
    lang: options?.lang ?? 'zh-cn',
    serverId: options?.serverId ?? '1',
    provider: options?.provider ?? 'hypergryph',
    userAgent: options?.userAgent ?? DEFAULT_UA,
    fetcher: options?.fetcher ?? fetch,
  };
}

function is404PageNotFound(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  // 常见：纯文本 "404 page not found"，也可能在 HTML/错误页中出现
  return normalized === '404 page not found' || normalized.includes('404 page not found');
}

/**
 * token（从 hg 账户接口拿到的 token）→ app_token（短期票据）
 * 对应 apidemo: `https://as.hypergryph.com/user/oauth2/v2/grant`
 */
export async function grantAppToken(
  token: string,
  options?: EndfieldClientOptions,
): Promise<string> {
  const { userAgent, fetcher, provider } = pickOptions(options);

  const domain = providerToDomain(provider);
  const url = `https://as.${domain}/user/oauth2/v2/grant`;
  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({
      type: 1,
      appCode: providerToGrantAppCode(provider),
      token,
    }),
  });

  if (!res.ok) throw new HttpError('grantAppToken failed', res.status, url);
  const json = (await res.json()) as { data?: { token?: string } };
  const appToken = json?.data?.token;
  if (!appToken) throw new Error('grantAppToken: missing app token in response');
  return appToken;
}

/**
 * app_token → 绑定列表（含 UID + 角色信息）
 * 对应 apidemo: `https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list`
 */
export async function fetchBindingList(
  appToken: string,
  options?: EndfieldClientOptions,
): Promise<UserBindingsResponse> {
  const { userAgent, fetcher, provider } = pickOptions(options);
  const domain = providerToDomain(provider);
  const base = `https://binding-api-account-prod.${domain}/account/binding/v1/binding_list`;
  const url = `${base}?${new URLSearchParams({ token: appToken, appCode: 'endfield' }).toString()}`;

  const res = await fetcher(url, {
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
    },
  });
  if (!res.ok) throw new HttpError('fetchBindingList failed', res.status, url);
  return (await res.json()) as UserBindingsResponse;
}

/**
 * uid + app_token → u8_token（用于抽卡记录接口）
 * 对应 apidemo: `https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid`
 */
export async function fetchU8TokenByUid(
  uid: string,
  appToken: string,
  options?: EndfieldClientOptions,
): Promise<string> {
  const { userAgent, fetcher, provider } = pickOptions(options);
  const domain = providerToDomain(provider);
  const url = `https://binding-api-account-prod.${domain}/account/binding/v1/u8_token_by_uid`;

  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({ uid, token: appToken }),
  });

  // 注意：这里不要直接 res.json()，因为风控/超限时可能返回非 JSON 文本（例如：404 page not found）
  const text = await res.text();

  // 1) 非 2xx：先判断风控/超限特征，再抛出通用 HTTP 错误
  if (!res.ok) {
    if (res.status === 404 && is404PageNotFound(text)) {
      throw new EndfieldRiskControlError('fetchU8TokenByUid: risk control / rate limited', res.status, url, text);
    }
    throw new HttpError('fetchU8TokenByUid failed', res.status, url);
  }

  // 2) 2xx 但返回了错误文本：同样按风控/超限处理
  if (is404PageNotFound(text)) {
    throw new EndfieldRiskControlError('fetchU8TokenByUid: risk control / rate limited', res.status, url, text);
  }

  // 3) 正常 JSON
  let json: { data?: { token?: string } } | null = null;
  try {
    json = JSON.parse(text) as { data?: { token?: string } };
  } catch {
    throw new Error('fetchU8TokenByUid: invalid JSON response');
  }

  const u8 = json?.data?.token;
  if (!u8) throw new Error('fetchU8TokenByUid: missing u8 token in response');
  return u8;
}

// ============== 角色池 API ==============

export type FetchCharPoolRecordsInput = {
  u8Token: string;
  poolType: EndFieldCharPoolType;
  /**
   * Optional pagination cursor (seq_id). When not provided, starts from newest.
   * The API returns descending records; you can persist seqId as cursor.
   */
  seqId?: string;
};

export type FetchCharPoolRecordsResult = {
  list: EndFieldCharInfo[];
  hasMore: boolean;
  nextSeqId?: string | undefined;
};

/**
 * 拉取角色池的一页数据
 * API: `https://ef-webview.hypergryph.com/api/record/char`
 */
export async function fetchCharPoolRecords(
  input: FetchCharPoolRecordsInput,
  options?: EndfieldClientOptions,
): Promise<FetchCharPoolRecordsResult> {
  const { lang, serverId, userAgent, fetcher, provider } = pickOptions(options);
  const domain = providerToDomain(provider);
  const base = `https://ef-webview.${domain}/api/record/char`;

  const query = new URLSearchParams({
    lang,
    token: input.u8Token,
    server_id: serverId,
    pool_type: input.poolType,
  });
  if (input.seqId) query.set('seq_id', input.seqId);

  const url = `${base}?${query.toString()}`;
  const res = await fetcher(url, { method: 'GET', headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new HttpError('fetchCharPoolRecords failed', res.status, url);

  const json = (await res.json()) as EndFieldCharGachaResponse;
  if (json.code !== 0) throw new Error(`fetchCharPoolRecords: api error code=${json.code} msg=${json.msg}`);

  const list = json.data?.list ?? [];
  const hasMore = Boolean(json.data?.hasMore);
  const last = list.at(-1);

  return {
    list,
    hasMore,
    nextSeqId: last?.seqId,
  };
}

// ============== 武器池 API ==============

export type FetchWeaponPoolRecordsInput = {
  u8Token: string;
  /** @deprecated 武器池不再区分类型 */
  poolType?: EndFieldWeaponPoolType;
  seqId?: string;
};

export type FetchWeaponPoolRecordsResult = {
  list: EndFieldWeaponInfo[];
  hasMore: boolean;
  nextSeqId?: string | undefined;
};

/**
 * 拉取武器池的一页数据
 * API: `https://ef-webview.hypergryph.com/api/record/weapon`
 * 注意：武器池不区分类型，统一请求
 */
export async function fetchWeaponPoolRecords(
  input: FetchWeaponPoolRecordsInput,
  options?: EndfieldClientOptions,
): Promise<FetchWeaponPoolRecordsResult> {
  const { lang, serverId, userAgent, fetcher, provider } = pickOptions(options);
  const domain = providerToDomain(provider);
  const base = `https://ef-webview.${domain}/api/record/weapon`;

  // 武器池不需要 pool_type 参数
  const query = new URLSearchParams({
    lang,
    token: input.u8Token,
    server_id: serverId,
  });
  if (input.seqId) query.set('seq_id', input.seqId);

  const url = `${base}?${query.toString()}`;
  const res = await fetcher(url, { method: 'GET', headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new HttpError('fetchWeaponPoolRecords failed', res.status, url);

  const json = (await res.json()) as EndFieldWeaponGachaResponse;
  if (json.code !== 0) throw new Error(`fetchWeaponPoolRecords: api error code=${json.code} msg=${json.msg}`);

  const list = json.data?.list ?? [];
  const hasMore = Boolean(json.data?.hasMore);
  const last = list.at(-1);

  return {
    list,
    hasMore,
    nextSeqId: last?.seqId,
  };
}

// ============== 兼容旧代码 ==============

/** @deprecated Use fetchCharPoolRecords instead */
export type FetchPoolRecordsInput = FetchCharPoolRecordsInput;
/** @deprecated Use fetchCharPoolRecords instead */
export type FetchPoolRecordsResult = FetchCharPoolRecordsResult;
/** @deprecated Use fetchCharPoolRecords instead */
export const fetchPoolRecords = fetchCharPoolRecords;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * 智能延迟函数，用于防止触发 API 风控
 * 在请求之间添加随机延迟
 */
export async function smartDelay(minMs: number = 800, maxMs: number = 1500): Promise<void> {
  const delayMs = randomInt(minMs, maxMs);
  await sleep(delayMs);
}

export type FetchAllPoolRecordsOptions = EndfieldClientOptions & {
  /** 分页请求之间的最小延迟 (ms)，默认 800 */
  minDelayMs?: number;
  /** 分页请求之间的最大延迟 (ms)，默认 1500 */
  maxDelayMs?: number;
  /** 已存在的记录的 seqId 集合，用于增量同步。当遇到已存在的记录时停止拉取 */
  existingSeqIds?: Set<string>;
  /** 同步进度回调 */
  onProgress?: (fetched: number, isIncremental: boolean) => void;
};

/**
 * 拉取单个角色卡池的全部记录（直到 hasMore=false 或遇到已存在的记录）
 * 支持增量同步：当检测到已存在的记录时提前停止，避免重复拉取
 */
export async function fetchAllCharPoolRecords(
  u8Token: string,
  poolType: EndFieldCharPoolType,
  options?: FetchAllPoolRecordsOptions,
): Promise<EndFieldCharInfo[]> {
  const minDelayMs = options?.minDelayMs ?? 800;
  const maxDelayMs = options?.maxDelayMs ?? 1500;
  const existingSeqIds = options?.existingSeqIds;
  const onProgress = options?.onProgress;

  const all: EndFieldCharInfo[] = [];
  let seqId: string | undefined;
  let stoppedEarly = false;

  for (;;) {
    const page = await fetchCharPoolRecords(
      seqId ? { u8Token, poolType, seqId } : { u8Token, poolType },
      options,
    );

    if (!page.list.length) break;

    if (existingSeqIds && existingSeqIds.size > 0) {
      const newRecords: EndFieldCharInfo[] = [];
      for (const record of page.list) {
        if (existingSeqIds.has(record.seqId)) {
          stoppedEarly = true;
          break;
        }
        newRecords.push(record);
      }
      all.push(...newRecords);
      
      if (stoppedEarly) {
        onProgress?.(all.length, true);
        break;
      }
    } else {
      all.push(...page.list);
    }

    onProgress?.(all.length, false);

    if (!page.hasMore) break;
    seqId = page.nextSeqId;

    await sleep(randomInt(minDelayMs, maxDelayMs));
  }

  return all;
}

/**
 * 拉取全部武器记录（直到 hasMore=false 或遇到已存在的记录）
 * 武器池不区分类型，统一请求
 * 支持增量同步：当检测到已存在的记录时提前停止，避免重复拉取
 */
export async function fetchAllWeaponPoolRecords(
  u8Token: string,
  _poolType?: EndFieldWeaponPoolType, // 保留参数兼容旧调用，但不使用
  options?: FetchAllPoolRecordsOptions,
): Promise<EndFieldWeaponInfo[]> {
  const minDelayMs = options?.minDelayMs ?? 800;
  const maxDelayMs = options?.maxDelayMs ?? 1500;
  const existingSeqIds = options?.existingSeqIds;
  const onProgress = options?.onProgress;

  const all: EndFieldWeaponInfo[] = [];
  let seqId: string | undefined;
  let stoppedEarly = false;

  for (;;) {
    const page = await fetchWeaponPoolRecords(
      seqId ? { u8Token, seqId } : { u8Token },
      options,
    );

    if (!page.list.length) break;

    if (existingSeqIds && existingSeqIds.size > 0) {
      const newRecords: EndFieldWeaponInfo[] = [];
      for (const record of page.list) {
        if (existingSeqIds.has(record.seqId)) {
          stoppedEarly = true;
          break;
        }
        newRecords.push(record);
      }
      all.push(...newRecords);
      
      if (stoppedEarly) {
        onProgress?.(all.length, true);
        break;
      }
    } else {
      all.push(...page.list);
    }

    onProgress?.(all.length, false);

    if (!page.hasMore) break;
    seqId = page.nextSeqId;

    await sleep(randomInt(minDelayMs, maxDelayMs));
  }

  return all;
}

/** @deprecated Use fetchAllCharPoolRecords instead */
export const fetchAllPoolRecords = fetchAllCharPoolRecords;

// ============== 角色池批量拉取 ==============

export type FetchAllCharPoolsOptions = FetchAllPoolRecordsOptions & {
  /** 卡池切换之间的最小延迟 (ms)，默认 1500 */
  poolSwitchMinDelayMs?: number;
  /** 卡池切换之间的最大延迟 (ms)，默认 2500 */
  poolSwitchMaxDelayMs?: number;
  /** 按卡池类型提供的已存在记录 seqId 集合，用于增量同步 */
  existingSeqIdsByPool?: Partial<Record<EndFieldCharPoolType, Set<string>>>;
  /** 卡池同步进度回调 */
  onPoolProgress?: (poolType: string, poolIndex: number, totalPools: number, recordsFetched: number) => void;
};

/**
 * 拉取全部角色卡池的数据
 */
export async function fetchAllCharPools(
  u8Token: string,
  options?: FetchAllCharPoolsOptions,
): Promise<Record<EndFieldCharPoolType, EndFieldCharInfo[]>> {
  const poolSwitchMinDelayMs = options?.poolSwitchMinDelayMs ?? 1500;
  const poolSwitchMaxDelayMs = options?.poolSwitchMaxDelayMs ?? 2500;
  const existingSeqIdsByPool = options?.existingSeqIdsByPool;
  const onPoolProgress = options?.onPoolProgress;

  const result = {} as Record<EndFieldCharPoolType, EndFieldCharInfo[]>;
  
  for (let i = 0; i < END_FIELD_CHAR_POOL_TYPES.length; i++) {
    const poolType = END_FIELD_CHAR_POOL_TYPES[i];
    if (!poolType) continue;
    
    const existingSeqIds = existingSeqIdsByPool?.[poolType];
    
    const fetchOptions: FetchAllPoolRecordsOptions = {
      ...options,
      onProgress: (fetched) => {
        onPoolProgress?.(poolType, i + 1, END_FIELD_CHAR_POOL_TYPES.length, fetched);
      },
    };
    if (existingSeqIds) {
      fetchOptions.existingSeqIds = existingSeqIds;
    }
    
    const records = await fetchAllCharPoolRecords(u8Token, poolType, fetchOptions);
    
    result[poolType] = records;
    onPoolProgress?.(poolType, i + 1, END_FIELD_CHAR_POOL_TYPES.length, records.length);
    
    if (i < END_FIELD_CHAR_POOL_TYPES.length - 1) {
      await sleep(randomInt(poolSwitchMinDelayMs, poolSwitchMaxDelayMs));
    }
  }
  
  return result;
}

// ============== 武器池批量拉取 ==============

export type FetchAllWeaponPoolsOptions = FetchAllPoolRecordsOptions & {
  poolSwitchMinDelayMs?: number;
  poolSwitchMaxDelayMs?: number;
  existingSeqIdsByPool?: Partial<Record<EndFieldWeaponPoolType, Set<string>>>;
  onPoolProgress?: (poolType: string, poolIndex: number, totalPools: number, recordsFetched: number) => void;
};

/**
 * 拉取全部武器记录
 * 武器池不区分类型，统一请求一次即可
 */
export async function fetchAllWeaponPools(
  u8Token: string,
  options?: FetchAllWeaponPoolsOptions,
): Promise<Record<EndFieldWeaponPoolType, EndFieldWeaponInfo[]>> {
  const existingSeqIdsByPool = options?.existingSeqIdsByPool;
  const onPoolProgress = options?.onPoolProgress;

  // 武器池只有一种类型
  const poolType: EndFieldWeaponPoolType = 'E_WeaponGachaPoolType_All';
  
  // 合并所有已存在的 seqId（兼容旧数据）
  const existingSeqIds = new Set<string>();
  if (existingSeqIdsByPool) {
    for (const seqIdSet of Object.values(existingSeqIdsByPool)) {
      if (seqIdSet) {
        for (const seqId of seqIdSet) {
          existingSeqIds.add(seqId);
        }
      }
    }
  }
  
  const fetchOptions: FetchAllPoolRecordsOptions = {
    ...options,
    ...(existingSeqIds.size > 0 && { existingSeqIds }),
    onProgress: (fetched) => {
      onPoolProgress?.(poolType, 1, 1, fetched);
    },
  };
  
  const records = await fetchAllWeaponPoolRecords(u8Token, undefined, fetchOptions);
  
  onPoolProgress?.(poolType, 1, 1, records.length);
  
  return { [poolType]: records } as Record<EndFieldWeaponPoolType, EndFieldWeaponInfo[]>;
}

// ============== 全量同步（角色 + 武器） ==============

export type AllGachaRecords = {
  character: Record<EndFieldCharPoolType, EndFieldCharInfo[]>;
  weapon: Record<EndFieldWeaponPoolType, EndFieldWeaponInfo[]>;
};

export type FetchAllGachaOptions = Omit<FetchAllPoolRecordsOptions, 'onProgress' | 'existingSeqIds'> & {
  poolSwitchMinDelayMs?: number;
  poolSwitchMaxDelayMs?: number;
  /** 类别切换之间的延迟 (ms)，默认 2000 */
  categorySwitchDelayMs?: number;
  existingCharSeqIdsByPool?: Partial<Record<EndFieldCharPoolType, Set<string>>>;
  existingWeaponSeqIdsByPool?: Partial<Record<EndFieldWeaponPoolType, Set<string>>>;
  /** 同步进度回调 */
  onProgress?: (category: GachaCategory, poolType: string, poolIndex: number, totalPools: number, recordsFetched: number) => void;
};

/**
 * 拉取所有抽卡记录（角色 + 武器）
 */
export async function fetchAllGachaRecords(
  u8Token: string,
  options?: FetchAllGachaOptions,
): Promise<AllGachaRecords> {
  const categorySwitchDelayMs = options?.categorySwitchDelayMs ?? 2000;
  
  // 提取基础选项（使用条件展开避免 exactOptionalPropertyTypes 问题）
  const baseOptions: EndfieldClientOptions = {
    ...(options?.lang !== undefined && { lang: options.lang }),
    ...(options?.serverId !== undefined && { serverId: options.serverId }),
    ...(options?.provider !== undefined && { provider: options.provider }),
    ...(options?.userAgent !== undefined && { userAgent: options.userAgent }),
    ...(options?.fetcher !== undefined && { fetcher: options.fetcher }),
  };
  
  // 1. 拉取角色池
  const charPoolOptions: FetchAllCharPoolsOptions = {
    ...baseOptions,
    ...(options?.minDelayMs !== undefined && { minDelayMs: options.minDelayMs }),
    ...(options?.maxDelayMs !== undefined && { maxDelayMs: options.maxDelayMs }),
    ...(options?.poolSwitchMinDelayMs !== undefined && { poolSwitchMinDelayMs: options.poolSwitchMinDelayMs }),
    ...(options?.poolSwitchMaxDelayMs !== undefined && { poolSwitchMaxDelayMs: options.poolSwitchMaxDelayMs }),
    ...(options?.existingCharSeqIdsByPool !== undefined && { existingSeqIdsByPool: options.existingCharSeqIdsByPool }),
    onPoolProgress: (poolType, poolIndex, totalPools, recordsFetched) => {
      options?.onProgress?.('character', poolType, poolIndex, totalPools, recordsFetched);
    },
  };
  const charRecords = await fetchAllCharPools(u8Token, charPoolOptions);

  // 类别切换延迟
  await sleep(categorySwitchDelayMs);

  // 2. 拉取武器池
  const weaponPoolOptions: FetchAllWeaponPoolsOptions = {
    ...baseOptions,
    ...(options?.minDelayMs !== undefined && { minDelayMs: options.minDelayMs }),
    ...(options?.maxDelayMs !== undefined && { maxDelayMs: options.maxDelayMs }),
    ...(options?.poolSwitchMinDelayMs !== undefined && { poolSwitchMinDelayMs: options.poolSwitchMinDelayMs }),
    ...(options?.poolSwitchMaxDelayMs !== undefined && { poolSwitchMaxDelayMs: options.poolSwitchMaxDelayMs }),
    ...(options?.existingWeaponSeqIdsByPool !== undefined && { existingSeqIdsByPool: options.existingWeaponSeqIdsByPool }),
    onPoolProgress: (poolType, poolIndex, totalPools, recordsFetched) => {
      options?.onProgress?.('weapon', poolType, poolIndex, totalPools, recordsFetched);
    },
  };
  const weaponRecords = await fetchAllWeaponPools(u8Token, weaponPoolOptions);

  return {
    character: charRecords,
    weapon: weaponRecords,
  };
}

/** @deprecated Use fetchAllCharPools instead */
export type FetchAllPoolsOptions = FetchAllCharPoolsOptions;
/** @deprecated Use fetchAllCharPools instead */
export const fetchAllPools = fetchAllCharPools;

