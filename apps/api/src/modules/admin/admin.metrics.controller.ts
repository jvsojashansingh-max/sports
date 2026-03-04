import { Controller, Get, Header } from '@nestjs/common';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { MetricsService } from '../../common/observability/metrics.service';

@Controller('admin/metrics')
export class AdminMetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @RequireAction('vendor.approval.review')
  snapshot() {
    return this.metrics.snapshot();
  }

  @Get('prometheus')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  @RequireAction('vendor.approval.review')
  prometheus() {
    return this.metrics.toPrometheus();
  }
}
