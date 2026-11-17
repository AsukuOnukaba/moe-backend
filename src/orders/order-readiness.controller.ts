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
import { OrderReadinessService } from './order-readiness.service';
import type {
  AdminExtendDeadlineBody,
  AdminReadinessDecisionBody,
  SubmitReadinessBody,
} from './dto/submit-readiness.dto';

@Controller()
export class OrderReadinessController {
  constructor(private readonly readiness: OrderReadinessService) {}

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/readiness')
  getBundle(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.readiness.getReadinessBundle(user, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/readiness/assessments')
  @UseInterceptors(
    FilesInterceptor('files', 8, createMessageAttachmentMulterOptions()),
  )
  submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: SubmitReadinessBody,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const user = req.user as AccessTokenPayload;
    // Multipart fields arrive as strings — parse JSON payload when needed.
    const parsed: SubmitReadinessBody = { ...body };
    if (typeof (body as { payload?: unknown }).payload === 'string') {
      try {
        parsed.payload = JSON.parse(
          String((body as { payload?: unknown }).payload),
        ) as SubmitReadinessBody['payload'];
      } catch {
        parsed.payload = {};
      }
    }
    const raw = body as SubmitReadinessBody & {
      cannotFulfil?: boolean | string;
      acknowledgedRequirements?: boolean | string;
    };
    if (typeof raw.cannotFulfil === 'string') {
      parsed.cannotFulfil = raw.cannotFulfil === 'true';
    }
    if (typeof raw.acknowledgedRequirements === 'string') {
      parsed.acknowledgedRequirements = raw.acknowledgedRequirements === 'true';
    }
    return this.readiness.submitAssessment(
      user,
      Number(id),
      parsed,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(
    'orders/:orderId/readiness/assessments/:assessmentId/evidence/:evidenceId',
  )
  async evidence(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Param('assessmentId') assessmentId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const user = req.user as AccessTokenPayload;
    const access = await this.readiness.getEvidenceAccess(
      user,
      Number(orderId),
      Number(assessmentId),
      Number(evidenceId),
    );
    return res.redirect(302, access.url);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get('admin/orders/readiness')
  listAdmin(
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.readiness.listAdmin(
      filter,
      Number(page ?? 1),
      Number(pageSize ?? 20),
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/readiness/assessments/:assessmentId/decide')
  decide(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('assessmentId') assessmentId: string,
    @Body() body: AdminReadinessDecisionBody,
  ) {
    const user = req.user as AccessTokenPayload;
    return this.readiness.adminDecide(
      user,
      Number(id),
      Number(assessmentId),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/readiness/extend')
  extend(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdminExtendDeadlineBody,
  ) {
    const user = req.user as AccessTokenPayload;
    return this.readiness.extendDeadline(user, Number(id), body);
  }

  /** Test/ops hook: process deadline reminders with optional ISO `now`. */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/readiness/process-deadlines')
  processDeadlines(@Body() body: { now?: string }) {
    const now = body?.now ? new Date(body.now) : new Date();
    if (Number.isNaN(now.getTime())) {
      return this.readiness.processDeadlines(new Date());
    }
    return this.readiness.processDeadlines(now);
  }
}
