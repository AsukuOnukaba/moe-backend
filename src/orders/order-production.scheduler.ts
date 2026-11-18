import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderProductionService } from './order-production.service';

@Injectable()
export class OrderProductionScheduler {
  private readonly logger = new Logger(OrderProductionScheduler.name);

  constructor(private readonly production: OrderProductionService) {}

  @Cron('*/20 * * * *', {
    timeZone: process.env.APP_TIMEZONE || 'Africa/Lagos',
  })
  async tick() {
    if (process.env.ORDER_SCHEDULERS_ENABLED === 'false') return;
    try {
      const result = await this.production.processDeadlines(new Date());
      if (result.reminders || result.overdue) {
        this.logger.log(
          `Production deadlines: scanned=${result.scanned} reminders=${result.reminders} overdue=${result.overdue}`,
        );
      }
    } catch (err) {
      this.logger.error('Production deadline processing failed', err as Error);
    }
  }
}
