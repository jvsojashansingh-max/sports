import { BookingStatus, BookingType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateBookingHoldDto {
  @IsUUID()
  resourceId!: string;

  @IsDateString()
  startTs!: string;

  @IsDateString()
  endTs!: string;

  @IsOptional()
  @IsEnum(BookingType)
  type?: BookingType;
}

export class ListMyBookingsQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
