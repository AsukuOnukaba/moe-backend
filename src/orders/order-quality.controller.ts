import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { OrderQualityService } from './order-quality.service';

@Controller()
export class OrderQualityController {
  constructor(private readonly quality: OrderQualityService) {}

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/quality')
  getBundle(@Req() req: Request, @Param('id') id: string) {
    return this.quality.getBundle(req.user as AccessTokenPayload, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/quality/submissions')
  @UseInterceptors(
    FilesInterceptor('files', 12, createMessageAttachmentMulterOptions()),
  )
  submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      description?: string;
      specsConfirmed?: boolean | string;
      outstandingIssues?: string;
    },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.quality.submitForReview(
      req.user as AccessTokenPayload,
      Number(id),
      body,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(
    'orders/:orderId/quality/submissions/:submissionId/evidence/:evidenceId',
  )
  async evidence(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Param('submissionId') submissionId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const access = await this.quality.getEvidenceAccess(
      req.user as AccessTokenPayload,
      Number(orderId),
      Number(submissionId),
      Number(evidenceId),
    );
    return res.redirect(302, access.url);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/quality/submissions/:submissionId/decide')
  decide(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      decision: 'approve' | 'request_rework' | 'reject' | 'escalate_dispute';
      reason?: string;
    },
  ) {
    return this.quality.adminDecide(
      req.user as AccessTokenPayload,
      Number(id),
      Number(submissionId),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/fulfillment')
  fulfillment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.quality.updateFulfillment(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/delivery/accept')
  accept(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { rating?: number; review?: string },
  ) {
    return this.quality.customerAccept(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/review')
  submitReview(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { rating: number; review?: string },
  ) {
    return this.quality.submitOrderReview(
      req.user as AccessTokenPayload,
      Number(id),
      body,
      { allowUpdate: false },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/review/update')
  updateReview(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { rating: number; review?: string },
  ) {
    return this.quality.submitOrderReview(
      req.user as AccessTokenPayload,
      Number(id),
      body,
      { allowUpdate: true },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/delivery/dispute')
  dispute(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { description: string; issueType?: string },
  ) {
    return this.quality.customerDispute(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/delivery/process-review-windows')
  processWindows(@Body() body: { now?: string }) {
    const now = body?.now ? new Date(body.now) : new Date();
    return this.quality.processCustomerReviewWindows(
      Number.isNaN(now.getTime()) ? new Date() : now,
    );
  }
}
