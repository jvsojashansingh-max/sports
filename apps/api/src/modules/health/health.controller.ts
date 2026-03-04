import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('healthz')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async health() {
    return {
      ok: true,
      service: 'api',
      db: await this.prisma.isHealthy(),
      ts: new Date().toISOString(),
    };
  }
}
