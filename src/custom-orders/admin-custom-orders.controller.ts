import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CustomOrdersService } from './custom-orders.service';
import { CustomOrderRankingService } from './custom-order-ranking.service';

@Controller('admin/custom-orders')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminCustomOrdersController {
  constructor(
    private readonly customOrders: CustomOrdersService,
    private readonly ranking: CustomOrderRankingService,
  ) {}

  @Get('ranks')
  listRanks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ranking.listRanks(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
  }

  @Post('ranks/recalculate')
  async recalculateRanks() {
    if (this.ranking.isRecalculating()) {
      return { ok: true, status: 'already_running', processed: 0 };
    }
    const result = await this.ranking.recalculateAll();
    return { ok: true, status: 'completed', ...result };
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('artisanId') artisanId?: string,
  ) {
    return this.customOrders.listAdmin({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status: status?.trim() || undefined,
      artisanId: artisanId ? Number(artisanId) : undefined,
    });
  }

  @Post(':id/release')
  release(@Param('id') id: string) {
    return this.customOrders.releaseToArtisan(id);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.customOrders.getAdminById(id);
  }
}
