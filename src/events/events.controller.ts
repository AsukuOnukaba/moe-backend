import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';
import type { Request } from 'express';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Body() dto: CreateEventDto, @Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    await this.events.track(dto, user?.sub ?? null);
  }
}
