import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName!: string;
}
