import { Body, Controller, Post } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { RegisterVendorDto } from './vendors.dto';
import { VendorsService } from './vendors.service';

@Controller('vendor')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post('register')
  @RequireAction('vendor.register')
  @RequireIdempotency()
  register(@CurrentUser() user: RequestUser, @Body() body: RegisterVendorDto) {
    return this.vendorsService.register(user.id, body);
  }
}
