import { Body, Controller, Patch, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request, @Query() query: any) {
    const user = req.user as AccessTokenPayload;
    return this.notifications.list(user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  markAll(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.notifications.markAllRead(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markOne(@Req() req: Request, @Param('id') id: string, @Body() _body: any) {
    const user = req.user as AccessTokenPayload;
    return this.notifications.markRead(user, Number(id));
  }
}

