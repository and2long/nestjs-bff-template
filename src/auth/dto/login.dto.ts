import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(50)
  provider!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  display_name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsBoolean()
  is_anonymous!: boolean;

  @IsString()
  @MaxLength(200)
  uid!: string;
}
