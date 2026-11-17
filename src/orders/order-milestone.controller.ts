import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { createMessageAttachmentMulterOptions } from '../upload/multer.config';
import { OrderMilestoneService } from './order-milestone.service';

@Controller()
export class OrderMilestoneController {
  constructor(private readonly milestones: OrderMilestoneService) {}

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id/artisan-payout/milestones')
  list(@Param('id') id: string) {
    return this.milestones.listMilestones(Number(id));
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/total-payable')
  setTotal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      totalPayableAmount: number;
      reason?: string;
      exceptionApproved?: boolean;
      exceptionReason?: string;
    },
  ) {
    return this.milestones.setTotalPayable(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/milestones')
  create(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      kind: 'initial' | 'intermediate' | 'final';
      name: string;
      description?: string;
      approvedAmount: number;
      currency?: string;
      sequence?: number;
      dueConditions?: Record<string, unknown>;
      exceptionApproved?: boolean;
      exceptionReason?: string;
    },
  ) {
    return this.milestones.createMilestone(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/milestones/:milestoneId/eligible')
  eligible(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.milestones.markMilestoneEligible(
      req.user as AccessTokenPayload,
      Number(id),
      Number(milestoneId),
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('admin/orders/:id/artisan-payout/milestones/:milestoneId/transfers')
  @UseInterceptors(
    FilesInterceptor('files', 8, createMessageAttachmentMulterOptions()),
  )
  record(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body()
    body: {
      amount: number | string;
      currency?: string;
      transferDate: string;
      payeeName: string;
      payeeDetails?: string;
      externalReference: string;
    },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const amount =
      typeof body.amount === 'string' ? Number(body.amount) : body.amount;
    return this.milestones.recordMilestoneTransfer(
      req.user as AccessTokenPayload,
      Number(id),
      Number(milestoneId),
      { ...body, amount },
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post(
    'admin/orders/:id/artisan-payout/transfers/:transferId/verify-milestone',
  )
  verify(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('transferId') transferId: string,
    @Body() body: { notes: string },
  ) {
    return this.milestones.verifyMilestoneTransfer(
      req.user as AccessTokenPayload,
      Number(id),
      Number(transferId),
      body,
    );
  }
}
