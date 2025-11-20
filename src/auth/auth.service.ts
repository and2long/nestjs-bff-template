import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';

interface TokenPayload {
  sub: number;
  uid: string;
  type: 'access' | 'refresh';
  provider: string;
}

interface RefreshPayload extends TokenPayload {
  exp: number;
  iat: number;
}

type JwtTtl = JwtSignOptions['expiresIn'];

@Injectable()
export class AuthService {
  private readonly accessTtl: JwtTtl;
  private readonly refreshTtl: JwtTtl;
  private readonly refreshRotationThresholdSeconds = 5 * 24 * 60 * 60;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTtl =
      this.configService.get<JwtTtl>('JWT_ACCESS_TTL') ?? ('30m' as JwtTtl);
    this.refreshTtl =
      this.configService.get<JwtTtl>('JWT_REFRESH_TTL') ?? ('15d' as JwtTtl);
  }

  async login(dto: LoginDto) {
    if (!dto.uid) {
      throw new BadRequestException('uid is required');
    }

    let user = await this.usersService.findByUid(dto.uid);
    if (user) {
      user = await this.usersService.updateProfile(user.id, {
        provider: dto.provider,
        displayName: dto.display_name,
        email: dto.email,
        isAnonymous: dto.is_anonymous,
      });
    } else {
      user = await this.usersService.create({
        uid: dto.uid,
        provider: dto.provider,
        displayName: dto.display_name,
        email: dto.email,
        isAnonymous: dto.is_anonymous,
      });
    }

    return {
      access: this.signAccessToken(user),
      refresh: this.signRefreshToken(user),
      user: this.serializeUser(user),
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        { secret: this.configService.get<string>('JWT_SECRET') ?? 'change-me' },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token required');
    }

    const user = await this.safeFindUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsLeft = (payload.exp ?? now) - now;
    const reuseOldRefresh =
      secondsLeft > this.refreshRotationThresholdSeconds
        ? refreshToken
        : this.signRefreshToken(user);

    return {
      access: this.signAccessToken(user),
      refresh: reuseOldRefresh,
    };
  }

  private signAccessToken(user: UserEntity): string {
    const payload: TokenPayload = {
      sub: user.id,
      uid: user.uid,
      type: 'access',
      provider: user.provider,
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTtl,
    });
  }

  private signRefreshToken(user: UserEntity): string {
    const payload: TokenPayload = {
      sub: user.id,
      uid: user.uid,
      type: 'refresh',
      provider: user.provider,
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.refreshTtl,
    });
  }

  private async safeFindUser(userId: number): Promise<UserEntity | null> {
    try {
      return await this.usersService.findById(userId);
    } catch {
      return null;
    }
  }

  private serializeUser(user: UserEntity) {
    return {
      id: user.id,
      uid: user.uid,
      provider: user.provider,
      displayName: user.displayName,
      email: user.email,
      isAnonymous: user.isAnonymous,
      credits: user.credits,
    };
  }
}
