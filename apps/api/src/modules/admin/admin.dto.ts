import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SimulateAuditDto {
  @IsString()
  @MaxLength(60)
  objectType!: string;

  @IsUUID()
  objectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;
}
