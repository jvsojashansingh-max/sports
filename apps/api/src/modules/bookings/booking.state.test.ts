import assert from 'node:assert/strict';
import test from 'node:test';
import { BookingStatus } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES, isActiveBookingStatus } from './booking.state';

test('active booking statuses include hold and waiting states', () => {
  assert.equal(ACTIVE_BOOKING_STATUSES.includes(BookingStatus.HELD), true);
  assert.equal(ACTIVE_BOOKING_STATUSES.includes(BookingStatus.WAITING_OPPONENT), true);
  assert.equal(ACTIVE_BOOKING_STATUSES.includes(BookingStatus.CANCELLED), false);
});

test('status helper returns expected values', () => {
  assert.equal(isActiveBookingStatus(BookingStatus.CONFIRMED), true);
  assert.equal(isActiveBookingStatus(BookingStatus.COMPLETED), false);
});
