import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingHoldDto, ListMyBookingsQueryDto } from './bookings.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('hold')
  @RequireAction('booking.hold.create')
  @RequireIdempotency()
  createHold(@CurrentUser() user: RequestUser, @Body() body: CreateBookingHoldDto) {
    return this.bookingsService.createHold(user, body);
  }

  @Post(':bookingId/waiting-opponent')
  @RequireAction('booking.hold.activate')
  @RequireIdempotency()
  waitingOpponent(@CurrentUser() user: RequestUser, @Param('bookingId') bookingId: string) {
    return this.bookingsService.moveToWaitingOpponent(user, bookingId);
  }

  @Get('mine')
  @RequireAction('booking.list.mine')
  listMine(@CurrentUser() user: RequestUser, @Query() query: ListMyBookingsQueryDto) {
    return this.bookingsService.listMine(user, query);
  }
}
