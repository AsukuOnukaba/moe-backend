import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.list(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  start(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.start(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  listMessages(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.listMessages(user, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  sendMessage(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.sendMessage(user, Number(id), body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.markRead(user, Number(id));
  }
}

