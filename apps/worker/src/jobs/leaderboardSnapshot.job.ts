import {
  LeaderboardScope,
  LeaderboardWindow,
  Prisma,
  PrismaClient,
  SportId,
} from '@prisma/client';

const prisma = new PrismaClient();

type LeaderboardRow = {
  userId: string;
  wins: number;
  losses: number;
  matches: number;
  level: number;
  rating: number;
};

export async function runLeaderboardSnapshotJob(now = new Date()): Promise<number> {
  let writes = 0;

  for (const sportId of Object.values(SportId)) {
    const stats = await prisma.sportStat.findMany({
      where: { sportId },
      orderBy: [{ wins: 'desc' }, { level: 'desc' }, { updatedAt: 'asc' }],
      take: 1000,
      select: {
        userId: true,
        wins: true,
        losses: true,
        matches: true,
        level: true,
        rating: true,
      },
    });

    const userIds = stats.map((row) => row.userId);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            defaultCityId: true,
          },
        })
      : [];
    const cityByUser = new Map(users.map((user) => [user.id, user.defaultCityId]));

    const allRows = stats.slice(0, 100).map((row) => toRow(row));
    writes += await writeSnapshots({
      sportId,
      scope: LeaderboardScope.ALL,
      geoId: null,
      rows: allRows,
      now,
    });

    const rowsByCity = new Map<string, LeaderboardRow[]>();
    for (const stat of stats) {
      const cityId = cityByUser.get(stat.userId);
      if (!cityId) {
        continue;
      }
      const current = rowsByCity.get(cityId) ?? [];
      if (current.length < 100) {
        current.push(toRow(stat));
      }
      rowsByCity.set(cityId, current);
    }

    for (const [cityId, rows] of rowsByCity.entries()) {
      writes += await writeSnapshots({
        sportId,
        scope: LeaderboardScope.CITY,
        geoId: cityId,
        rows,
        now,
      });
    }
  }

  return writes;
}

async function writeSnapshots(params: {
  sportId: SportId;
  scope: LeaderboardScope;
  geoId: string | null;
  rows: LeaderboardRow[];
  now: Date;
}): Promise<number> {
  const rowsJson = params.rows as unknown as Prisma.InputJsonValue;
  const windows: LeaderboardWindow[] = [
    LeaderboardWindow.WEEKLY,
    LeaderboardWindow.MONTHLY,
    LeaderboardWindow.ALL_TIME,
  ];

  const result = await prisma.leaderboardSnapshot.createMany({
    data: windows.map((window) => ({
      sportId: params.sportId,
      scope: params.scope,
      geoId: params.geoId,
      window,
      snapshotTs: params.now,
      rows: rowsJson,
    })),
  });
  return result.count;
}

function toRow(row: {
  userId: string;
  wins: number;
  losses: number;
  matches: number;
  level: number;
  rating: number;
}): LeaderboardRow {
  return {
    userId: row.userId,
    wins: row.wins,
    losses: row.losses,
    matches: row.matches,
    level: row.level,
    rating: row.rating,
  };
}

export async function closeLeaderboardSnapshotJob(): Promise<void> {
  await prisma.$disconnect();
}
