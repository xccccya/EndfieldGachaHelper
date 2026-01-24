export const SCHEMA_VERSION = 1 as const;

export type SchemaVersion = typeof SCHEMA_VERSION;

export type Region = string;

export type GachaPool = string;

export type GachaRecord = {
  /** 桌面端生成：稳定、可复算（用于幂等去重） */
  recordUid: string;

  uid: string;
  region: Region;
  pool: GachaPool;
  itemName: string;
  rarity: number;
  pulledAt: string; // ISO string
};

export type ExportFile = {
  schemaVersion: SchemaVersion;
  exportedAt: string; // ISO string
  records: GachaRecord[];
};

export * from './endfield';
export * from './sync';

