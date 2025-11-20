import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreditsService, PurchaseResult } from './credits.service';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { UserEntity } from '../users/user.entity';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  purchase(
    @Req() req: Request & { user: UserEntity },
    @Body() body: PurchaseCreditsDto,
  ): Promise<PurchaseResult> {
    return this.creditsService.purchaseCredits(req.user, body);
  }
}
