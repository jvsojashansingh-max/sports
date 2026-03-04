import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { CreateFormatDto, ListFormatsQueryDto } from './formats.dto';
import { FormatsService } from './formats.service';

@Controller()
export class FormatsController {
  constructor(private readonly formatsService: FormatsService) {}

  @Post('vendor/formats')
  @RequireAction('vendor.format.create')
  @RequireIdempotency()
  create(@CurrentUser() user: RequestUser, @Body() body: CreateFormatDto) {
    return this.formatsService.createVendorFormat(user, body);
  }

  @Get('formats')
  list(@Query() query: ListFormatsQueryDto) {
    return this.formatsService.listFormats(query);
  }
}
