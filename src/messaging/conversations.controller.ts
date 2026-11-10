import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ConversationsService } from './conversations.service';
import { createMessageAttachmentMulterOptions } from '../upload/multer.config';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request, @Query('as') as?: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.list(user, { as });
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  deleteAll(@Req() req: Request, @Query('as') as?: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.deleteAllForUser(user, { as });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  start(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.start(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.getOne(user, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  listMessages(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.listMessages(user, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('file', createMessageAttachmentMulterOptions()))
  sendMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { content?: string; durationMs?: string; clientKey?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.sendMessage(user, Number(id), body, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages/:messageId/attachment')
  async getAttachment(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ) {
    const user = req.user as AccessTokenPayload;
    const access = await this.conversations.getAttachmentAccess(
      user,
      Number(id),
      Number(messageId),
    );
    // Redirect to a short-lived signed Cloudinary URL — never a permanent public link.
    return res.redirect(302, access.url);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.markRead(user, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/artisan-note')
  updateArtisanNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    const user = req.user as AccessTokenPayload;
    const note = typeof body?.note === 'string' ? body.note : '';
    return this.conversations.updateArtisanNote(user, Number(id), note);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async deleteOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    await this.conversations.deleteOne(user, Number(id));
  }
}
