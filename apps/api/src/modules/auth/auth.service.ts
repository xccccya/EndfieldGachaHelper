import argon2 from 'argon2';
import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

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
    private readonly mail: MailService,
  ) {}

  private accessSecret() {
    // 与 JwtStrategy 的 dev 默认值保持一致，避免“签发/校验 secret 不一致”导致的隐性掉线
    const v = this.config.get<string>('JWT_ACCESS_SECRET', { infer: true });
    return typeof v === 'string' && v.trim().length > 0 ? v : 'dev-access-secret';
  }

  private refreshSecret() {
    const v = this.config.get<string>('JWT_REFRESH_SECRET', { infer: true });
    return typeof v === 'string' && v.trim().length > 0 ? v : 'dev-refresh-secret';
  }

  private accessExpiresIn() {
    return (this.config.get<string>('JWT_ACCESS_EXPIRES_IN', { infer: true }) ?? '15m') as StringValue;
  }

  private refreshExpiresIn() {
    return (this.config.get<string>('JWT_REFRESH_EXPIRES_IN', { infer: true }) ?? '30d') as StringValue;
  }

  private getJwtExpiresAt(token: string): Date | null {
    const decoded = this.jwt.decode<{ exp?: number }>(token);
    const exp = decoded?.exp;
    if (!exp || typeof exp !== 'number') return null;
    return new Date(exp * 1000);
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

    // 以 refresh JWT 自身的 exp 为准，避免配置/库解析差异导致 DB 过期时间不一致
    const expiresAt = this.getJwtExpiresAt(refreshToken) ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // 生成 6 位数字验证码
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 发送验证码
  async sendVerificationCode(email: string, type: 'register' | 'reset') {
    // 检查用户是否存在
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (type === 'register' && existingUser) {
      throw new ConflictException('该邮箱已注册');
    }
    if (type === 'reset' && !existingUser) {
      throw new BadRequestException('该邮箱未注册');
    }

    // 检查是否最近已发送过验证码（防止频繁发送）
    const recentCode = await this.prisma.verificationCode.findFirst({
      where: {
        email,
        type,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) }, // 1分钟内
      },
    });
    if (recentCode) {
      throw new BadRequestException('请勿频繁发送验证码，请稍后再试');
    }

    // 生成验证码
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟有效

    // 保存验证码
    await this.prisma.verificationCode.create({
      data: { email, code, type, expiresAt },
    });

    // 发送邮件
    const sent = await this.mail.sendVerificationCode(email, code, type);
    if (!sent) {
      throw new BadRequestException('验证码发送失败，请稍后再试');
    }

    return { ok: true, message: '验证码已发送' };
  }

  // 验证验证码
  private async verifyCode(email: string, code: string, type: 'register' | 'reset') {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 标记为已使用
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return true;
  }

  // 检查邮箱是否已注册
  async checkEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return { registered: !!user };
  }

  async register(email: string, password: string, code: string) {
    // 验证验证码
    await this.verifyCode(email, code, 'register');

    // 检查邮箱是否已被注册
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { user, ...tokens };
  }

  // 重置密码
  async resetPassword(email: string, code: string, newPassword: string) {
    // 验证验证码
    await this.verifyCode(email, code, 'reset');

    // 更新密码
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // 撤销该用户所有 refresh token（强制重新登录）
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { ok: true, message: '密码重置成功' };
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
    } catch (e) {
      // 更精确的错误信息，便于客户端区分“过期 vs 无效”
      if (e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'TokenExpiredError') {
        throw new UnauthorizedException('refresh token 已过期');
      }
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

    // 额外保护：即便 JWT 还没过期，也以 DB 过期时间为准（便于未来做服务端强制失效/清理）
    if (match.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: match.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('refresh token 已过期');
    }

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
    candidates: Array<{ id: string; tokenHash: string; expiresAt: Date }>,
    token: string,
  ) {
    for (const c of candidates) {
      const ok = await argon2.verify(c.tokenHash, token);
      if (ok) return c;
    }
    return null;
  }
}

