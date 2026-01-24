import type {
  EndFieldCharInfo,
  EndFieldGachaResponse,
  EndFieldPoolType,
  UserBindingsResponse,
} from '@efgachahelper/shared';
import { END_FIELD_POOL_TYPES } from '@efgachahelper/shared';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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

export type EndfieldClientOptions = {
  /** Default: 'zh-cn' */
  lang?: string;
  /** Default: '1' (官方接口目前示例代码固定为 1) */
  serverId?: string;
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

function pickOptions(options?: EndfieldClientOptions) {
  return {
    lang: options?.lang ?? 'zh-cn',
    serverId: options?.serverId ?? '1',
    userAgent: options?.userAgent ?? DEFAULT_UA,
    fetcher: options?.fetcher ?? fetch,
  };
}

/**
 * token（从 hg 账户接口拿到的 token）→ app_token（短期票据）
 * 对应 apidemo: `https://as.hypergryph.com/user/oauth2/v2/grant`
 */
export async function grantAppToken(
  token: string,
  options?: EndfieldClientOptions,
): Promise<string> {
  const { userAgent, fetcher } = pickOptions(options);

  const url = 'https://as.hypergryph.com/user/oauth2/v2/grant';
  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({
      type: 1,
      appCode: 'be36d44aa36bfb5b',
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
  const { userAgent, fetcher } = pickOptions(options);
  const base = 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list';
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
  const { userAgent, fetcher } = pickOptions(options);
  const url =
    'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid';

  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({ uid, token: appToken }),
  });
  if (!res.ok) throw new HttpError('fetchU8TokenByUid failed', res.status, url);
  const json = (await res.json()) as { data?: { token?: string } };
  const u8 = json?.data?.token;
  if (!u8) throw new Error('fetchU8TokenByUid: missing u8 token in response');
  return u8;
}

export type FetchPoolRecordsInput = {
  u8Token: string;
  poolType: EndFieldPoolType;
  /**
   * Optional pagination cursor (seq_id). When not provided, starts from newest.
   * The API returns descending records; you can persist seqId as cursor.
   */
  seqId?: string;
};

export type FetchPoolRecordsResult = {
  list: EndFieldCharInfo[];
  hasMore: boolean;
  nextSeqId?: string;
};

/**
 * 拉取单个卡池的一页/多页数据（不做本地保存、不做去重）。
 * 对应 apidemo: `https://ef-webview.hypergryph.com/api/record/char`
 */
export async function fetchPoolRecords(
  input: FetchPoolRecordsInput,
  options?: EndfieldClientOptions,
): Promise<FetchPoolRecordsResult> {
  const { lang, serverId, userAgent, fetcher } = pickOptions(options);
  const base = 'https://ef-webview.hypergryph.com/api/record/char';

  const query = new URLSearchParams({
    lang,
    token: input.u8Token,
    server_id: serverId,
    pool_type: input.poolType,
  });
  if (input.seqId) query.set('seq_id', input.seqId);

  const url = `${base}?${query.toString()}`;
  const res = await fetcher(url, { method: 'GET', headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new HttpError('fetchPoolRecords failed', res.status, url);

  const json = (await res.json()) as EndFieldGachaResponse;
  if (json.code !== 0) throw new Error(`fetchPoolRecords: api error code=${json.code} msg=${json.msg}`);

  const list = json.data?.list ?? [];
  const hasMore = Boolean(json.data?.hasMore);
  const last = list.at(-1);

  return {
    list,
    hasMore,
    nextSeqId: last?.seqId,
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * 拉取单个卡池的全部记录（直到 hasMore=false）
 * 对应 apidemo 的 while(hasMore) + seq_id 分页逻辑。
 */
export async function fetchAllPoolRecords(
  u8Token: string,
  poolType: EndFieldPoolType,
  options?: EndfieldClientOptions & { minDelayMs?: number; maxDelayMs?: number },
): Promise<EndFieldCharInfo[]> {
  const minDelayMs = options?.minDelayMs ?? 500;
  const maxDelayMs = options?.maxDelayMs ?? 1000;

  const all: EndFieldCharInfo[] = [];
  let seqId: string | undefined;

  // The API returns newest-first. We keep accumulating as-is.
  for (;;) {
    const page = await fetchPoolRecords(
      seqId ? { u8Token, poolType, seqId } : { u8Token, poolType },
      options,
    );

    if (!page.list.length) break;
    all.push(...page.list);

    if (!page.hasMore) break;
    seqId = page.nextSeqId;

    await sleep(randomInt(minDelayMs, maxDelayMs));
  }

  return all;
}

/**
 * 拉取全部卡池的数据（按 apidemo 的 POOL_TYPES 顺序）
 */
export async function fetchAllPools(
  u8Token: string,
  options?: EndfieldClientOptions,
): Promise<Record<EndFieldPoolType, EndFieldCharInfo[]>> {
  const result = {} as Record<EndFieldPoolType, EndFieldCharInfo[]>;
  for (const poolType of END_FIELD_POOL_TYPES) {
    result[poolType] = await fetchAllPoolRecords(u8Token, poolType, options);
  }
  return result;
}

