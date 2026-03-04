import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeCopy, containsBannedCopy, safePaymentCopy } from './languagePolicy';

test('detects banned terms', () => {
  assert.equal(containsBannedCopy('Please deposit now'), true);
  assert.equal(containsBannedCopy('Winnings shown here'), true);
});

test('allows approved legal-safe copy', () => {
  assert.equal(containsBannedCopy(safePaymentCopy.entryFee), false);
  assert.equal(containsBannedCopy(safePaymentCopy.paymentRequired), false);
});

test('assertSafeCopy throws on banned terms', () => {
  assert.throws(() => assertSafeCopy('wallet enabled'), /Unsafe copy/);
  assert.doesNotThrow(() => assertSafeCopy('Entry fee (paid to organizer)'));
});
