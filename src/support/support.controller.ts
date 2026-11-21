import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { SupportService } from './support.service';
import { createMessageAttachmentMulterOptions } from '../upload/multer.config';

@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    // POST endpoint is unauthenticated per spec.
    const user = (req as any).user as AccessTokenPayload | undefined;
    const customerId = user?.sub ?? null;
    return this.support.create(body, customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.support.list(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('order-complaints')
  @UseInterceptors(
    FilesInterceptor('files', 6, createMessageAttachmentMulterOptions()),
  )
  createOrderComplaint(
    @Req() req: Request,
    @Body()
    body: {
      orderId?: string;
      category?: string;
      description?: string;
      durationMs?: string;
    },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.support.createOrderComplaint(
      req.user as AccessTokenPayload,
      body,
      files ?? [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('order-complaints')
  listOrderComplaints(
    @Req() req: Request,
    @Query('orderId') orderId?: string,
  ) {
    return this.support.listOrderComplaints(
      req.user as AccessTokenPayload,
      orderId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('order-complaints/:ticketId/attachments/:attachmentId')
  async orderComplaintAttachment(
    @Req() req: Request,
    @Param('ticketId') ticketId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const url = await this.support.getOrderComplaintAttachment(
      req.user as AccessTokenPayload,
      Number(ticketId),
      Number(attachmentId),
    );
    return res.redirect(302, url);
  }
}

@Controller('admin/support/order-complaints')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminOrderComplaintsController {
  constructor(private readonly support: SupportService) {}

  @Patch(':id/status')
  updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status?: string; note?: string },
  ) {
    return this.support.updateOrderComplaintStatus(
      req.user as AccessTokenPayload,
      Number(id),
      body,
    );
  }
}
