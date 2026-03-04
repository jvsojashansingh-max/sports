import { SportId, TournamentStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTournamentDto {
  @IsUUID()
  venueId!: string;

  @IsEnum(SportId)
  sportId!: SportId;

  @IsDateString()
  registrationDeadline!: string;

  @IsDateString()
  startTs!: string;

  @IsOptional()
  @IsObject()
  rulesJson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  resourceIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(15)
  slotMinutes?: number;
}

export class ListTournamentsQueryDto {
  @IsOptional()
  @IsEnum(SportId)
  sportId?: SportId;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}

export class RegisterTournamentDto {
  @IsOptional()
  @IsString()
  teamMode?: 'SOLO' | 'TEAM';
}

export class GenerateBracketDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  resourceIds?: string[];
}
