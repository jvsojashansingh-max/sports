import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAvailabilityTemplateDto {
  @IsUUID()
  resourceId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @IsInt()
  @Min(5)
  @Max(180)
  slotMinutes!: number;

  @IsInt()
  @Min(0)
  @Max(180)
  bufferMinutes!: number;
}

export class UpdateAvailabilityTemplateDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  slotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  bufferMinutes?: number;
}

export class CreateBlockDto {
  @IsUUID()
  resourceId!: string;

  @IsDateString()
  startTs!: string;

  @IsDateString()
  endTs!: string;

  @IsString()
  @MaxLength(200)
  reason!: string;
}

export class AvailabilityQueryDto {
  @IsDateString()
  date!: string;
}

export class ListBlocksQueryDto {
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsDateString()
  fromTs?: string;

  @IsOptional()
  @IsDateString()
  toTs?: string;
}
