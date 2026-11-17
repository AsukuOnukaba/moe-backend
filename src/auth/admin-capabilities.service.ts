import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { PayoutCapability } from '../orders/payout.constants';
import { PAYOUT_CAPABILITIES } from '../orders/payout.constants';

/**
 * Smallest finance permission layer on top of AdminRoleGuard.
 * Admin role alone is not enough for payout actions.
 *
 * Grant via:
 * 1. User.adminCapabilities (preferred, granular)
 * 2. ADMIN_PAYOUT_FINANCE_USER_IDS env bootstrap (all payout caps)
 */
@Injectable()
export class AdminCapabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private bootstrapFinanceIds(): Set<number> {
    const raw = this.config.get<string>('ADMIN_PAYOUT_FINANCE_USER_IDS') ?? '';
    return new Set(
      raw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
  }

  async listCapabilities(userId: number): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { adminCapabilities: true },
    });
    const fromDb = user?.adminCapabilities ?? [];
    if (this.bootstrapFinanceIds().has(userId)) {
      return Array.from(new Set([...fromDb, ...PAYOUT_CAPABILITIES]));
    }
    return fromDb;
  }

  async hasCapability(userId: number, capability: PayoutCapability): Promise<boolean> {
    const caps = await this.listCapabilities(userId);
    return caps.includes(capability);
  }

  async assertCapability(userId: number, capability: PayoutCapability): Promise<void> {
    if (await this.hasCapability(userId, capability)) return;
    throw new ForbiddenException({
      message: `Missing admin capability "${capability}". Grant via User.adminCapabilities or ADMIN_PAYOUT_FINANCE_USER_IDS.`,
      code: 'FINANCE_CAPABILITY_REQUIRED',
      capability,
    });
  }
}
