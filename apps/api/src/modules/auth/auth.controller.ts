import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('auth/refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('auth/logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: FastifyRequest) {
    // JwtStrategy 里把 user 放到 req.user
    return { user: req.user };
  }
}

