const bannedTerms = ['wallet', 'payout', 'withdraw', 'deposit', 'stake', 'bet', 'winnings', '2x'];

export function containsBannedCopy(input: string): boolean {
  const normalized = input.toLowerCase();
  return bannedTerms.some((term) => normalized.includes(term));
}

export function assertSafeCopy(input: string): void {
  if (containsBannedCopy(input)) {
    throw new Error('Unsafe copy: banned term detected');
  }
}

export const safePaymentCopy = {
  entryFee: 'Entry fee (paid to organizer)',
  prize: 'Prize (paid by organizer)',
  paymentRequired: 'Payment required (handled by organizer)',
};
