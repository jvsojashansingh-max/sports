import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SportId } from '@prisma/client';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import {
  CreateResourceDto,
  CreateVenueDto,
  UpdateResourceDto,
  UpdateVenueDto,
} from './venues.dto';
import { VenuesService } from './venues.service';

@Controller()
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get('venues')
  listVenues(
    @Query('cityId') cityId?: string,
    @Query('sportId') sportId?: SportId,
    @Query('q') q?: string,
  ) {
    return this.venuesService.listPlayerVenues({ cityId, sportId, q });
  }

  @Get('venues/:venueId')
  getVenue(@Param('venueId') venueId: string) {
    return this.venuesService.getPlayerVenue(venueId);
  }

  @Get('vendor/venues')
  @RequireAction('vendor.venue.manage')
  listVendorVenues(@CurrentUser() user: RequestUser) {
    return this.venuesService.listVendorVenues(user.id);
  }

  @Post('vendor/venues')
  @RequireAction('vendor.venue.manage')
  @RequireIdempotency()
  createVenue(@CurrentUser() user: RequestUser, @Body() body: CreateVenueDto) {
    return this.venuesService.createVenue(user.id, body);
  }

  @Patch('vendor/venues/:venueId')
  @RequireAction('vendor.venue.manage')
  @RequireIdempotency()
  updateVenue(
    @CurrentUser() user: RequestUser,
    @Param('venueId') venueId: string,
    @Body() body: UpdateVenueDto,
  ) {
    return this.venuesService.updateVenue(user.id, venueId, body);
  }

  @Get('vendor/resources')
  @RequireAction('vendor.resource.manage')
  listVendorResources(@CurrentUser() user: RequestUser, @Query('venueId') venueId?: string) {
    return this.venuesService.listVendorResources(user.id, venueId);
  }

  @Post('vendor/resources')
  @RequireAction('vendor.resource.manage')
  @RequireIdempotency()
  createResource(@CurrentUser() user: RequestUser, @Body() body: CreateResourceDto) {
    return this.venuesService.createResource(user.id, body);
  }

  @Patch('vendor/resources/:resourceId')
  @RequireAction('vendor.resource.manage')
  @RequireIdempotency()
  updateResource(
    @CurrentUser() user: RequestUser,
    @Param('resourceId') resourceId: string,
    @Body() body: UpdateResourceDto,
  ) {
    return this.venuesService.updateResource(user.id, resourceId, body);
  }
}
