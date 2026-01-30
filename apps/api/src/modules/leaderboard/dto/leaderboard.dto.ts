import { IsBoolean, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

export enum LeaderboardType {
  TOTAL_PULLS = 'total_pulls',
  SIX_STAR_COUNT = 'six_star_count',
  OFF_BANNER_COUNT = 'off_banner_count',
}

export class UpdateLeaderboardSettingsDto {
  @IsOptional()
  @IsBoolean()
  participate?: boolean;

  @IsOptional()
  @IsBoolean()
  hideUid?: boolean;
}

export class GetLeaderboardQueryDto {
  @IsEnum(LeaderboardType)
  type!: LeaderboardType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

// 响应类型（非 DTO，纯类型定义）
export type LeaderboardEntry = {
  rank: number;
  displayUid: string;
  region: string;
  value: number;
  uidHidden: boolean;
};

export type LeaderboardResponse = {
  type: LeaderboardType;
  entries: LeaderboardEntry[];
  updatedAt: string;
  /** 当前用户在该榜单中的排名（如果参与且有数据） */
  myRank?: number;
  /** 当前用户在该榜单中的数值 */
  myValue?: number;
};

export type LeaderboardSettingsResponse = {
  participate: boolean;
  hideUid: boolean;
};
