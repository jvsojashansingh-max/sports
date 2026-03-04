import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';

test('moveToWaitingOpponent transitions HELD to WAITING_OPPONENT', async () => {
  const prisma = fakePrisma({
    booking: {
      id: 'b1',
      createdByUserId: 'u1',
      status: BookingStatus.HELD,
      holdExpiresAt: new Date(Date.now() + 60_000),
    },
  });
  const audit = { log: async () => undefined };
  const service = new BookingsService(prisma as never, audit as never);

  const updated = await service.moveToWaitingOpponent(
    { id: 'u1', role: 'PLAYER', vendorId: null, deviceId: null },
    'b1',
  );

  assert.equal(updated.status, BookingStatus.WAITING_OPPONENT);
});

test('moveToWaitingOpponent rejects expired hold', async () => {
  const prisma = fakePrisma({
    booking: {
      id: 'b1',
      createdByUserId: 'u1',
      status: BookingStatus.HELD,
      holdExpiresAt: new Date(Date.now() - 60_000),
    },
  });
  const audit = { log: async () => undefined };
  const service = new BookingsService(prisma as never, audit as never);

  await assert.rejects(
    () =>
      service.moveToWaitingOpponent(
        { id: 'u1', role: 'PLAYER', vendorId: null, deviceId: null },
        'b1',
      ),
    ConflictException,
  );
  assert.equal(prisma.updatedStatus, BookingStatus.CANCELLED);
});

type FakeInput = {
  booking: {
    id: string;
    createdByUserId: string;
    status: BookingStatus;
    holdExpiresAt: Date | null;
  };
};

function fakePrisma(input: FakeInput) {
  let current = {
    ...input.booking,
  };

  const fake = {
    updatedStatus: null as BookingStatus | null,
    booking: {
      findFirst: async ({ where }: any) => {
        if (where.id !== current.id || where.createdByUserId !== current.createdByUserId) {
          return null;
        }
        return {
          ...current,
          deletedAt: null,
        };
      },
      update: async ({ data }: any) => {
        current = {
          ...current,
          ...data,
        };
        fake.updatedStatus = current.status;
        return current;
      },
      create: async () => {
        throw new Error('unused');
      },
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    resource: {
      findFirst: async () => ({ id: 'r1' }),
    },
  };

  return fake;
}
