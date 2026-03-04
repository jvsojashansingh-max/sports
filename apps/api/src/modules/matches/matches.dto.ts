import { DisputeStatus, PaymentStatus, TeamSide } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class MatchCheckinDto {
  @IsEnum(TeamSide)
  side!: TeamSide;

  @IsBoolean()
  present!: boolean;
}

export class MatchForfeitDto {
  @IsEnum(TeamSide)
  winnerSide!: TeamSide;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class MarkPaymentStatusDto {
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;
}

export class SubmitResultDto {
  @IsEnum(TeamSide)
  winnerSide!: TeamSide;

  @IsOptional()
  @IsObject()
  scoreJson?: Record<string, unknown>;
}

export class ResolveDisputeDto {
  @IsEnum(TeamSide)
  winnerSide!: TeamSide;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class ListDisputesQueryDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}
