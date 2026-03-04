import { SportId } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateChallengeDto {
  @IsUUID()
  venueId!: string;

  @IsUUID()
  resourceId!: string;

  @IsEnum(SportId)
  sportId!: SportId;

  @IsUUID()
  formatId!: string;

  @IsDateString()
  startTs!: string;

  @IsIn(['OWN_TEAM', 'RANDOM_FILL'])
  teamMode!: 'OWN_TEAM' | 'RANDOM_FILL';
}

export class LobbyChallengesQueryDto {
  @IsUUID()
  cityId!: string;

  @IsEnum(SportId)
  sportId!: SportId;

  @IsDateString()
  fromTs!: string;

  @IsDateString()
  toTs!: string;
}

export class InviteTeamMemberDto {
  @IsUUID()
  userId!: string;
}

export class RemoveTeamMemberDto {
  @IsUUID()
  userId!: string;
}

export class ChallengeMessagesQueryDto {
  @IsOptional()
  @IsDateString()
  cursor?: string;
}
