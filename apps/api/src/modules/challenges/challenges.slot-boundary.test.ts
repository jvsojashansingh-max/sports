import assert from 'node:assert/strict';
import test from 'node:test';
import { isSlotBoundaryValid } from './challenges.slot-boundary';

test('returns true when start aligns exactly to template slots', () => {
  const valid = isSlotBoundaryValid({
    startTs: new Date('2026-03-06T10:00:00.000Z'),
    durationMinutes: 60,
    templates: [
      {
        startMinute: 600,
        endMinute: 900,
        slotMinutes: 60,
        bufferMinutes: 0,
      },
    ],
  });

  assert.equal(valid, true);
});

test('returns false when start is not on template boundary', () => {
  const valid = isSlotBoundaryValid({
    startTs: new Date('2026-03-06T10:15:00.000Z'),
    durationMinutes: 60,
    templates: [
      {
        startMinute: 600,
        endMinute: 900,
        slotMinutes: 60,
        bufferMinutes: 0,
      },
    ],
  });

  assert.equal(valid, false);
});

test('returns false when duration does not match template slot length', () => {
  const valid = isSlotBoundaryValid({
    startTs: new Date('2026-03-06T10:00:00.000Z'),
    durationMinutes: 90,
    templates: [
      {
        startMinute: 600,
        endMinute: 960,
        slotMinutes: 60,
        bufferMinutes: 0,
      },
    ],
  });

  assert.equal(valid, false);
});
