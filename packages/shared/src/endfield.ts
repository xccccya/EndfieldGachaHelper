export type HgApiResponse<T> = {
  status: number;
  msg: string;
  data: T;
};

export type HgGameBindingsData = {
  list: GameAppInfo[];
};

export type GameAppInfo = {
  appCode: string;
  appName: string;
  supportMultiServer: boolean;
  bindingList: BindingAccount[];
};

export type BindingAccount = {
  uid: string;
  channelMasterId: number;
  channelName: string;
  isOfficial: boolean;
  isDefault: boolean;
  isDeleted: boolean;
  isBanned: boolean;
  registerTs: number;
  roles: GameRole[];
};

export type GameRole = {
  roleId: string;
  nickName: string;
  level: number;
  serverId: string;
  serverName: string;
  isDefault: boolean;
  isBanned: boolean;
  registerTs: number;
};

export type UserBindingsResponse = HgApiResponse<HgGameBindingsData>;

// ============== 角色池类型 ==============

export type EndFieldCharInfo = {
  charId: string;
  charName: string;
  gachaTs: string;
  isFree: boolean;
  isNew: boolean;
  poolId: string;
  poolName: string;
  rarity: number;
  seqId: string;
};

export type EndFieldCharGachaData = {
  list: EndFieldCharInfo[];
  hasMore: boolean;
};

export type EndFieldCharGachaResponse = {
  code: number;
  data: EndFieldCharGachaData;
  msg: string;
};

/** 角色池类型 */
export const END_FIELD_CHAR_POOL_TYPES = [
  'E_CharacterGachaPoolType_Special',
  'E_CharacterGachaPoolType_Standard',
  'E_CharacterGachaPoolType_Beginner',
] as const;

export type EndFieldCharPoolType = (typeof END_FIELD_CHAR_POOL_TYPES)[number];

// ============== 武器池类型 ==============

export type EndFieldWeaponInfo = {
  weaponId: string;
  weaponName: string;
  weaponType: string;
  gachaTs: string;
  isNew: boolean;
  poolId: string;
  poolName: string;
  rarity: number;
  seqId: string;
};

export type EndFieldWeaponGachaData = {
  list: EndFieldWeaponInfo[];
  hasMore: boolean;
};

export type EndFieldWeaponGachaResponse = {
  code: number;
  data: EndFieldWeaponGachaData;
  msg: string;
};

/** 
 * 武器池类型
 * 注意：武器池 API 不需要区分类型，统一请求即可
 * 保留类型定义用于兼容旧代码
 */
export const END_FIELD_WEAPON_POOL_TYPES = [
  'E_WeaponGachaPoolType_All',  // 武器池不区分类型
] as const;

export type EndFieldWeaponPoolType = (typeof END_FIELD_WEAPON_POOL_TYPES)[number];

// ============== 通用类型 ==============

/** 抽卡类别 */
export type GachaCategory = 'character' | 'weapon';

/** 兼容旧代码的别名 */
export type EndFieldGachaData = EndFieldCharGachaData;
export type EndFieldGachaResponse = EndFieldCharGachaResponse;
export const END_FIELD_POOL_TYPES = END_FIELD_CHAR_POOL_TYPES;
export type EndFieldPoolType = EndFieldCharPoolType;

