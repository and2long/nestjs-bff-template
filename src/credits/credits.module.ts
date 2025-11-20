import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { AndroidPlayVerifierService } from './android-verifier.service';
import { AppleVerifierService } from './apple-verifier.service';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({
  imports: [AuthModule, DatabaseModule, UsersModule],
  controllers: [CreditsController],
  providers: [CreditsService, AppleVerifierService, AndroidPlayVerifierService],
})
export class CreditsModule {}
