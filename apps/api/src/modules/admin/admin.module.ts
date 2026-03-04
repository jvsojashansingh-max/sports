import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminMetricsController } from './admin.metrics.controller';
import { AdminVendorsController } from './admin.vendors.controller';

@Module({
  controllers: [AdminController, AdminVendorsController, AdminMetricsController],
})
export class AdminModule {}
