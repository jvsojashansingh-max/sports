import {
  LeaderboardScope,
  LeaderboardWindow,
  SportId,
} from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpsertLevelThresholdDto {
  @IsEnum(SportId)
  sportId!: SportId;

  @IsInt()
  @Min(1)
  @Max(100)
  level!: number;

  @IsInt()
  @Min(0)
  winsRequired!: number;
}

export class ListLeaderboardsQueryDto {
  @IsEnum(SportId)
  sportId!: SportId;

  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope?: LeaderboardScope;

  @IsOptional()
  @IsEnum(LeaderboardWindow)
  window?: LeaderboardWindow;

  @IsOptional()
  @IsUUID()
  geoId?: string;
}
