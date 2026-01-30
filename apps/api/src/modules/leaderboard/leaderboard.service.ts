import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  LeaderboardType,
  UpdateLeaderboardSettingsDto,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardSettingsResponse,
} from './dto/leaderboard.dto';

// 常量定义
const MAX_LEADERBOARD_SIZE = 100;

// UP 池名称关键词（用于判断是否为限定池）
// 角色限定池和武器池都参与歪的统计
// 常驻池的6星不算歪
const UP_POOL_KEYWORDS = ['限定', '精选', 'Pick Up', 'Featured'];

// 武器池名称关键词（武器池都算限定池，全部参与歪的统计）
const WEAPON_POOL_KEYWORDS = ['武器', 'Weapon', '装备', 'Equipment'];

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============== 用户设置管理 ==============

  /**
   * 获取用户的排行榜设置
   */
  async getSettings(userId: string): Promise<LeaderboardSettingsResponse> {
    const settings = await this.prisma.leaderboardSettings.findUnique({
      where: { userId },
    });

    return {
      participate: settings?.participate ?? false,
      hideUid: settings?.hideUid ?? false,
    };
  }

  /**
   * 更新用户的排行榜设置
   */
  async updateSettings(
    userId: string,
    dto: UpdateLeaderboardSettingsDto,
  ): Promise<LeaderboardSettingsResponse> {
    const settings = await this.prisma.leaderboardSettings.upsert({
      where: { userId },
      create: {
        userId,
        participate: dto.participate ?? false,
        hideUid: dto.hideUid ?? false,
      },
      update: {
        ...(dto.participate !== undefined && { participate: dto.participate }),
        ...(dto.hideUid !== undefined && { hideUid: dto.hideUid }),
      },
    });

    return {
      participate: settings.participate,
      hideUid: settings.hideUid,
    };
  }

  // ============== 排行榜数据查询 ==============

  /**
   * 获取排行榜数据
   */
  async getLeaderboard(
    type: LeaderboardType,
    limit: number = 50,
    userId?: string,
  ): Promise<LeaderboardResponse> {
    const entries = await this.prisma.leaderboardCache.findMany({
      where: { type },
      orderBy: { rank: 'asc' },
      take: Math.min(limit, MAX_LEADERBOARD_SIZE),
    });

    // 获取缓存更新时间
    const latestEntry = entries[0];
    const updatedAt = latestEntry?.cachedAt?.toISOString() ?? new Date().toISOString();

    const result: LeaderboardResponse = {
      type,
      entries: entries.map((e) => ({
        rank: e.rank,
        displayUid: e.displayUid,
        region: e.region,
        value: e.value,
        uidHidden: e.uidHidden,
      })),
      updatedAt,
    };

    // 如果提供了 userId，查找用户在该榜单的排名
    if (userId) {
      const myEntry = await this.prisma.leaderboardCache.findFirst({
        where: {
          type,
          userId,
        },
      });

      if (myEntry) {
        result.myRank = myEntry.rank;
        result.myValue = myEntry.value;
      }
    }

    return result;
  }

  // ============== 定时任务：更新排行榜 ==============

  /**
   * 每 5 分钟更新一次排行榜
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshLeaderboard() {
    this.logger.log('开始更新排行榜数据...');

    try {
      await Promise.all([
        this.refreshTotalPullsLeaderboard(),
        this.refreshSixStarCountLeaderboard(),
        this.refreshOffBannerCountLeaderboard(),
      ]);
      this.logger.log('排行榜数据更新完成');
    } catch (error) {
      this.logger.error('排行榜数据更新失败:', error);
    }
  }

  /**
   * 手动触发刷新（供测试或管理使用）
   */
  async forceRefresh() {
    await this.refreshLeaderboard();
  }

  /**
   * 刷新累计抽数排行榜
   */
  private async refreshTotalPullsLeaderboard() {
    // 获取所有参与排行的用户
    const participatingUsers = await this.prisma.leaderboardSettings.findMany({
      where: { participate: true },
      select: { userId: true, hideUid: true },
    });

    if (participatingUsers.length === 0) {
      await this.clearLeaderboard(LeaderboardType.TOTAL_PULLS);
      return;
    }

    const userIds = participatingUsers.map((u) => u.userId);
    const hideUidMap = new Map(participatingUsers.map((u) => [u.userId, u.hideUid]));

    // 统计每个游戏账号的抽卡总数
    const stats = await this.prisma.gameAccount.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
        uid: true,
        region: true,
        _count: {
          select: { gachaRecords: true },
        },
      },
    });

    // 按抽数排序
    const sorted = stats
      .filter((s) => s._count.gachaRecords > 0)
      .sort((a, b) => b._count.gachaRecords - a._count.gachaRecords)
      .slice(0, MAX_LEADERBOARD_SIZE);

    await this.saveLeaderboard(LeaderboardType.TOTAL_PULLS, sorted.map((s, i) => ({
      rank: i + 1,
      gameAccountId: s.id,
      userId: s.userId,
      uid: s.uid,
      region: s.region,
      value: s._count.gachaRecords,
      hideUid: hideUidMap.get(s.userId) ?? false,
    })));
  }

  /**
   * 刷新六星数排行榜
   */
  private async refreshSixStarCountLeaderboard() {
    const participatingUsers = await this.prisma.leaderboardSettings.findMany({
      where: { participate: true },
      select: { userId: true, hideUid: true },
    });

    if (participatingUsers.length === 0) {
      await this.clearLeaderboard(LeaderboardType.SIX_STAR_COUNT);
      return;
    }

    const userIds = participatingUsers.map((u) => u.userId);
    const hideUidMap = new Map(participatingUsers.map((u) => [u.userId, u.hideUid]));

    // 获取所有参与用户的游戏账号
    const accounts = await this.prisma.gameAccount.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
        uid: true,
        region: true,
      },
    });

    // 统计每个账号的六星数量
    const accountIds = accounts.map((a) => a.id);
    const sixStarCounts = await this.prisma.gachaRecord.groupBy({
      by: ['gameAccountId'],
      where: {
        gameAccountId: { in: accountIds },
        rarity: 6,
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map(sixStarCounts.map((c) => [c.gameAccountId, c._count.id]));

    // 合并数据并排序
    const sorted = accounts
      .map((a) => ({
        ...a,
        count: countMap.get(a.id) ?? 0,
      }))
      .filter((a) => a.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_LEADERBOARD_SIZE);

    await this.saveLeaderboard(LeaderboardType.SIX_STAR_COUNT, sorted.map((s, i) => ({
      rank: i + 1,
      gameAccountId: s.id,
      userId: s.userId,
      uid: s.uid,
      region: s.region,
      value: s.count,
      hideUid: hideUidMap.get(s.userId) ?? false,
    })));
  }

  /**
   * 刷新歪数排行榜
   * "歪" 定义：在限定池（角色限定池或武器池）中抽到非UP的六星
   */
  private async refreshOffBannerCountLeaderboard() {
    const participatingUsers = await this.prisma.leaderboardSettings.findMany({
      where: { participate: true },
      select: { userId: true, hideUid: true },
    });

    if (participatingUsers.length === 0) {
      await this.clearLeaderboard(LeaderboardType.OFF_BANNER_COUNT);
      return;
    }

    const userIds = participatingUsers.map((u) => u.userId);
    const hideUidMap = new Map(participatingUsers.map((u) => [u.userId, u.hideUid]));

    // 获取所有参与用户的游戏账号
    const accounts = await this.prisma.gameAccount.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
        uid: true,
        region: true,
      },
    });

    const accountIds = accounts.map((a) => a.id);

    // 获取所有六星记录（角色池和武器池都统计）
    // 歪的判断逻辑：在限定池中抽到的六星，但物品名不在池名中出现
    const sixStarRecords = await this.prisma.gachaRecord.findMany({
      where: {
        gameAccountId: { in: accountIds },
        rarity: 6,
        // 同时统计角色池和武器池
        category: { in: ['character', 'weapon'] },
      },
      select: {
        gameAccountId: true,
        category: true,
        poolName: true,
        itemName: true,
      },
    });

    // 统计每个账号的歪数
    const offBannerCounts = new Map<string, number>();

    for (const record of sixStarRecords) {
      // 判断是否为限定池
      // 角色池：需要包含限定关键词
      // 武器池：所有武器池都算限定池
      const isCharacterUpPool =
        record.category === 'character' &&
        UP_POOL_KEYWORDS.some((kw) => record.poolName.includes(kw));

      const isWeaponPool =
        record.category === 'weapon' &&
        WEAPON_POOL_KEYWORDS.some((kw) => record.poolName.includes(kw));

      // 如果不是限定池（角色限定池或武器池），跳过
      if (!isCharacterUpPool && !isWeaponPool) continue;

      // 判断是否歪：如果物品名不在池名中，则为歪
      // 假设池名包含UP物品名（如"艾雅法拉限定寻访"包含"艾雅法拉"）
      const isOffBanner = !record.poolName.includes(record.itemName);

      if (isOffBanner) {
        const current = offBannerCounts.get(record.gameAccountId) ?? 0;
        offBannerCounts.set(record.gameAccountId, current + 1);
      }
    }

    // 合并数据并排序
    const sorted = accounts
      .map((a) => ({
        ...a,
        count: offBannerCounts.get(a.id) ?? 0,
      }))
      .filter((a) => a.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_LEADERBOARD_SIZE);

    await this.saveLeaderboard(LeaderboardType.OFF_BANNER_COUNT, sorted.map((s, i) => ({
      rank: i + 1,
      gameAccountId: s.id,
      userId: s.userId,
      uid: s.uid,
      region: s.region,
      value: s.count,
      hideUid: hideUidMap.get(s.userId) ?? false,
    })));
  }

  /**
   * 保存排行榜数据到缓存表
   */
  private async saveLeaderboard(
    type: LeaderboardType,
    entries: Array<{
      rank: number;
      gameAccountId: string;
      userId: string;
      uid: string;
      region: string;
      value: number;
      hideUid: boolean;
    }>,
  ) {
    const now = new Date();

    // 清除旧数据
    await this.prisma.leaderboardCache.deleteMany({
      where: { type },
    });

    // 插入新数据
    if (entries.length > 0) {
      await this.prisma.leaderboardCache.createMany({
        data: entries.map((e) => ({
          type,
          rank: e.rank,
          gameAccountId: e.gameAccountId,
          userId: e.userId,
          displayUid: e.hideUid ? this.maskUid(e.uid) : e.uid,
          region: this.formatRegion(e.region),
          value: e.value,
          uidHidden: e.hideUid,
          cachedAt: now,
        })),
      });
    }
  }

  /**
   * 清空指定类型的排行榜
   */
  private async clearLeaderboard(type: LeaderboardType) {
    await this.prisma.leaderboardCache.deleteMany({
      where: { type },
    });
  }

  /**
   * 隐藏 UID：只显示后四位
   */
  private maskUid(uid: string): string {
    if (uid.length <= 4) {
      return '****' + uid;
    }
    return '*'.repeat(uid.length - 4) + uid.slice(-4);
  }

  /**
   * 格式化区服显示
   * 根据 serverId 判断：
   * - serverId = 1 → 国服
   * - serverId = 2 或 3 → 国际服
   */
  private formatRegion(region: string): string {
    // region 存储的是 serverId
    const serverId = region.trim();

    // 根据 serverId 判断
    if (serverId === '1') {
      return '国服';
    }
    if (serverId === '2' || serverId === '3') {
      return '国际服';
    }

    // 兼容旧数据格式（可能包含文字描述）
    const regionLower = region.toLowerCase();
    if (regionLower.includes('cn') || regionLower.includes('bili') || regionLower.includes('官服')) {
      return '国服';
    }
    if (regionLower.includes('global') || regionLower.includes('en') || regionLower.includes('jp') || regionLower.includes('kr')) {
      return '国际服';
    }

    return region || '未知';
  }
}
