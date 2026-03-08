import { Injectable } from '@nestjs/common';
import { LeaderboardScope, LeaderboardWindow, SportId } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ListLeaderboardsQueryDto, UpsertLevelThresholdDto } from './stats.dto';
import { buildUserLabelMap } from '../../common/users/user-labels';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertLevelThreshold(dto: UpsertLevelThresholdDto) {
    return this.prisma.levelThreshold.upsert({
      where: {
        sportId_level: {
          sportId: dto.sportId,
          level: dto.level,
        },
      },
      create: {
        sportId: dto.sportId,
        level: dto.level,
        winsRequired: dto.winsRequired,
      },
      update: {
        winsRequired: dto.winsRequired,
      },
    });
  }

  async listLevelThresholds(sportId?: SportId) {
    return this.prisma.levelThreshold.findMany({
      where: {
        ...(sportId ? { sportId } : {}),
      },
      orderBy: [{ sportId: 'asc' }, { level: 'asc' }],
    });
  }

  async listLeaderboards(query: ListLeaderboardsQueryDto) {
    const scope = query.scope ?? LeaderboardScope.ALL;
    const window = query.window ?? LeaderboardWindow.ALL_TIME;

    const snapshot = await this.prisma.leaderboardSnapshot.findFirst({
      where: {
        sportId: query.sportId,
        scope,
        window,
        ...(query.geoId ? { geoId: query.geoId } : {}),
      },
      orderBy: {
        snapshotTs: 'desc',
      },
    });
    if (snapshot) {
      const snapshotRows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
      const snapshotUserIds = snapshotRows
        .map((row) => (row && typeof row === 'object' && 'userId' in row ? (row as { userId?: string }).userId : null))
        .filter((value): value is string => Boolean(value));
      const userLabelMap = await buildUserLabelMap(this.prisma, snapshotUserIds);

      return {
        source: 'snapshot',
        rows: snapshotRows.map((row) => {
          if (!row || typeof row !== 'object' || !('userId' in row)) {
            return row;
          }
          const record = row as Record<string, unknown> & { userId?: string };
          return {
            ...record,
            userLabel: record.userId ? userLabelMap.get(record.userId) ?? 'Player' : 'Player',
          };
        }),
      };
    }

    const liveRows = await this.prisma.sportStat.findMany({
      where: {
        sportId: query.sportId,
      },
      orderBy: [{ wins: 'desc' }, { level: 'desc' }, { updatedAt: 'asc' }],
      take: 100,
      select: {
        userId: true,
        wins: true,
        losses: true,
        matches: true,
        level: true,
        rating: true,
      },
    });

    const userLabelMap = await buildUserLabelMap(
      this.prisma,
      liveRows.map((row) => row.userId),
    );

    return {
      source: 'live',
      rows: liveRows.map((row) => ({
        ...row,
        userLabel: userLabelMap.get(row.userId) ?? 'Player',
      })),
    };
  }

  async applyMatchSettlement(params: {
    sportId: SportId;
    winnerCaptainUserId: string;
    loserCaptainUserId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [winnerStat, loserStat, thresholds] = await Promise.all([
        tx.sportStat.upsert({
          where: {
            userId_sportId: {
              userId: params.winnerCaptainUserId,
              sportId: params.sportId,
            },
          },
          create: {
            userId: params.winnerCaptainUserId,
            sportId: params.sportId,
            wins: 1,
            matches: 1,
            streak: 1,
          },
          update: {
            wins: {
              increment: 1,
            },
            matches: {
              increment: 1,
            },
            streak: {
              increment: 1,
            },
          },
        }),
        tx.sportStat.upsert({
          where: {
            userId_sportId: {
              userId: params.loserCaptainUserId,
              sportId: params.sportId,
            },
          },
          create: {
            userId: params.loserCaptainUserId,
            sportId: params.sportId,
            losses: 1,
            matches: 1,
            streak: 0,
          },
          update: {
            losses: {
              increment: 1,
            },
            matches: {
              increment: 1,
            },
            streak: 0,
          },
        }),
        tx.levelThreshold.findMany({
          where: {
            sportId: params.sportId,
          },
          orderBy: {
            level: 'asc',
          },
        }),
      ]);

      const winnerLevel = deriveLevelFromThresholds(winnerStat.wins, thresholds);
      const loserLevel = deriveLevelFromThresholds(loserStat.wins, thresholds);

      await Promise.all([
        tx.sportStat.update({
          where: {
            id: winnerStat.id,
          },
          data: {
            level: winnerLevel,
          },
        }),
        tx.sportStat.update({
          where: {
            id: loserStat.id,
          },
          data: {
            level: loserLevel,
          },
        }),
      ]);
    });
  }
}

function deriveLevelFromThresholds(
  wins: number,
  thresholds: Array<{ level: number; winsRequired: number }>,
): number {
  let level = 1;
  for (const threshold of thresholds) {
    if (wins >= threshold.winsRequired) {
      level = threshold.level;
    } else {
      break;
    }
  }
  return level;
}
