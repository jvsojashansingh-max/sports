import { BookingStatus } from '@prisma/client';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.HELD,
  BookingStatus.WAITING_OPPONENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKIN_OPEN,
  BookingStatus.IN_PROGRESS,
  BookingStatus.RESULT_PENDING,
];

export function isActiveBookingStatus(status: BookingStatus): boolean {
  return ACTIVE_BOOKING_STATUSES.includes(status);
}
