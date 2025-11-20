import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from '@apple/app-store-server-library';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppleVerifierService {
  private readonly logger = new Logger(AppleVerifierService.name);
  private readonly rootCAs: Buffer[];
  private readonly bundleId?: string;
  private readonly appAppleId?: number;
  private readonly enableOnlineChecks = true;

  constructor(private readonly configService: ConfigService) {
    const certDir = path.resolve(process.cwd(), 'src', 'apple_certs');
    this.bundleId =
      this.configService.get<string>('APP_BUNDLE_ID') ?? undefined;
    const appAppleIdRaw = this.configService.get<string>('APP_APPLE_ID');
    this.appAppleId =
      appAppleIdRaw && !Number.isNaN(Number(appAppleIdRaw))
        ? Number(appAppleIdRaw)
        : undefined;

    this.rootCAs = this.loadRootCAs(certDir);
  }

  async verifyAndDecode(jwt: string) {
    try {
      const environment = this.parseEnvironment(jwt);
      const verifier = new SignedDataVerifier(
        this.rootCAs,
        this.enableOnlineChecks,
        environment,
        this.bundleId ?? '',
        this.appAppleId,
      );
      return await verifier.verifyAndDecodeTransaction(jwt);
    } catch (error) {
      if (error instanceof VerificationException) {
        const statusKey =
          VerificationStatus[error.status] ?? 'UNKNOWN_VERIFICATION_STATUS';
        this.logger.error(
          `Apple receipt verification failed: ${error.message} (status: ${statusKey})`,
        );
      }
      throw error;
    }
  }

  private parseEnvironment(token: string): Environment {
    const parts = token.split('.');
    if (parts.length < 2) {
      this.logger.warn('Invalid JWS format for Apple receipt');
      return Environment.SANDBOX;
    }
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as { environment?: string };
      const envValue = payload.environment ?? '';
      const normalized = envValue.trim().toUpperCase();
      return normalized === 'PRODUCTION'
        ? Environment.PRODUCTION
        : Environment.SANDBOX;
    } catch (error) {
      this.logger.warn(
        `Failed to parse environment from Apple receipt: ${(error as Error).message}`,
      );
      return Environment.SANDBOX;
    }
  }

  private loadRootCAs(certificatesDir: string): Buffer[] {
    const fullPath = path.resolve(certificatesDir);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Certificate directory not found: ${fullPath}`);
    }

    const certificateFiles = fs
      .readdirSync(fullPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          (entry.name.toLowerCase().endsWith('.cer') ||
            entry.name.toLowerCase().endsWith('.pem')),
      )
      .map((entry) => entry.name);

    if (certificateFiles.length === 0) {
      throw new Error('No Apple root certificates found');
    }

    return certificateFiles.map((file) =>
      fs.readFileSync(path.join(fullPath, file)),
    );
  }
}
