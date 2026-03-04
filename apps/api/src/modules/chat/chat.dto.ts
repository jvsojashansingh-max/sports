import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MessageReportStatus } from '@prisma/client';

export class ListMessagesQueryDto {
  @IsOptional()
  @IsDateString()
  cursor?: string;
}

export class SendMessageDto {
  @IsString()
  @MaxLength(1000)
  body!: string;
}

export class MuteParticipantDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsDateString()
  mutedUntilTs?: string;
}

export class DeleteMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ReportMessageDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class ReviewMessageReportDto {
  @IsEnum(MessageReportStatus)
  status!: MessageReportStatus;
}
