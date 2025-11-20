import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { UserEntity } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AndroidPlayVerifierService } from './android-verifier.service';
import { AppleVerifierService } from './apple-verifier.service';
import { PRODUCT_CREDITS_MAP } from './credits.constants';
import {
  PurchaseCreditsDto,
  PurchasePlatform,
} from './dto/purchase-credits.dto';

export interface PurchaseResult {
  creditsAdded: number;
  balance: number;
}

@Injectable()
export class CreditsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly usersService: UsersService,
    private readonly appleVerifier: AppleVerifierService,
    private readonly androidVerifier: AndroidPlayVerifierService,
  ) {}

  async purchaseCredits(
    user: UserEntity,
    payload: PurchaseCreditsDto,
  ): Promise<PurchaseResult> {
    const creditsToAdd = PRODUCT_CREDITS_MAP[payload.product_id];
    if (!creditsToAdd) {
      throw new BadRequestException('Unsupported product_id');
    }

    const verificationResult = await this.validateVerificationData(payload);

    return this.db.withTransaction(async (client) => {
      const existing = await this.db.queryWithClient<{
        product_id: string;
      }>(
        client,
        'SELECT product_id FROM purchases WHERE purchase_id = $1 AND user_id = $2 LIMIT 1',
        [payload.purchase_id, user.id],
      );

      const hasExisting = (existing.rowCount ?? 0) > 0;
      if (hasExisting) {
        const balanceResult = await this.db.queryWithClient<{
          credits: number;
        }>(client, 'SELECT credits FROM users WHERE id = $1', [user.id]);
        const balance = balanceResult.rows[0]?.credits ?? user.credits;
        const existingProductId = existing.rows[0].product_id;
        const existingCredits =
          PRODUCT_CREDITS_MAP[existingProductId] ?? creditsToAdd;
        return {
          creditsAdded: existingCredits,
          balance,
        };
      }

      const { balance } = await this.usersService.incrementCredits(
        user.id,
        creditsToAdd,
        client,
      );

      await this.insertPurchaseRecord(
        payload,
        user.id,
        verificationResult,
        client,
      );

      return { creditsAdded: creditsToAdd, balance };
    });
  }

  private async validateVerificationData(
    dto: PurchaseCreditsDto,
  ): Promise<unknown> {
    if (!dto.verification_data || !dto.verification_data.trim()) {
      throw new BadRequestException('verification_data is required');
    }

    if (
      dto.platform === PurchasePlatform.IOS ||
      dto.platform === PurchasePlatform.MACOS
    ) {
      if (!dto.verification_data.includes('.')) {
        throw new BadRequestException('Invalid Apple verification_data');
      }
      // Throws on failure; return decoded transaction for storage
      return await this.appleVerifier.verifyAndDecode(dto.verification_data);
    } else if (dto.platform === PurchasePlatform.ANDROID) {
      return await this.androidVerifier.verifyPurchase({
        productId: dto.product_id,
        purchaseToken: dto.verification_data,
        purchaseId: dto.purchase_id,
      });
    }

    return undefined;
  }

  private async insertPurchaseRecord(
    payload: PurchaseCreditsDto,
    userId: number,
    verificationResult: unknown,
    client: PoolClient,
  ) {
    const verificationResultJson =
      verificationResult === undefined
        ? null
        : JSON.stringify(verificationResult);

    const insertResult = await this.db.queryWithClient(
      client,
      `
        INSERT INTO purchases (user_id, purchase_id, product_id, platform, verification_data, verification_result)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (purchase_id) DO NOTHING
        RETURNING id;
      `,
      [
        userId,
        payload.purchase_id,
        payload.product_id,
        payload.platform,
        payload.verification_data,
        verificationResultJson,
      ],
    );

    if (insertResult.rowCount === 0) {
      throw new ConflictException('Purchase already processed');
    }
  }
}
