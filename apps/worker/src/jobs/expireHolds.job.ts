import { BookingStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function runExpireHoldsJob(now = new Date()): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: {
      status: BookingStatus.HELD,
      holdExpiresAt: {
        lt: now,
      },
    },
    data: {
      status: BookingStatus.CANCELLED,
    },
  });

  return result.count;
}

export async function closeExpireHoldsJob(): Promise<void> {
  await prisma.$disconnect();
}
