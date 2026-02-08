import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

/**
 * 卡池 UP 物品映射表
 *
 * 用于判断六星是否"歪"（即抽到非 UP 的六星）
 * 需要手动维护：每次新增限定池/武器池时，需要在此添加对应的 poolId → up6Name 映射
 *
 * 数据来源：apps/desktop/public/content/{poolId}/data.json 中的 pool.up6_name
 */
const POOL_UP_MAP: Record<string, string> = {
  // ============== 角色限定池（特许寻访） ==============
  // poolId 格式: special_{version}_{subversion}_{index}
  'special_1_0_1': '莱万汀',
  'special_1_0_3': '洁尔佩塔',

  // ============== 武器限定池（与角色限定池关联） ==============
  // poolId 格式: weponbox_{version}_{subversion}_{index}（注意：API 返回的是 weponbox 而非 weaponbox）
  'weponbox_1_0_1': '熔铸火焰',
  'weponbox_1_0_3': '使命必达',

  // ============== 武器常驻池 ==============
  // poolId 格式: weaponbox_constant_{index}
  'weaponbox_constant_1': '赫拉芬格',
  'weaponbox_constant_2': '沧溟星梦',
  'weaponbox_constant_3': '不知归',
  'weaponbox_constant_4': '负山',
  'weaponbox_constant_5': '大雷斑',
};

/**
 * 判断 poolId 是否为角色限定池（特许寻访）
 * 只有特许寻访池中抽到非 UP 角色才算"歪"
 */
function isCharacterUpPool(poolId: string): boolean {
  return poolId.startsWith('special_');
}

/**
 * 判断 poolId 是否为武器池
 * 武器池中抽到非 UP 武器算"歪"
 */
function isWeaponPool(poolId: string): boolean {
  // 兼容两种拼写：weponbox（API 实际返回）和 weaponbox（常驻池）
  return poolId.includes('weponbox') || poolId.includes('weaponbox');
}

/**
 * 获取指定 poolId 的 UP 物品名称
 */
function getPoolUpName(poolId: string): string | null {
  return POOL_UP_MAP[poolId] ?? null;
}

@Injectable()
export class LeaderboardService implements OnModuleInit {
  private readonly logger = new Logger(LeaderboardService.name);

  /**
   * 存储每种排行榜类型的真实更新时间
   * 用于在没有数据时也能返回正确的更新时间
   */
  private lastUpdatedAt: Map<string, Date> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 模块初始化时从数据库加载排行榜的最后更新时间
   */
  async onModuleInit() {
    await this.loadLastUpdatedAt();
  }

  /**
   * 从数据库中恢复每种排行榜的最后更新时间
   */
  private async loadLastUpdatedAt() {
    const types = [
      LeaderboardType.TOTAL_PULLS,
      LeaderboardType.SIX_STAR_COUNT,
      LeaderboardType.OFF_BANNER_COUNT,
    ];

    for (const type of types) {
      const latest = await this.prisma.leaderboardCache.findFirst({
        where: { type },
        orderBy: { cachedAt: 'desc' },
        select: { cachedAt: true },
      });

      if (latest) {
        this.lastUpdatedAt.set(type, latest.cachedAt);
        this.logger.log(`已加载 ${type} 排行榜最后更新时间: ${latest.cachedAt.toISOString()}`);
      }
    }
  }

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
    // 并行查询排行榜条目和总参与人数
    const [entries, totalCount] = await Promise.all([
      this.prisma.leaderboardCache.findMany({
        where: { type },
        orderBy: { rank: 'asc' },
        take: Math.min(limit, MAX_LEADERBOARD_SIZE),
      }),
      this.prisma.leaderboardCache.count({
        where: { type },
      }),
    ]);

    // 从内存中获取真实的排行榜更新时间
    // 即使排行榜为空，也返回最后一次定时任务执行的时间
    const cachedUpdatedAt = this.lastUpdatedAt.get(type);
    const updatedAt = cachedUpdatedAt?.toISOString() ?? null;

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
      totalCount,
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
    const sixStarRecords = await this.prisma.gachaRecord.findMany({
      where: {
        gameAccountId: { in: accountIds },
        rarity: 6,
        category: { in: ['character', 'weapon'] },
      },
      select: {
        gameAccountId: true,
        category: true,
        poolId: true,
        itemName: true,
      },
    });

    // 统计每个账号的歪数
    const offBannerCounts = new Map<string, number>();

    for (const record of sixStarRecords) {
      // 通过 poolId 前缀判断池类型
      const isUpPool =
        (record.category === 'character' && isCharacterUpPool(record.poolId)) ||
        (record.category === 'weapon' && isWeaponPool(record.poolId));

      // 如果不是限定池/武器池，跳过（常驻池的六星不算歪）
      if (!isUpPool) continue;

      // 获取该池的 UP 物品名称
      const upName = getPoolUpName(record.poolId);

      // 判断是否歪：如果抽到的物品不是 UP 物品，则为歪
      // 注意：如果该 poolId 不在映射表中（upName 为 null），则无法判断，跳过
      if (!upName) {
        this.logger.warn(`未知的 poolId: ${record.poolId}，无法判断是否歪`);
        continue;
      }

      const isOffBanner = record.itemName !== upName;

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
   *
   * 使用事务保证"删除旧数据 + 插入新数据"的原子性，
   * 避免并发读取在两步之间看到空数据。
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

    // 更新内存中的最后更新时间
    this.lastUpdatedAt.set(type, now);

    // 在事务中执行删除+插入，确保外部读取不会看到中间的空状态
    await this.prisma.$transaction(async (tx) => {
      // 清除旧数据
      await tx.leaderboardCache.deleteMany({
        where: { type },
      });

      // 插入新数据
      if (entries.length > 0) {
        await tx.leaderboardCache.createMany({
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
    });
  }

  /**
   * 清空指定类型的排行榜
   */
  private async clearLeaderboard(type: LeaderboardType) {
    const now = new Date();

    // 更新内存中的最后更新时间（即使清空也记录时间）
    this.lastUpdatedAt.set(type, now);

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
   *
   * region 字段的可能格式：
   * - 国服：serverId（如 "1"）
   * - 国际服：serverId（如 "2", "3"）或 "gryphline@{serverId}"（如 "gryphline@2"）
   *
   * 客户端为避免国服/国际服 serverId 冲突，会将国际服编码为 "gryphline@{serverId}" 格式
   */
  private formatRegion(region: string): string {
    const value = region.trim();

    // 国际服：gryphline@{serverId} 格式（客户端为区分国服/国际服而编码）
    if (value.startsWith('gryphline@')) {
      return '国际服';
    }

    // 国服：serverId = 1
    if (value === '1') {
      return '国服';
    }

    // 国际服：serverId = 2 或 3
    if (value === '2' || value === '3') {
      return '国际服';
    }

    // 兼容旧数据格式（可能包含文字描述）
    const regionLower = value.toLowerCase();
    if (regionLower.includes('cn') || regionLower.includes('bili') || regionLower.includes('官服')) {
      return '国服';
    }
    if (regionLower.includes('global') || regionLower.includes('en') || regionLower.includes('jp') || regionLower.includes('kr')) {
      return '国际服';
    }

    return value || '未知';
  }
}
