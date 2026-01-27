import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CloudGachaRecordDto,
  GachaCategory,
  CreateGameAccountDto,
} from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  // ============== 游戏账号管理 ==============

  /**
   * 获取用户的所有游戏账号
   */
  async getGameAccounts(userId: string) {
    return this.prisma.gameAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取或创建游戏账号
   */
  async getOrCreateGameAccount(
    userId: string,
    data: CreateGameAccountDto,
  ) {
    const existing = await this.prisma.gameAccount.findUnique({
      where: {
        userId_uid_region: {
          userId,
          uid: data.uid,
          region: data.region,
        },
      },
    });

    if (existing) {
      // 补写 hgUid（仅当提供且云端未记录）
      if (data.hgUid && !existing.hgUid) {
        return await this.prisma.gameAccount.update({
          where: { id: existing.id },
          data: { hgUid: data.hgUid },
        });
      }
      return existing;
    }

    // 兼容旧云端账号键：
    // 旧版客户端：uid=hgUid, region='default'
    // 新版客户端：uid=roleId, region=serverId，并可携带 hgUid
    if (data.hgUid) {
      const legacy = await this.prisma.gameAccount.findFirst({
        where: {
          userId,
          uid: data.hgUid,
          region: 'default',
        },
      });
      if (legacy) {
        // 若存在旧账号，直接把它“升级”为新键（保留关联的 gachaRecords）
        return await this.prisma.gameAccount.update({
          where: { id: legacy.id },
          data: {
            uid: data.uid,
            region: data.region,
            hgUid: legacy.hgUid ?? data.hgUid,
          },
        });
      }
    }

    return this.prisma.gameAccount.create({
      data: {
        userId,
        uid: data.uid,
        region: data.region,
        hgUid: data.hgUid ?? null,
      },
    });
  }

  /**
   * 删除游戏账号（同时删除关联的抽卡记录）
   */
  async deleteGameAccount(userId: string, uid: string, region: string) {
    const account = await this.prisma.gameAccount.findUnique({
      where: {
        userId_uid_region: {
          userId,
          uid,
          region,
        },
      },
    });

    if (!account) {
      throw new NotFoundException('游戏账号不存在');
    }

    await this.prisma.gameAccount.delete({
      where: { id: account.id },
    });

    return { deleted: true };
  }

  // ============== 同步数据操作 ==============

  /**
   * 上传抽卡记录（批量 upsert）
   * 使用 gameAccountId + seqId + category 作为唯一约束，确保同一条抽卡记录不会重复存储
   */
  async uploadRecords(
    userId: string,
    uid: string,
    region: string,
    hgUid: string | undefined,
    records: CloudGachaRecordDto[],
  ) {
    // 获取或创建游戏账号
    const gameAccount = await this.getOrCreateGameAccount(userId, {
      uid,
      region,
      ...(hgUid ? { hgUid } : {}),
    });

    let uploaded = 0;
    let skipped = 0;

    // 批量处理记录
    for (const record of records) {
      try {
        // 使用 gameAccountId + seqId + category 作为唯一约束进行 upsert
        // 这样即使 recordUid 格式不同，同一条抽卡记录也不会重复存储
        await this.prisma.gachaRecord.upsert({
          where: {
            unique_gacha_record: {
              gameAccountId: gameAccount.id,
              seqId: record.seqId,
              category: record.category,
            },
          },
          create: {
            gameAccountId: gameAccount.id,
            recordUid: record.recordUid,
            category: record.category,
            poolId: record.poolId,
            poolName: record.poolName,
            itemId: record.itemId,
            itemName: record.itemName,
            rarity: record.rarity,
            isNew: record.isNew,
            gachaTs: record.gachaTs,
            seqId: record.seqId,
            fetchedAt: record.fetchedAt,
            isFree: record.isFree ?? null,
            weaponType: record.weaponType ?? null,
          },
          update: {
            // 更新可能变化的字段，同时更新 recordUid 以保持最新格式
            recordUid: record.recordUid,
            poolName: record.poolName,
            itemName: record.itemName,
            isNew: record.isNew,
          },
        });
        uploaded++;
      } catch (error) {
        // 记录已存在或其他错误，跳过
        skipped++;
        console.error('上传记录失败:', error);
      }
    }

    return {
      uploaded,
      skipped,
      total: records.length,
    };
  }

  /**
   * 下载抽卡记录
   */
  async downloadRecords(
    userId: string,
    uid: string,
    region: string,
    hgUid?: string,
    category?: GachaCategory,
    since?: string,
  ) {
    // 查找游戏账号
    let gameAccount = await this.prisma.gameAccount.findUnique({
      where: {
        userId_uid_region: {
          userId,
          uid,
          region,
        },
      },
    });

    // 兼容：若找不到新键账号，且提供了 hgUid，则尝试旧键并升级
    if (!gameAccount && hgUid) {
      const legacy = await this.prisma.gameAccount.findFirst({
        where: {
          userId,
          uid: hgUid,
          region: 'default',
        },
      });
      if (legacy) {
        gameAccount = await this.prisma.gameAccount.update({
          where: { id: legacy.id },
          data: {
            uid,
            region,
            hgUid: legacy.hgUid ?? hgUid,
          },
        });
      }
    }

    if (!gameAccount) {
      return {
        records: [],
        total: 0,
        // 若带 since，返回 since 以保持游标语义；否则返回当前时间（仅表示“本次响应时间”）
        lastSyncAt: since ?? new Date().toISOString(),
      };
    }

    // 构建查询条件
    const where: {
      gameAccountId: string;
      category?: GachaCategory;
      createdAt?: { gt: Date };
    } = {
      gameAccountId: gameAccount.id,
    };

    if (category) {
      where.category = category;
    }

    if (since) {
      // 使用严格大于避免边界重复（客户端本地也会去重，但服务端语义更清晰）
      where.createdAt = { gt: new Date(since) };
    }

    // 查询记录
    const records = await this.prisma.gachaRecord.findMany({
      where,
      orderBy: { gachaTs: 'desc' },
    });

    // 转换为响应格式（BigInt 需要转换为 Number）
    const cloudRecords = records.map((r) => ({
      recordUid: r.recordUid,
      category: r.category as GachaCategory,
      poolId: r.poolId,
      poolName: r.poolName,
      itemId: r.itemId,
      itemName: r.itemName,
      rarity: r.rarity,
      isNew: r.isNew,
      gachaTs: r.gachaTs,
      seqId: r.seqId,
      fetchedAt: Number(r.fetchedAt),
      isFree: r.isFree ?? undefined,
      weaponType: r.weaponType ?? undefined,
    }));

    const lastSyncAt = (() => {
      if (records.length === 0) {
        // 没有新增记录：保持游标不前跳，避免“无变化也更新游标”引发误解/潜在漏数据
        return since ?? new Date().toISOString();
      }
      // 返回本次命中的最大 createdAt 作为游标
      let max = records[0].createdAt;
      for (const r of records) {
        if (r.createdAt > max) max = r.createdAt;
      }
      return max.toISOString();
    })();

    return {
      records: cloudRecords,
      total: cloudRecords.length,
      lastSyncAt,
    };
  }

  /**
   * 获取同步状态（各账号的记录统计）
   */
  async getSyncStatus(userId: string) {
    const accounts = await this.prisma.gameAccount.findMany({
      where: { userId },
      include: {
        gachaRecords: {
          select: {
            category: true,
            gachaTs: true,
            seqId: true,
          },
        },
      },
    });

    return {
      accounts: accounts.map((account) => {
        // 使用 seqId + category 进行去重统计，避免重复记录影响统计
        const uniqueCharRecords = new Set(
          account.gachaRecords
            .filter((r) => r.category === 'character')
            .map((r) => `${r.seqId}_${r.category}`),
        );
        const uniqueWeaponRecords = new Set(
          account.gachaRecords
            .filter((r) => r.category === 'weapon')
            .map((r) => `${r.seqId}_${r.category}`),
        );

        // 找最新的记录时间
        const allTimes = account.gachaRecords.map((r) => r.gachaTs);
        const lastRecordAt =
          allTimes.length > 0 ? allTimes.sort().reverse()[0] : null;

        return {
          uid: account.uid,
          region: account.region,
          characterCount: uniqueCharRecords.size,
          weaponCount: uniqueWeaponRecords.size,
          lastRecordAt,
        };
      }),
    };
  }

  /**
   * 清理重复记录
   * 基于 gameAccountId + seqId + category 去重，保留最新的一条
   */
  async cleanupDuplicates(userId: string) {
    const accounts = await this.prisma.gameAccount.findMany({
      where: { userId },
    });

    let totalDeleted = 0;

    for (const account of accounts) {
      // 查找所有记录，按 seqId + category 分组
      const records = await this.prisma.gachaRecord.findMany({
        where: { gameAccountId: account.id },
        orderBy: { createdAt: 'desc' },
      });

      // 按 seqId + category 分组
      const groupMap = new Map<string, typeof records>();
      for (const record of records) {
        const key = `${record.seqId}_${record.category}`;
        const group = groupMap.get(key) || [];
        group.push(record);
        groupMap.set(key, group);
      }

      // 删除重复的记录（保留第一条，即最新的）
      for (const [, group] of groupMap) {
        if (group.length > 1) {
          const toDelete = group.slice(1).map((r) => r.id);
          await this.prisma.gachaRecord.deleteMany({
            where: { id: { in: toDelete } },
          });
          totalDeleted += toDelete.length;
        }
      }
    }

    return { deleted: totalDeleted };
  }
}
