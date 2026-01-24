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
}
