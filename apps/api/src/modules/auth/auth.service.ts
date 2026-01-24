import argon2 from 'argon2';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';

import { PrismaService } from '../prisma/prisma.service';

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private accessSecret() {
    return this.config.get<string>('JWT_ACCESS_SECRET', { infer: true }) ?? '';
  }

  private refreshSecret() {
    return this.config.get<string>('JWT_REFRESH_SECRET', { infer: true }) ?? '';
  }

  private accessExpiresIn() {
    return (this.config.get<string>('JWT_ACCESS_EXPIRES_IN', { infer: true }) ?? '15m') as StringValue;
  }

  private refreshExpiresIn() {
    return (this.config.get<string>('JWT_REFRESH_EXPIRES_IN', { infer: true }) ?? '30d') as StringValue;
  }

  private async issueTokens(userId: string, email: string): Promise<Tokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { secret: this.accessSecret(), expiresIn: this.accessExpiresIn() },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email },
      { secret: this.refreshSecret(), expiresIn: this.refreshExpiresIn() },
    );

    const tokenHash = await argon2.hash(refreshToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30); // 先按 30d 兜底

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(email: string, password: string) {
    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { user, ...tokens };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('邮箱或密码错误');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('邮箱或密码错误');

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: { id: user.id, email: user.email },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    // 先校验 refresh token 签名
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('refresh token 无效');
    }

    // 找到一个未撤销且匹配 hash 的 refresh token
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const match = await this.findMatchingToken(candidates, refreshToken);
    if (!match) throw new UnauthorizedException('refresh token 已失效');

    // 轮换：撤销旧 token，发新 token
    await this.prisma.refreshToken.update({
      where: { id: match.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.email);
  }

  async logout(refreshToken: string) {
    // 不抛细节错误，尽量幂等
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, { secret: this.refreshSecret() });
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId: payload.sub, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const match = await this.findMatchingToken(tokens, refreshToken);
      if (!match) return { ok: true };

      await this.prisma.refreshToken.update({
        where: { id: match.id },
        data: { revokedAt: new Date() },
      });
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  private async findMatchingToken(
    candidates: Array<{ id: string; tokenHash: string }>,
    token: string,
  ) {
    for (const c of candidates) {
      const ok = await argon2.verify(c.tokenHash, token);
      if (ok) return c;
    }
    return null;
  }
}

