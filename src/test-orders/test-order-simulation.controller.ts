import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { TestOrderSimulationService } from './test-order-simulation.service';

@Controller('admin/test-orders')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class TestOrderSimulationController {
  constructor(private readonly simulation: TestOrderSimulationService) {}

  @Get('config')
  config(@Req() req: Request) {
    return this.simulation.configFor(req.user as AccessTokenPayload);
  }

  @Get('options')
  options(@Req() req: Request) {
    return this.simulation.options(req.user as AccessTokenPayload);
  }

  @Get()
  list(@Req() req: Request) {
    return this.simulation.list(req.user as AccessTokenPayload);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body()
    body: {
      productId?: number;
      artisanId?: number;
      customerId?: number;
      quantity?: number;
      customisation?: Record<string, unknown>;
      selectedVariations?: Record<string, unknown>;
    },
  ) {
    return this.simulation.create(req.user as AccessTokenPayload, body);
  }

  @Post(':id/payouts/record')
  recordPayout(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { amount?: number },
  ) {
    return this.simulation.recordSimulatedPayout(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @Post(':id/payouts/:transferId/verify')
  verifyPayout(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('transferId') transferId: string,
  ) {
    return this.simulation.verifySimulatedPayout(
      req.user as AccessTokenPayload,
      Number(id),
      Number(transferId),
    );
  }

  @Post(':id/time-scenario')
  timeScenario(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { scenario?: string },
  ) {
    return this.simulation.setTimeScenario(
      req.user as AccessTokenPayload,
      Number(id),
      body.scenario ?? '',
    );
  }

  @Delete(':id')
  cleanup(@Req() req: Request, @Param('id') id: string) {
    return this.simulation.cleanup(req.user as AccessTokenPayload, Number(id));
  }
}
