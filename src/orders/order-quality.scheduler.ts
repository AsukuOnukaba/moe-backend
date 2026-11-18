import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderQualityService } from './order-quality.service';

/**
 * Processes customer delivery review windows when CUSTOMER_DELIVERY_REVIEW_HOURS is set.
 * Never transfers money — only eligibility / escalation flags.
 */
@Injectable()
export class OrderQualityScheduler {
  private readonly logger = new Logger(OrderQualityScheduler.name);

  constructor(private readonly quality: OrderQualityService) {}

  @Cron('*/30 * * * *', {
    timeZone: process.env.APP_TIMEZONE || 'Africa/Lagos',
  })
  async tick() {
    if (process.env.ORDER_SCHEDULERS_ENABLED === 'false') return;
    try {
      const result = await this.quality.processCustomerReviewWindows(new Date());
      if (!result.policyConfigured) return;
      if (result.eligible || result.escalated) {
        this.logger.log(
          `Delivery review windows: eligible=${result.eligible} escalated=${result.escalated}`,
        );
      }
    } catch (err) {
      this.logger.error('Delivery review window processing failed', err as Error);
    }
  }
}
