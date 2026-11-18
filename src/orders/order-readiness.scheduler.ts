import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderReadinessService } from './order-readiness.service';

@Injectable()
export class OrderReadinessScheduler {
  private readonly logger = new Logger(OrderReadinessScheduler.name);

  constructor(private readonly readiness: OrderReadinessService) {}

  /** Every 15 minutes — reminders at ~12h/~20h and overdue escalation. */
  @Cron('*/15 * * * *', {
    timeZone: process.env.APP_TIMEZONE || 'Africa/Lagos',
  })
  async tick() {
    if (process.env.ORDER_SCHEDULERS_ENABLED === 'false') return;
    try {
      const result = await this.readiness.processDeadlines(new Date());
      if (
        result.reminders12 ||
        result.reminders20 ||
        result.overdue
      ) {
        this.logger.log(
          `Readiness deadlines: scanned=${result.scanned} 12h=${result.reminders12} 20h=${result.reminders20} overdue=${result.overdue}`,
        );
      }
    } catch (err) {
      this.logger.error('Readiness deadline processing failed', err as Error);
    }
  }
}
