import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSlotsForDay } from './availability.slots';

test('buildSlotsForDay marks blocked slots correctly', () => {
  const dayStart = new Date('2026-03-04T00:00:00.000Z');
  const slots = buildSlotsForDay({
    dayStartUtc: dayStart,
    templates: [
      {
        startMinute: 360,
        endMinute: 480,
        slotMinutes: 30,
        bufferMinutes: 0,
      },
    ],
    blockedRanges: [
      {
        startTs: new Date('2026-03-04T06:30:00.000Z'),
        endTs: new Date('2026-03-04T07:00:00.000Z'),
      },
    ],
  });

  assert.equal(slots.length, 4);
  assert.equal(slots[0]?.status, 'AVAILABLE');
  assert.equal(slots[1]?.status, 'BLOCKED');
  assert.equal(slots[2]?.status, 'AVAILABLE');
  assert.equal(slots[3]?.status, 'AVAILABLE');
});

test('booked slot takes precedence over blocked', () => {
  const dayStart = new Date('2026-03-04T00:00:00.000Z');
  const slots = buildSlotsForDay({
    dayStartUtc: dayStart,
    templates: [
      {
        startMinute: 360,
        endMinute: 420,
        slotMinutes: 30,
        bufferMinutes: 0,
      },
    ],
    blockedRanges: [
      {
        startTs: new Date('2026-03-04T06:00:00.000Z'),
        endTs: new Date('2026-03-04T06:30:00.000Z'),
      },
    ],
    bookedRanges: [
      {
        startTs: new Date('2026-03-04T06:00:00.000Z'),
        endTs: new Date('2026-03-04T06:30:00.000Z'),
      },
    ],
  });

  assert.equal(slots[0]?.status, 'BOOKED');
});
