import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveChallengeTimes } from './challenges.time';

test('deriveChallengeTimes computes windows from start time', () => {
  const result = deriveChallengeTimes({
    startTs: new Date('2026-03-04T12:00:00.000Z'),
    joinDeadlineMinutes: 180,
    checkinOpenMinutes: 30,
  });

  assert.equal(result.joinDeadlineTs.toISOString(), '2026-03-04T09:00:00.000Z');
  assert.equal(result.checkinOpenTs.toISOString(), '2026-03-04T11:30:00.000Z');
});
