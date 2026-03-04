import { ReviewType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsEnum(ReviewType)
  type!: ReviewType;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}
