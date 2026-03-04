import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import {
  AvailabilityQueryDto,
  CreateAvailabilityTemplateDto,
  CreateBlockDto,
  ListBlocksQueryDto,
  UpdateAvailabilityTemplateDto,
} from './availability.dto';
import { AvailabilityService } from './availability.service';

@Controller()
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('vendor/availability-templates')
  @RequireAction('vendor.availability.manage')
  @RequireIdempotency()
  createTemplate(@CurrentUser() user: RequestUser, @Body() body: CreateAvailabilityTemplateDto) {
    return this.availabilityService.createTemplate(user.id, body);
  }

  @Get('vendor/availability-templates')
  @RequireAction('vendor.availability.manage')
  listTemplates(@CurrentUser() user: RequestUser, @Query('resourceId') resourceId?: string) {
    return this.availabilityService.listTemplates(user.id, resourceId);
  }

  @Patch('vendor/availability-templates/:templateId')
  @RequireAction('vendor.availability.manage')
  @RequireIdempotency()
  updateTemplate(
    @CurrentUser() user: RequestUser,
    @Param('templateId') templateId: string,
    @Body() body: UpdateAvailabilityTemplateDto,
  ) {
    return this.availabilityService.updateTemplate(user.id, templateId, body);
  }

  @Delete('vendor/availability-templates/:templateId')
  @RequireAction('vendor.availability.manage')
  @RequireIdempotency()
  deleteTemplate(@CurrentUser() user: RequestUser, @Param('templateId') templateId: string) {
    return this.availabilityService.deleteTemplate(user.id, templateId);
  }

  @Post('vendor/blocks')
  @RequireAction('vendor.blocks.manage')
  @RequireIdempotency()
  createBlock(@CurrentUser() user: RequestUser, @Body() body: CreateBlockDto) {
    return this.availabilityService.createBlock(user.id, body);
  }

  @Get('vendor/blocks')
  @RequireAction('vendor.blocks.manage')
  listBlocks(@CurrentUser() user: RequestUser, @Query() query: ListBlocksQueryDto) {
    return this.availabilityService.listBlocks(user.id, query);
  }

  @Delete('vendor/blocks/:blockId')
  @RequireAction('vendor.blocks.manage')
  @RequireIdempotency()
  deleteBlock(@CurrentUser() user: RequestUser, @Param('blockId') blockId: string) {
    return this.availabilityService.deleteBlock(user.id, blockId);
  }

  @Get('venues/:venueId/availability')
  availability(@Param('venueId') venueId: string, @Query() query: AvailabilityQueryDto) {
    return this.availabilityService.venueAvailability(venueId, query);
  }
}
