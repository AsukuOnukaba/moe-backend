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
import { ArtisanPayoutService } from './artisan-payout.service';
import type {
  ApprovePayoutAmountBody,
  DisputePayoutBody,
  MarkFundingNotRequiredBody,
  RecordPayoutTransferBody,
  VerifyPayoutTransferBody,
} from './dto/artisan-payout.dto';

@Controller()
export class ArtisanPayoutController {
  constructor(private readonly payouts: ArtisanPayoutService) {}

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/artisan-payout')
  getBundle(@Req() req: Request, @Param('id') id: string) {
    return this.payouts.getBundle(req.user as AccessTokenPayload, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Get(
    'orders/:orderId/artisan-payout/transfers/:transferId/evidence/:evidenceId',
  )
  async evidence(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Param('transferId') transferId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const access = await this.payouts.getEvidenceAccess(
      req.user as AccessTokenPayload,
      Number(orderId),
      Number(transferId),
      Number(evidenceId),
    );
    return res.redirect(302, access.url);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/start-work')
  startWork(@Req() req: Request, @Param('id') id: string) {
    return this.payouts.startWork(req.user as AccessTokenPayload, Number(id));
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/approve-amount')
  approveAmount(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ApprovePayoutAmountBody,
  ) {
    return this.payouts.approveAmount(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/mark-not-required')
  markNotRequired(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: MarkFundingNotRequiredBody,
  ) {
    return this.payouts.markFundingNotRequired(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/transfers')
  @UseInterceptors(
    FilesInterceptor('files', 8, createMessageAttachmentMulterOptions()),
  )
  recordTransfer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: RecordPayoutTransferBody,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const parsed: RecordPayoutTransferBody = { ...body };
    const rawAmount = (body as { amount?: unknown }).amount;
    if (typeof rawAmount === 'string') {
      parsed.amount = Number(rawAmount);
    }
    return this.payouts.recordTransfer(
      req.user as AccessTokenPayload,
      Number(id),
      parsed,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/transfers/:transferId/verify')
  @UseInterceptors(
    FilesInterceptor('files', 8, createMessageAttachmentMulterOptions()),
  )
  verifyTransfer(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('transferId') transferId: string,
    @Body() body: VerifyPayoutTransferBody,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.payouts.verifyTransfer(
      req.user as AccessTokenPayload,
      Number(id),
      Number(transferId),
      body,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/transfers/:transferId/reject')
  rejectTransfer(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('transferId') transferId: string,
    @Body() body: { reason: string },
  ) {
    return this.payouts.rejectTransfer(
      req.user as AccessTokenPayload,
      Number(id),
      Number(transferId),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/dispute')
  dispute(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: DisputePayoutBody,
  ) {
    return this.payouts.disputeOrReverse(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }
}
