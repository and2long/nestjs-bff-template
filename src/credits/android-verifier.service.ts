import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { androidpublisher_v3, google } from 'googleapis';

@Injectable()
export class AndroidPlayVerifierService {
  private readonly logger = new Logger(AndroidPlayVerifierService.name);
  private readonly packageName: string | undefined;
  private readonly publisher?: androidpublisher_v3.Androidpublisher;

  constructor(private readonly configService: ConfigService) {
    this.packageName =
      this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME') ?? undefined;
    const clientEmail =
      this.configService.get<string>('GOOGLE_PLAY_CLIENT_EMAIL') ?? '';
    const privateKeyRaw =
      this.configService.get<string>('GOOGLE_PLAY_PRIVATE_KEY') ?? '';
    if (clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
      this.publisher = google.androidpublisher({ version: 'v3', auth });
    } else {
      this.logger.warn(
        'Google Play client email/private key not set; Android verification disabled',
      );
    }
  }

  async verifyPurchase(params: {
    purchaseId?: string;
    productId: string;
    purchaseToken: string;
    packageName?: string;
  }): Promise<androidpublisher_v3.Schema$ProductPurchase> {
    if (!this.publisher) {
      throw new BadRequestException(
        'Google Play verification is not configured',
      );
    }

    const expectedPackageName = this.packageName;
    const packageNameOverride = params.packageName;
    if (packageNameOverride && expectedPackageName) {
      if (packageNameOverride !== expectedPackageName) {
        throw new BadRequestException('packageName mismatch for Android');
      }
    }

    const packageName = packageNameOverride ?? expectedPackageName;
    if (!packageName) {
      throw new BadRequestException('GOOGLE_PLAY_PACKAGE_NAME is required');
    }

    try {
      const response = await this.publisher.purchases.products.get({
        packageName,
        productId: params.productId,
        token: params.purchaseToken,
      });

      const purchase = response.data;
      if (!purchase) {
        throw new BadRequestException('Empty response from Google Play');
      }

      // purchaseState: 0 == Purchased, >0 indicates pending/canceled.
      if (purchase.purchaseState !== 0) {
        throw new BadRequestException(
          `Purchase is not completed (state=${purchase.purchaseState})`,
        );
      }

      const normalizedOrderId = purchase.orderId ?? null;
      const providedPurchaseId = params.purchaseId;
      if (normalizedOrderId && providedPurchaseId) {
        if (normalizedOrderId !== providedPurchaseId) {
          throw new BadRequestException('purchase_id must match orderId');
        }
      }

      return purchase;
    } catch (error) {
      const message =
        (error as { message?: string })?.message ??
        'Android purchase verification failed';
      this.logger.error(`Google Play verification failed: ${message}`);
      throw new BadRequestException('Android purchase verification failed');
    }
  }
}
