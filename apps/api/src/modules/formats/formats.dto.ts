import { SportId } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateFormatDto {
  @IsEnum(SportId)
  sportId!: SportId;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  teamSize!: number;

  @IsInt()
  @Min(15)
  durationMinutes!: number;

  @IsString()
  @MaxLength(3000)
  rulesText!: string;

  @IsBoolean()
  refereeAllowed!: boolean;

  @IsOptional()
  @IsString()
  refereeFeeDisplay?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  joinDeadlineMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  checkinOpenMinutes?: number;

  @IsInt()
  @Min(1)
  noShowGraceMinutes!: number;
}

export class ListFormatsQueryDto {
  @IsOptional()
  @IsEnum(SportId)
  sportId?: SportId;

  @IsOptional()
  @IsUUID()
  venueId?: string;
}
