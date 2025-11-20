import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum PurchasePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  MACOS = 'macos',
}

export class PurchaseCreditsDto {
  @IsEnum(PurchasePlatform, { message: 'platform must be ios/android/macos' })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? (value.toLowerCase() as PurchasePlatform)
      : (value as PurchasePlatform),
  )
  platform!: PurchasePlatform;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  purchase_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  product_id!: string;

  @IsString()
  @IsNotEmpty()
  verification_data!: string;
}
