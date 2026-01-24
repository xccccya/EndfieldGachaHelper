import {
  IsString,
  IsArray,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GachaCategory {
  CHARACTER = 'character',
  WEAPON = 'weapon',
}

export class CloudGachaRecordDto {
  @IsString()
  recordUid!: string;

  @IsEnum(GachaCategory)
  category!: GachaCategory;

  @IsString()
  poolId!: string;

  @IsString()
  poolName!: string;

  @IsString()
  itemId!: string;

  @IsString()
  itemName!: string;

  @IsNumber()
  @Min(1)
  rarity!: number;

  @IsBoolean()
  isNew!: boolean;

  @IsString()
  gachaTs!: string;

  @IsString()
  seqId!: string;

  @IsNumber()
  fetchedAt!: number;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsString()
  weaponType?: string;
}

export class SyncUploadDto {
  @IsString()
  uid!: string;

  @IsString()
  region!: string;

  /**
   * 鹰角内部 uid（用于兼容旧云端账号/以及把官方账号绑定到 roleId+serverId）
   * 新客户端建议携带，便于服务端把旧 (uid=hgUid, region=default) 账号迁移到新键。
   */
  @IsOptional()
  @IsString()
  hgUid?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloudGachaRecordDto)
  records!: CloudGachaRecordDto[];
}

export class SyncDownloadQueryDto {
  @IsString()
  uid!: string;

  @IsString()
  region!: string;

  /**
   * 可选：鹰角内部 uid（用于兼容旧云端账号键）
   * 当按 (uid, region) 找不到账号时，可回退到旧键并（可选）执行迁移。
   */
  @IsOptional()
  @IsString()
  hgUid?: string;

  @IsOptional()
  @IsEnum(GachaCategory)
  category?: GachaCategory;

  @IsOptional()
  @IsString()
  since?: string;
}

export class CreateGameAccountDto {
  @IsString()
  uid!: string;

  @IsString()
  region!: string;

  @IsOptional()
  @IsString()
  hgUid?: string;
}
