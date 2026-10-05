import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { ArtisanScoringService } from '../scoring/artisan-scoring.service';

/**
 * Mounted on `admin` (not `admin/artisans`) so static `artisans/scores`
 * is registered as a concrete path and is not swallowed by
 * existing `GET /admin/artisans/:id`.
 *
 * This controller must be registered in AdminModule *before*
 * AdminController so Express matches `/artisans/scores` ahead of
 * `/artisans/:id`.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminScoresController {
  constructor(private readonly scoring: ArtisanScoringService) {}

  @Get('artisans/scores')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.scoring.listScores(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
  }

  @Post('artisans/scores/recalculate')
  async recalculate() {
    if (this.scoring.isRecalculating()) {
      return { ok: true, status: 'already_running', processed: 0 };
    }
    const result = await this.scoring.recalculateAll();
    return { ok: true, status: 'completed', ...result };
  }

  @Get('artisans/:id/score')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.scoring.getScore(id);
  }
}
