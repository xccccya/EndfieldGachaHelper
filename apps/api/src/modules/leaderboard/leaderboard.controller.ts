import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import {
  UpdateLeaderboardSettingsDto,
  GetLeaderboardQueryDto,
  LeaderboardType,
} from './dto/leaderboard.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  // ============== 公开接口（可选认证） ==============

  /**
   * 获取排行榜数据（无需登录，但登录后可显示"我的排名"）
   */
  @Get()
  @UseGuards(OptionalAuthGuard)
  async getLeaderboard(
    @Query() query: GetLeaderboardQueryDto,
    @Request() req: { user?: { id: string } },
  ) {
    const userId = req.user?.id;
    return this.leaderboardService.getLeaderboard(
      query.type,
      query.limit,
      userId,
    );
  }

  /**
   * 获取所有排行榜数据（无需登录，但登录后可显示"我的排名"）
   */
  @Get('all')
  @UseGuards(OptionalAuthGuard)
  async getAllLeaderboards(@Request() req: { user?: { id: string } }) {
    const userId = req.user?.id;
    const [totalPulls, sixStarCount, offBannerCount] = await Promise.all([
      this.leaderboardService.getLeaderboard(LeaderboardType.TOTAL_PULLS, 50, userId),
      this.leaderboardService.getLeaderboard(LeaderboardType.SIX_STAR_COUNT, 50, userId),
      this.leaderboardService.getLeaderboard(LeaderboardType.OFF_BANNER_COUNT, 50, userId),
    ]);

    return {
      totalPulls,
      sixStarCount,
      offBannerCount,
    };
  }

  // ============== 需要登录的接口 ==============

  /**
   * 获取当前用户的排行榜设置
   */
  @Get('settings')
  @UseGuards(AuthGuard)
  async getSettings(@Request() req: AuthenticatedRequest) {
    return this.leaderboardService.getSettings(req.user.id);
  }

  /**
   * 更新当前用户的排行榜设置
   */
  @Put('settings')
  @UseGuards(AuthGuard)
  async updateSettings(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateLeaderboardSettingsDto,
  ) {
    return this.leaderboardService.updateSettings(req.user.id, dto);
  }
}
