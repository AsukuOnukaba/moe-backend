import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { createMessageAttachmentMulterOptions } from '../upload/multer.config';
import { OrderProductionService } from './order-production.service';

@Controller()
export class OrderProductionController {
  constructor(private readonly production: OrderProductionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/production')
  getBundle(@Req() req: Request, @Param('id') id: string) {
    return this.production.getBundle(req.user as AccessTokenPayload, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/production/progress')
  @UseInterceptors(
    FilesInterceptor('files', 8, createMessageAttachmentMulterOptions()),
  )
  submitProgress(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { note?: string; percentComplete?: string | number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const parsed = {
      note: body.note,
      percentComplete:
        body.percentComplete === undefined || body.percentComplete === ''
          ? undefined
          : Number(body.percentComplete),
    };
    return this.production.submitProgress(
      req.user as AccessTokenPayload,
      Number(id),
      parsed,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(
    'orders/:orderId/production/progress/:progressId/evidence/:evidenceId',
  )
  async evidence(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Param('progressId') progressId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const access = await this.production.getProgressEvidenceAccess(
      req.user as AccessTokenPayload,
      Number(orderId),
      Number(progressId),
      Number(evidenceId),
    );
    return res.redirect(302, access.url);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get('admin/orders/production')
  listAdmin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.production.listAdmin(Number(page ?? 1), Number(pageSize ?? 30));
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/production/extend')
  extend(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { extraHours: number; reason: string },
  ) {
    return this.production.extendDeadline(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/production/process-deadlines')
  processDeadlines(@Body() body: { now?: string }) {
    const now = body?.now ? new Date(body.now) : new Date();
    return this.production.processDeadlines(
      Number.isNaN(now.getTime()) ? new Date() : now,
    );
  }
}
