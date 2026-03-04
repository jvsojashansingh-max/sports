import assert from 'node:assert/strict';
import test from 'node:test';
import { can } from './can';

test('player can create and accept challenges', () => {
  assert.equal(can('PLAYER', 'challenge.create'), true);
  assert.equal(can('PLAYER', 'challenge.accept'), true);
  assert.equal(can('PLAYER', 'challenge.confirm'), true);
  assert.equal(can('PLAYER', 'team.invite'), true);
  assert.equal(can('PLAYER', 'conversation.messages.send'), true);
  assert.equal(can('PLAYER', 'conversation.support.open'), true);
  assert.equal(can('PLAYER', 'match.result.submit'), true);
  assert.equal(can('PLAYER', 'message.report'), true);
  assert.equal(can('PLAYER', 'review.create'), true);
  assert.equal(can('PLAYER', 'tournament.register'), true);
  assert.equal(can('PLAYER', 'vendor.register'), true);
  assert.equal(can('PLAYER', 'vendor.venue.manage'), false);
  assert.equal(can('PLAYER', 'vendor.availability.manage'), false);
  assert.equal(can('PLAYER', 'booking.hold.create'), true);
  assert.equal(can('PLAYER', 'booking.hold.activate'), true);
});

test('vendor roles can manage match-day operations', () => {
  assert.equal(can('VENDOR_OWNER', 'match.checkin.manage'), true);
  assert.equal(can('VENDOR_STAFF', 'match.forfeit.manage'), true);
  assert.equal(can('VENDOR_OWNER', 'conversation.moderate'), true);
  assert.equal(can('VENDOR_OWNER', 'tournament.create'), true);
  assert.equal(can('VENDOR_STAFF', 'tournament.bracket.generate'), true);
  assert.equal(can('PLAYER', 'match.checkin.manage'), false);
  assert.equal(can('PLAYER', 'conversation.moderate'), false);
});

test('non-admin cannot review vendor approvals', () => {
  assert.equal(can('VENDOR_OWNER', 'vendor.approval.review'), false);
  assert.equal(can('PLAYER', 'vendor.approval.review'), false);
  assert.equal(can('VENDOR_OWNER', 'message.report.review'), false);
  assert.equal(can('PLAYER', 'dispute.admin.review'), false);
});

test('admin can do everything', () => {
  assert.equal(can('ADMIN', 'vendor.approval.review'), true);
  assert.equal(can('ADMIN', 'payment.status.mark'), true);
  assert.equal(can('ADMIN', 'vendor.venue.manage'), true);
  assert.equal(can('ADMIN', 'vendor.blocks.manage'), true);
});

test('vendor dispute resolution allowed by role (tenant checked in service)', () => {
  assert.equal(can('VENDOR_STAFF', 'match.dispute.resolve'), true);
  assert.equal(can('PLAYER', 'match.dispute.resolve'), false);
});
