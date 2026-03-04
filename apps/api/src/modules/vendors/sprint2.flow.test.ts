import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { VendorStatus, VenueStatus } from '@prisma/client';
import { AdminVendorsController } from '../admin/admin.vendors.controller';
import { VenuesService } from '../venues/venues.service';
import { VendorsService } from './vendors.service';

test('sprint2 flow: register -> approve -> venue create -> live venue visible', async () => {
  const fake = createFakePrisma();
  const audit = { log: async () => undefined };

  const vendorsService = new VendorsService(fake as never, audit as never);
  const adminController = new AdminVendorsController(fake as never, audit as never);
  const venuesService = new VenuesService(fake as never, audit as never);

  const userId = '00000000-0000-0000-0000-000000000001';
  fake.users.push({ id: userId, role: 'PLAYER' });

  const registration = await vendorsService.register(userId, { businessName: 'Ace Courts' });
  assert.equal(registration.status, VendorStatus.PENDING_APPROVAL);

  await assert.rejects(
    () =>
      venuesService.createVenue(userId, {
        name: 'Ace Arena',
        cityId: '00000000-0000-0000-0000-000000000111',
        stateId: '00000000-0000-0000-0000-000000000222',
        address: 'MG Road',
      }),
    ForbiddenException,
  );

  await adminController.approve(
    { id: '00000000-0000-0000-0000-000000000999' } as never,
    registration.id,
    {},
  );

  const createdVenue = await venuesService.createVenue(userId, {
    name: 'Ace Arena',
    cityId: '00000000-0000-0000-0000-000000000111',
    stateId: '00000000-0000-0000-0000-000000000222',
    address: 'MG Road',
  });

  await venuesService.updateVenue(userId, createdVenue.id, {
    status: VenueStatus.LIVE,
  });

  const list = await venuesService.listPlayerVenues({
    cityId: '00000000-0000-0000-0000-000000000111',
  });

  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, createdVenue.id);
  assert.equal(fake.users.find((u) => u.id === userId)?.role, 'VENDOR_OWNER');
});

function createFakePrisma() {
  const vendors: Array<{
    id: string;
    ownerUserId: string;
    status: VendorStatus;
    businessName: string;
    approvedAt: Date | null;
    createdAt: Date;
  }> = [];
  const venues: Array<{
    id: string;
    vendorId: string;
    name: string;
    cityId: string;
    stateId: string;
    address: string;
    status: VenueStatus;
    deletedAt: Date | null;
    createdAt: Date;
  }> = [];

  const users: Array<{ id: string; role: 'PLAYER' | 'VENDOR_OWNER' | 'ADMIN' }> = [];

  return {
    users,
    vendor: {
      findFirst: async ({ where }: any) =>
        vendors.find(
          (v) =>
            (where.ownerUserId ? v.ownerUserId === where.ownerUserId : true) &&
            (where.status ? v.status === where.status || where.status?.in?.includes(v.status) : true),
        ) ?? null,
      findUnique: async ({ where }: any) => vendors.find((v) => v.id === where.id) ?? null,
      findMany: async ({ where }: any) => vendors.filter((v) => (where?.status ? v.status === where.status : true)),
      create: async ({ data }: any) => {
        const row = {
          id: `vendor-${vendors.length + 1}`,
          ownerUserId: data.ownerUserId,
          status: VendorStatus.PENDING_APPROVAL,
          businessName: data.businessName,
          approvedAt: null,
          createdAt: new Date(),
        };
        vendors.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const current = vendors.find((v) => v.id === where.id);
        if (!current) throw new Error('vendor missing');
        Object.assign(current, data);
        return current;
      },
      count: async ({ where }: any) =>
        vendors.filter(
          (v) =>
            v.ownerUserId === where.ownerUserId &&
            v.status === where.status &&
            (!where.id?.not || v.id !== where.id.not),
        ).length,
    },
    user: {
      update: async ({ where, data }: any) => {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error('user missing');
        Object.assign(user, data);
        return user;
      },
    },
    venue: {
      findMany: async ({ where }: any) => {
        return venues.filter((venue) => {
          const vendor = vendors.find((v) => v.id === venue.vendorId);
          if (!vendor) return false;
          if (where?.status && venue.status !== where.status) return false;
          if (where?.deletedAt === null && venue.deletedAt !== null) return false;
          if (where?.cityId && venue.cityId !== where.cityId) return false;
          if (where?.vendor?.status && vendor.status !== where.vendor.status) return false;
          return true;
        });
      },
      findFirst: async ({ where }: any) => {
        return (
          venues.find((venue) => {
            if (where.id && venue.id !== where.id) return false;
            if (where.vendorId && venue.vendorId !== where.vendorId) return false;
            if (where.deletedAt === null && venue.deletedAt !== null) return false;
            if (where.status && venue.status !== where.status) return false;
            if (where.vendor?.status) {
              const vendor = vendors.find((v) => v.id === venue.vendorId);
              if (!vendor || vendor.status !== where.vendor.status) return false;
            }
            return true;
          }) ?? null
        );
      },
      create: async ({ data }: any) => {
        const row = {
          id: `venue-${venues.length + 1}`,
          vendorId: data.vendorId,
          name: data.name,
          cityId: data.cityId,
          stateId: data.stateId,
          address: data.address,
          status: VenueStatus.DRAFT,
          deletedAt: null,
          createdAt: new Date(),
        };
        venues.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const venue = venues.find((v) => v.id === where.id);
        if (!venue) throw new Error('venue missing');
        Object.assign(venue, data);
        return venue;
      },
    },
    resource: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => {
        throw new Error('not used');
      },
      update: async () => {
        throw new Error('not used');
      },
    },
  };
}
