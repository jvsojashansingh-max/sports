import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsUUID()
  defaultCityId?: string;
}
