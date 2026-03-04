import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './common/audit/audit.service';
import { CacheModule } from './common/cache/cache.module';
import { AuthGuard } from './common/guards/auth.guard';
import { IdempotencyGuard } from './common/guards/idempotency.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { IdempotencyService } from './common/idempotency/idempotency.service';
import { HttpMetricsInterceptor } from './common/observability/http-metrics.interceptor';
import { ObservabilityModule } from './common/observability/observability.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { VenuesModule } from './modules/venues/venues.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { FormatsModule } from './modules/formats/formats.module';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { ChatModule } from './modules/chat/chat.module';
import { MatchesModule } from './modules/matches/matches.module';
import { StatsModule } from './modules/stats/stats.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';

@Module({
  imports: [
    CacheModule,
    ObservabilityModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    VenuesModule,
    BookingsModule,
    FormatsModule,
    ChallengesModule,
    ChatModule,
    MatchesModule,
    StatsModule,
    ReviewsModule,
    TournamentsModule,
    AvailabilityModule,
    AdminModule,
  ],
  providers: [
    AuditService,
    IdempotencyService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IdempotencyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
