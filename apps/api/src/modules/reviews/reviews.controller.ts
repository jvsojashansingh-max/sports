import { Body, Controller, Param, Post } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { CreateReviewDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('matches/:id/reviews')
  @RequireAction('review.create')
  @RequireIdempotency()
  createReview(
    @CurrentUser() user: RequestUser,
    @Param('id') matchId: string,
    @Body() body: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user, matchId, body);
  }
}
