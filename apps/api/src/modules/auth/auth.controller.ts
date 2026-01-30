import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CheckEmailDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, SendCodeDto } from './dto/auth.dto';
import type { AuthenticatedRequest } from './auth.types';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: '发送验证码' })
  @Post('auth/send-code')
  sendCode(@Body() dto: SendCodeDto) {
    return this.auth.sendVerificationCode(dto.email, dto.type);
  }

  @ApiOperation({ summary: '检查邮箱是否已注册' })
  @Post('auth/check-email')
  checkEmail(@Body() dto: CheckEmailDto) {
    return this.auth.checkEmail(dto.email);
  }

  @ApiOperation({ summary: '注册（需验证码）' })
  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.code);
  }

  @ApiOperation({ summary: '登录' })
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @ApiOperation({ summary: '重置密码（需验证码）' })
  @Post('auth/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @ApiOperation({ summary: '刷新 Token' })
  @Post('auth/refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: '登出' })
  @Post('auth/logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '获取当前用户信息' })
  @Get('me')
  me(@Req() req: FastifyRequest) {
    // JwtStrategy 里把 user 放到 req.user
    return { user: req.user };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '注销账号（永久删除）' })
  @Delete('auth/account')
  deleteAccount(@Req() req: AuthenticatedRequest) {
    return this.auth.deleteAccount(req.user.id);
  }
}

