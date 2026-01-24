import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  SyncUploadDto,
  SyncDownloadQueryDto,
  CreateGameAccountDto,
} from './dto/sync.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // ============== 游戏账号管理 ==============

  /**
   * 获取用户的所有游戏账号
   */
  @Get('accounts')
  async getGameAccounts(@Request() req: AuthenticatedRequest) {
    const accounts = await this.syncService.getGameAccounts(req.user.id);
    return { accounts };
  }

  /**
   * 创建或获取游戏账号
   */
  @Post('accounts')
  async createGameAccount(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateGameAccountDto,
  ) {
    const account = await this.syncService.getOrCreateGameAccount(
      req.user.id,
      dto,
    );
    return { account };
  }

  /**
   * 删除游戏账号
   */
  @Delete('accounts')
  async deleteGameAccount(
    @Request() req: AuthenticatedRequest,
    @Query('uid') uid: string,
    @Query('region') region: string,
  ) {
    return this.syncService.deleteGameAccount(req.user.id, uid, region);
  }

  // ============== 同步数据操作 ==============

  /**
   * 上传抽卡记录
   */
  @Post('upload')
  async uploadRecords(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SyncUploadDto,
  ) {
    return this.syncService.uploadRecords(
      req.user.id,
      dto.uid,
      dto.region,
      dto.hgUid,
      dto.records,
    );
  }

  /**
   * 下载抽卡记录
   */
  @Get('download')
  async downloadRecords(
    @Request() req: AuthenticatedRequest,
    @Query() query: SyncDownloadQueryDto,
  ) {
    return this.syncService.downloadRecords(
      req.user.id,
      query.uid,
      query.region,
      query.hgUid,
      query.category,
      query.since,
    );
  }

  /**
   * 获取同步状态
   */
  @Get('status')
  async getSyncStatus(@Request() req: AuthenticatedRequest) {
    return this.syncService.getSyncStatus(req.user.id);
  }

  /**
   * 清理重复记录
   */
  @Post('cleanup')
  async cleanupDuplicates(@Request() req: AuthenticatedRequest) {
    return this.syncService.cleanupDuplicates(req.user.id);
  }
}
