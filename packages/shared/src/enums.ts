export const userRoles = ['PLAYER', 'VENDOR_OWNER', 'VENDOR_STAFF', 'ADMIN'] as const;
export type UserRole = (typeof userRoles)[number];

export const paymentStatuses = ['UNKNOWN', 'PAID', 'UNPAID'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const challengeStatuses = [
  'WAITING_OPPONENT',
  'OPPONENT_REQUESTED',
  'CONFIRMED',
  'CANCELLED',
  'CLOSED',
] as const;
export type ChallengeStatus = (typeof challengeStatuses)[number];
