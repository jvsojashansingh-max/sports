import { PaymentMode, ResourceStatus, SportId, VenueStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUUID()
  cityId!: string;

  @IsUUID()
  stateId!: string;

  @IsString()
  @MaxLength(300)
  address!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsArray()
  photos?: unknown[];

  @IsOptional()
  @IsString()
  paymentInstructions?: string;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @ValidateIf((obj: CreateVenueDto) => obj.paymentMode === PaymentMode.VENDOR_LINK)
  @IsString()
  vendorPaymentLink?: string;
}

export class UpdateVenueDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;

  @IsOptional()
  @IsString()
  paymentInstructions?: string;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsString()
  vendorPaymentLink?: string;
}

export class CreateResourceDto {
  @IsUUID()
  venueId!: string;

  @IsEnum(SportId)
  sportId!: SportId;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;
}
