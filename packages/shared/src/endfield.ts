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

export type EndFieldGachaData = {
  list: EndFieldCharInfo[];
  hasMore: boolean;
};

export type EndFieldGachaResponse = {
  code: number;
  data: EndFieldGachaData;
  msg: string;
};

export const END_FIELD_POOL_TYPES = [
  'E_CharacterGachaPoolType_Special',
  'E_CharacterGachaPoolType_Standard',
  'E_CharacterGachaPoolType_Beginner',
] as const;

export type EndFieldPoolType = (typeof END_FIELD_POOL_TYPES)[number];

